use anyhow::Context;
use reqwest::Client;
use serde_json::{json, Value};
use tracing::warn;

use crate::models::{
    api::{Candle, Fill, FundingPoint},
    hyperliquid::{HyperliquidCandle, HyperliquidFill, HyperliquidFunding},
};

const MAX_FILL_BATCH_HINT: usize = 2_000;
const MAX_REMOTE_CHUNK_MS: i64 = 7 * 24 * 60 * 60 * 1000;
const MIN_SPLIT_WINDOW_MS: i64 = 60 * 1000;

#[derive(Clone)]
pub struct HyperliquidClient {
    base_url: String,
    http: Client,
}

impl HyperliquidClient {
    pub fn new(base_url: String) -> Self {
        Self {
            base_url,
            http: Client::new(),
        }
    }

    pub async fn fetch_fills_remote(
        &self,
        wallet: &str,
        from: i64,
        to: i64,
    ) -> anyhow::Result<Vec<Fill>> {
        let mut all = Vec::new();
        let mut cursor = from;

        while cursor <= to {
            let chunk_end = (cursor + MAX_REMOTE_CHUNK_MS - 1).min(to);
            let mut chunk = self
                .fetch_window_exhaustive(wallet, cursor, chunk_end)
                .await?;
            all.append(&mut chunk);

            if chunk_end == i64::MAX {
                break;
            }
            cursor = chunk_end + 1;
        }

        all.sort_by(|a, b| {
            a.timestamp.cmp(&b.timestamp).then(
                a.trade_id
                    .unwrap_or_default()
                    .cmp(&b.trade_id.unwrap_or_default()),
            )
        });
        all.dedup_by(|a, b| {
            (a.trade_id.is_some() && b.trade_id.is_some() && a.trade_id == b.trade_id)
                || (a.pair == b.pair
                    && a.timestamp == b.timestamp
                    && a.side == b.side
                    && (a.price - b.price).abs() < f64::EPSILON
                    && (a.size - b.size).abs() < f64::EPSILON)
        });

        Ok(all)
    }

    async fn fetch_window_exhaustive(
        &self,
        wallet: &str,
        start: i64,
        end: i64,
    ) -> anyhow::Result<Vec<Fill>> {
        let mut out = Vec::new();
        let mut stack = vec![(start, end)];

        while let Some((window_start, window_end)) = stack.pop() {
            if window_start > window_end {
                continue;
            }

            let batch = self
                .fetch_raw_fills_window(wallet, window_start, window_end)
                .await?;

            if batch.len() < MAX_FILL_BATCH_HINT {
                out.extend(batch.into_iter().map(|f| to_fill(wallet, f)));
                continue;
            }

            let span = window_end - window_start;
            if span > MIN_SPLIT_WINDOW_MS {
                let mid = window_start + (span / 2);
                stack.push((mid + 1, window_end));
                stack.push((window_start, mid));
                continue;
            }

            let mut paged = self
                .paginate_capped_window(wallet, window_start, window_end)
                .await?;
            out.append(&mut paged);
        }

        Ok(out)
    }

    async fn paginate_capped_window(
        &self,
        wallet: &str,
        start: i64,
        end: i64,
    ) -> anyhow::Result<Vec<Fill>> {
        let mut result = Vec::new();
        let mut cursor_start = start;
        let mut cursor_end = end;

        // Safety guard against pathological responses that never move cursors.
        for _ in 0..2_000 {
            if cursor_start > cursor_end {
                break;
            }

            let batch = self
                .fetch_raw_fills_window(wallet, cursor_start, cursor_end)
                .await?;
            if batch.is_empty() {
                break;
            }
            let batch_len = batch.len();

            let min_ts = batch.iter().map(|f| f.time).min().unwrap_or(cursor_start);
            let max_ts = batch.iter().map(|f| f.time).max().unwrap_or(cursor_end);

            result.extend(batch.into_iter().map(|f| to_fill(wallet, f)));

            if max_ts < cursor_start || min_ts > cursor_end {
                break;
            }

            let capped = batch_len >= MAX_FILL_BATCH_HINT;
            if !capped {
                break;
            }

            if min_ts == max_ts {
                if cursor_start == cursor_end {
                    break;
                }
                cursor_start = max_ts.saturating_add(1);
                continue;
            }

            // Heuristic: choose cursor direction based on observed ordering.
            let is_ascending = result
                .windows(2)
                .rev()
                .take(8)
                .all(|w| w[0].timestamp <= w[1].timestamp);

            if is_ascending {
                let next = max_ts.saturating_add(1);
                if next <= cursor_start {
                    break;
                }
                cursor_start = next;
            } else {
                let next = min_ts.saturating_sub(1);
                if next >= cursor_end {
                    break;
                }
                cursor_end = next;
            }
        }

        Ok(result)
    }

