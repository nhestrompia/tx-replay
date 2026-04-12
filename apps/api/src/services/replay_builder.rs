use crate::{
    models::api::{Candle, Fill, Position, ReplayResponse},
    services::hyperliquid_client::HyperliquidClient,
};
use std::collections::BTreeMap;
use tracing::warn;

const INTERVALS: [(&str, i64); 11] = [
    ("1m", 60_000),
    ("3m", 3 * 60_000),
    ("5m", 5 * 60_000),
    ("15m", 15 * 60_000),
    ("30m", 30 * 60_000),
    ("1h", 60 * 60_000),
    ("2h", 2 * 60 * 60_000),
    ("4h", 4 * 60 * 60_000),
    ("8h", 8 * 60 * 60_000),
    ("12h", 12 * 60 * 60_000),
    ("1d", 24 * 60 * 60_000),
];
const TARGET_MAX_CANDLES: i64 = 4_500;
const FUNDING_CONTEXT_MS: i64 = 24 * 60 * 60 * 1000;
const MIN_REPLAY_BUCKETS: i64 = 8;

pub async fn build_replay(
    client: &HyperliquidClient,
    position: Position,
    pre_ms: i64,
    post_ms: i64,
    interval: String,
) -> anyhow::Result<ReplayResponse> {
    let requested_bucket_ms = interval_ms(&interval).unwrap_or(60_000);
    let requested_start = position.opened_at.saturating_sub(pre_ms.max(0));
    let requested_end = position.closed_at.saturating_add(post_ms.max(0));
    let (replay_start, replay_end) =
        ensure_min_replay_window(requested_start, requested_end, requested_bucket_ms);

    let intervals = candidate_intervals(&interval, replay_start, replay_end);
    let mut last_error: Option<anyhow::Error> = None;
    let mut candles = Vec::new();
    let mut selected_bucket_ms = requested_bucket_ms;

    for candidate in &intervals {
        match client
            .fetch_candles(&position.pair, candidate, replay_start, replay_end)
            .await
        {
            Ok(data) => {
                if data.is_empty() {
                    continue;
                }
                candles = data;
                selected_bucket_ms = interval_ms(candidate).unwrap_or(selected_bucket_ms);
                break;
            }
            Err(err) => {
                last_error = Some(err);
            }
        }
    }

    if candles.is_empty() {
        if let Some(err) = last_error.as_ref() {
            warn!(
                "all candle queries failed for {} {}: {}",
                position.wallet, position.pair, err
            );
        }
        candles = build_fill_fallback_candles(
            &position.fills,
            replay_start,
            replay_end,
            selected_bucket_ms,
        );
    }
    candles = densify_candles(candles, replay_start, replay_end, selected_bucket_ms);

    let mut funding = client
        .fetch_funding(
            &position.wallet,
            replay_start,
            replay_end,
            Some(&position.pair),
        )
        .await
        .unwrap_or_else(|err| {
            warn!(
                "funding fetch failed for {} {}: {}",
                position.wallet, position.pair, err
            );
            Vec::new()
        });

    if funding.len() < 2 {
        let wider_start = replay_start - FUNDING_CONTEXT_MS;
        let wider_end = replay_end + FUNDING_CONTEXT_MS;
        let wider = client
            .fetch_funding(&position.wallet, wider_start, wider_end, Some(&position.pair))
            .await
            .unwrap_or_else(|err| {
                warn!(
                    "expanded funding fetch failed for {} {}: {}",
                    position.wallet, position.pair, err
                );
                Vec::new()
            });
        if wider.len() > funding.len() {
            funding = wider;
        }
    }

    Ok(ReplayResponse {
        events: position.events.clone(),
        position,
        candles,
        funding,
        replay_start,
        replay_end,
    })
}

fn build_fill_fallback_candles(
    fills: &[Fill],
    replay_start: i64,
    replay_end: i64,
    bucket_ms: i64,
) -> Vec<Candle> {
    if fills.is_empty() || replay_start > replay_end || bucket_ms <= 0 {
        return Vec::new();
    }

    let mut ordered = fills.to_vec();
    ordered.sort_by_key(|fill| fill.timestamp);

    let mut price = ordered
        .first()
        .map(|fill| fill.price)
        .unwrap_or_default();
    if !price.is_finite() || price <= 0.0 {
        return Vec::new();
    }

    let mut candles = Vec::new();
    let mut index = 0usize;
    let mut bucket_start = align_down(replay_start, bucket_ms);

    while bucket_start <= replay_end {
        let bucket_end = (bucket_start + bucket_ms).min(replay_end + 1);
        let mut high = price;
        let mut low = price;
        let open = price;
        let mut close = price;
        let mut volume = 0.0;

        while index < ordered.len() {
            let fill = &ordered[index];
            if fill.timestamp < bucket_start {
                index += 1;
                continue;
            }
            if fill.timestamp >= bucket_end {
                break;
            }

            high = high.max(fill.price);
            low = low.min(fill.price);
            close = fill.price;
            volume += fill.size;
            index += 1;
        }

        candles.push(Candle {
            timestamp: bucket_start,
            open,
            high,
            low,
            close,
            volume,
        });

        price = close;
        bucket_start += bucket_ms;
    }

    candles
}

