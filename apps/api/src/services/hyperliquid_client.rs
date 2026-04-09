use anyhow::Context;
use reqwest::Client;
use serde_json::json;

use crate::models::{
    api::{Candle, Fill, FundingPoint},
    hyperliquid::{HyperliquidCandle, HyperliquidFill, HyperliquidFunding},
};

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

    pub async fn fetch_fills(&self, wallet: &str, from: i64, to: i64) -> anyhow::Result<Vec<Fill>> {
        let mut all = Vec::new();
        let mut cursor = from;

        // Chunked fetch keeps large date ranges manageable and reduces API load spikes.
        while cursor < to {
            let chunk_end = (cursor + 7 * 24 * 60 * 60 * 1000).min(to);
            let payload = json!({
                "type": "userFillsByTime",
                "user": wallet,
                "startTime": cursor,
                "endTime": chunk_end,
                "aggregateByTime": false,
            });

            let fills: Vec<HyperliquidFill> = self
                .http
                .post(&self.base_url)
                .json(&payload)
                .send()
                .await
                .context("failed to request user fills")?
                .error_for_status()
                .context("user fills request returned error")?
                .json()
                .await
                .context("failed to decode user fills")?;

            all.extend(fills.into_iter().map(|raw| Fill {
                wallet: wallet.to_string(),
                pair: format!("{}-PERP", raw.coin),
                side: raw.side,
                price: raw.px.parse().unwrap_or(0.0),
                size: raw.sz.parse().unwrap_or(0.0),
                timestamp: raw.time,
                fee: raw.fee.parse().unwrap_or(0.0),
                dir: raw.dir,
                trade_id: raw.trade_id,
            }));

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
            a.trade_id.is_some() && b.trade_id.is_some() && a.trade_id == b.trade_id
        });

        Ok(all)
    }

    pub async fn fetch_candles(
        &self,
        pair: &str,
        interval: &str,
        start_time: i64,
        end_time: i64,
    ) -> anyhow::Result<Vec<Candle>> {
        let coin = pair.replace("-PERP", "");
        let payload = json!({
            "type": "candleSnapshot",
            "req": {
                "coin": coin,
                "interval": interval,
                "startTime": start_time,
                "endTime": end_time,
            }
        });

        let candles: Vec<HyperliquidCandle> = self
            .http
            .post(&self.base_url)
            .json(&payload)
            .send()
            .await
            .context("failed to request candles")?
            .error_for_status()
            .context("candles request returned error")?
            .json()
            .await
            .context("failed to decode candles")?;

        Ok(candles
            .into_iter()
            .map(|raw| Candle {
                timestamp: raw.start_time,
                open: raw.open.parse().unwrap_or(0.0),
                high: raw.high.parse().unwrap_or(0.0),
                low: raw.low.parse().unwrap_or(0.0),
                close: raw.close.parse().unwrap_or(0.0),
                volume: raw.volume.parse().unwrap_or(0.0),
            })
            .collect())
    }

    pub async fn fetch_funding(
        &self,
        wallet: &str,
        start_time: i64,
        end_time: i64,
        pair: Option<&str>,
    ) -> anyhow::Result<Vec<FundingPoint>> {
        let payload = json!({
            "type": "userFunding",
            "user": wallet,
            "startTime": start_time,
            "endTime": end_time,
        });

        let funding: Vec<HyperliquidFunding> = self
            .http
            .post(&self.base_url)
            .json(&payload)
            .send()
            .await
            .context("failed to request funding")?
            .error_for_status()
            .context("funding request returned error")?
            .json()
            .await
            .context("failed to decode funding")?;

        let coin_filter = pair.map(|p| p.replace("-PERP", ""));
        Ok(funding
            .into_iter()
            .filter(|f| {
                coin_filter
                    .as_ref()
                    .is_none_or(|coin| f.coin.as_deref() == Some(coin.as_str()))
            })
            .map(|f| FundingPoint {
                timestamp: f.time,
                rate: f.funding_rate.parse().unwrap_or(0.0),
            })
            .collect())
    }
}