    async fn fetch_raw_fills_window(
        &self,
        wallet: &str,
        start: i64,
        end: i64,
    ) -> anyhow::Result<Vec<HyperliquidFill>> {
        let payload = json!({
            "type": "userFillsByTime",
            "user": wallet,
            "startTime": start,
            "endTime": end,
            "aggregateByTime": false,
        });

        self.http
            .post(&self.base_url)
            .json(&payload)
            .send()
            .await
            .context("failed to request user fills")?
            .error_for_status()
            .context("user fills request returned error")?
            .json()
            .await
            .context("failed to decode user fills")
    }

    pub async fn fetch_candles(
        &self,
        pair: &str,
        interval: &str,
        start_time: i64,
        end_time: i64,
    ) -> anyhow::Result<Vec<Candle>> {
        let coin = pair.replace("-PERP", "");
        let mut candles = self
            .fetch_raw_candles_window(&coin, interval, start_time, end_time)
            .await?;

        // Some environments may expose second-based time bounds for this endpoint.
        // Retry once with second timestamps when the millisecond request returns nothing.
        if candles.is_empty() && start_time >= 10_000_000_000 {
            let second_start = start_time / 1000;
            let second_end = end_time / 1000;
            let second_candles = self
                .fetch_raw_candles_window(&coin, interval, second_start, second_end)
                .await?;
            if !second_candles.is_empty() {
                warn!(
                    "candleSnapshot returned empty for ms range; used seconds fallback pair={} interval={}",
                    pair, interval
                );
                candles = second_candles;
            }
        }

        let mut parsed: Vec<Candle> = candles
            .into_iter()
            .map(|raw| Candle {
                timestamp: raw.start_time,
                open: raw.open.parse().unwrap_or(0.0),
                high: raw.high.parse().unwrap_or(0.0),
                low: raw.low.parse().unwrap_or(0.0),
                close: raw.close.parse().unwrap_or(0.0),
                volume: raw.volume.parse().unwrap_or(0.0),
            })
            .collect();

        parsed.sort_by_key(|candle| candle.timestamp);

        if parsed
            .first()
            .is_some_and(|candle| candle.timestamp > 0 && candle.timestamp < 10_000_000_000)
        {
            for candle in &mut parsed {
                candle.timestamp *= 1000;
            }
        }

        Ok(parsed)
    }

    async fn fetch_raw_candles_window(
        &self,
        coin: &str,
        interval: &str,
        start_time: i64,
        end_time: i64,
    ) -> anyhow::Result<Vec<HyperliquidCandle>> {
        let payload = json!({
            "type": "candleSnapshot",
            "req": {
                "coin": coin,
                "interval": interval,
                "startTime": start_time,
                "endTime": end_time,
            }
        });

        self.http
            .post(&self.base_url)
            .json(&payload)
            .send()
            .await
            .context("failed to request candles")?
            .error_for_status()
            .context("candles request returned error")?
            .json()
            .await
            .context("failed to decode candles")
    }

    pub async fn fetch_funding(
        &self,
        wallet: &str,
        start_time: i64,
        end_time: i64,
        pair: Option<&str>,
    ) -> anyhow::Result<Vec<FundingPoint>> {
        let coin_filter = pair.map(|p| p.replace("-PERP", ""));

        if let Some(coin) = coin_filter.as_deref() {
            match self
                .fetch_market_funding_history(coin, start_time, end_time)
                .await
            {
                Ok(points) if !points.is_empty() => {
                    return Ok(points);
                }
                Ok(_) => {}
                Err(err) => {
                    warn!(
                        "fundingHistory failed for {} in [{}..={}]: {}",
                        coin, start_time, end_time, err
                    );
                }
            }
        }

        let user_funding = self
            .fetch_user_funding(wallet, start_time, end_time)
            .await?;
        let mut points: Vec<FundingPoint> = user_funding
            .into_iter()
            .filter(|f| {
                coin_filter
                    .as_ref()
                    .is_none_or(|coin| f.coin.as_deref() == Some(coin.as_str()))
            })
            .map(|f| FundingPoint {
                timestamp: normalize_time_ms(f.time),
                rate: f.funding_rate.parse().unwrap_or(0.0),
            })
            .collect();
        points.sort_by_key(|point| point.timestamp);
        points.dedup_by_key(|point| point.timestamp);

        Ok(points)
    }