fn densify_candles(
    mut candles: Vec<Candle>,
    replay_start: i64,
    replay_end: i64,
    bucket_ms: i64,
) -> Vec<Candle> {
    if candles.is_empty() || replay_start > replay_end || bucket_ms <= 0 {
        return candles;
    }

    candles.sort_by_key(|candle| candle.timestamp);
    candles.dedup_by_key(|candle| candle.timestamp);

    let window_start = align_down(replay_start, bucket_ms);
    let window_end = align_down(replay_end, bucket_ms);
    if window_start > window_end {
        return candles;
    }

    let seed_price = candles
        .iter()
        .rev()
        .find(|c| c.timestamp <= window_start)
        .map(|c| c.close)
        .or_else(|| candles.first().map(|c| c.open))
        .unwrap_or(0.0);
    if !seed_price.is_finite() || seed_price <= 0.0 {
        return candles;
    }

    let mut by_bucket = BTreeMap::new();
    for candle in candles {
        let bucket = align_down(candle.timestamp, bucket_ms);
        if bucket < window_start || bucket > window_end {
            continue;
        }
        by_bucket.insert(
            bucket,
            Candle {
                timestamp: bucket,
                ..candle
            },
        );
    }

    let mut out = Vec::new();
    let mut previous_close = seed_price;
    let mut ts = window_start;
    while ts <= window_end {
        if let Some(candle) = by_bucket.get(&ts) {
            let mut current = candle.clone();
            if !current.open.is_finite() || current.open <= 0.0 {
                current.open = previous_close;
            }
            if !current.close.is_finite() || current.close <= 0.0 {
                current.close = current.open;
            }
            if !current.high.is_finite() || current.high <= 0.0 {
                current.high = current.open.max(current.close);
            }
            if !current.low.is_finite() || current.low <= 0.0 {
                current.low = current.open.min(current.close);
            }
            current.high = current.high.max(current.open).max(current.close);
            current.low = current.low.min(current.open).min(current.close);
            previous_close = current.close;
            out.push(current);
        } else {
            out.push(Candle {
                timestamp: ts,
                open: previous_close,
                high: previous_close,
                low: previous_close,
                close: previous_close,
                volume: 0.0,
            });
        }
        ts += bucket_ms;
    }

    out
}

fn align_down(value: i64, step: i64) -> i64 {
    value - value.rem_euclid(step)
}

fn candidate_intervals(requested: &str, replay_start: i64, replay_end: i64) -> Vec<&'static str> {
    let span = (replay_end - replay_start).max(1);
    let required_ms = (span / TARGET_MAX_CANDLES).max(1);
    let requested_ms = interval_ms(requested).unwrap_or(5 * 60_000);
    let min_ms = required_ms.max(requested_ms);

    let mut result = Vec::new();
    let mut started = false;
    for (label, ms) in INTERVALS {
        if ms >= min_ms {
            started = true;
        }
        if started {
            result.push(label);
        }
    }

    if result.is_empty() {
        result.push("1d");
    }

    result
}

fn interval_ms(interval: &str) -> Option<i64> {
    INTERVALS
        .iter()
        .find_map(|(label, ms)| if *label == interval { Some(*ms) } else { None })
}

fn ensure_min_replay_window(start: i64, end: i64, bucket_ms: i64) -> (i64, i64) {
    if bucket_ms <= 0 {
        return (start, end.max(start));
    }

    let safe_end = end.max(start);
    let span = safe_end - start;
    let min_span = bucket_ms.saturating_mul(MIN_REPLAY_BUCKETS);

    if span >= min_span {
        return (start, safe_end);
    }

    let deficit = min_span - span;
    let pad_before = deficit / 2;
    let pad_after = deficit - pad_before;

    let mut expanded_start = start.saturating_sub(pad_before);
    let mut expanded_end = safe_end.saturating_add(pad_after);
    if expanded_start < 0 {
        let shift = -expanded_start;
        expanded_start = 0;
        expanded_end = expanded_end.saturating_add(shift);
    }

    (expanded_start, expanded_end)
}