    async fn fetch_user_funding(
        &self,
        wallet: &str,
        start_time: i64,
        end_time: i64,
    ) -> anyhow::Result<Vec<HyperliquidFunding>> {
        let payload = json!({
            "type": "userFunding",
            "user": wallet,
            "startTime": start_time,
            "endTime": end_time,
        });

        self.http
            .post(&self.base_url)
            .json(&payload)
            .send()
            .await
            .context("failed to request funding")?
            .error_for_status()
            .context("funding request returned error")?
            .json()
            .await
            .context("failed to decode funding")
    }

    async fn fetch_market_funding_history(
        &self,
        coin: &str,
        start_time: i64,
        end_time: i64,
    ) -> anyhow::Result<Vec<FundingPoint>> {
        let mut points = self
            .fetch_market_funding_history_window(coin, start_time, end_time)
            .await?;

        if points.is_empty() && start_time >= 10_000_000_000 {
            points = self
                .fetch_market_funding_history_window(coin, start_time / 1000, end_time / 1000)
                .await?;
        }

        points.sort_by_key(|point| point.timestamp);
        points.dedup_by_key(|point| point.timestamp);
        Ok(points)
    }

    async fn fetch_market_funding_history_window(
        &self,
        coin: &str,
        start_time: i64,
        end_time: i64,
    ) -> anyhow::Result<Vec<FundingPoint>> {
        let payload = json!({
            "type": "fundingHistory",
            "coin": coin,
            "startTime": start_time,
            "endTime": end_time,
        });

        let root: Value = self
            .http
            .post(&self.base_url)
            .json(&payload)
            .send()
            .await
            .context("failed to request funding history")?
            .error_for_status()
            .context("funding history request returned error")?
            .json()
            .await
            .context("failed to decode funding history")?;

        let rows = match root {
            Value::Array(items) => items,
            Value::Object(map) => {
                if let Some(Value::Array(items)) = map.get("fundingHistory") {
                    items.clone()
                } else if let Some(Value::Array(items)) = map.get("data") {
                    items.clone()
                } else if let Some(Value::Array(items)) = map.get("history") {
                    items.clone()
                } else {
                    Vec::new()
                }
            }
            _ => Vec::new(),
        };

        let mut out = Vec::new();
        for row in rows {
            let ts = row
                .get("time")
                .and_then(parse_i64_value)
                .or_else(|| row.get("fundingTime").and_then(parse_i64_value));
            let rate = row
                .get("fundingRate")
                .and_then(parse_f64_value)
                .or_else(|| row.get("rate").and_then(parse_f64_value))
                .or_else(|| {
                    row.get("delta")
                        .and_then(|delta| delta.get("fundingRate"))
                        .and_then(parse_f64_value)
                });

            if let (Some(timestamp), Some(value)) = (ts, rate) {
                out.push(FundingPoint {
                    timestamp: normalize_time_ms(timestamp),
                    rate: value,
                });
            }
        }

        Ok(out)
    }
}

fn to_fill(wallet: &str, raw: HyperliquidFill) -> Fill {
    Fill {
        wallet: wallet.to_string(),
        pair: format!("{}-PERP", raw.coin),
        side: raw.side,
        price: raw.px.parse().unwrap_or(0.0),
        size: raw.sz.parse().unwrap_or(0.0),
        timestamp: raw.time,
        fee: raw.fee.parse().unwrap_or(0.0),
        dir: raw.dir,
        trade_id: raw.trade_id,
    }
}

fn parse_i64_value(value: &Value) -> Option<i64> {
    match value {
        Value::Number(n) => n.as_i64(),
        Value::String(s) => s.parse::<i64>().ok(),
        _ => None,
    }
}

fn parse_f64_value(value: &Value) -> Option<f64> {
    match value {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.parse::<f64>().ok(),
        _ => None,
    }
}

fn normalize_time_ms(ts: i64) -> i64 {
    if ts > 0 && ts < 10_000_000_000 {
        ts * 1000
    } else {
        ts
    }
}
