use crate::{
    models::api::{Candle, Fill, Position, ReplayResponse},
    services::hyperliquid_client::HyperliquidClient,
};
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

pub async fn build_replay(
    client: &HyperliquidClient,
    position: Position,
    pre_ms: i64,
    post_ms: i64,
    interval: String,
) -> anyhow::Result<ReplayResponse> {
    let replay_start = position.opened_at - pre_ms;
    let replay_end = position.closed_at + post_ms;

    let intervals = candidate_intervals(&interval, replay_start, replay_end);
    let mut last_error: Option<anyhow::Error> = None;
    let mut candles = Vec::new();

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
            interval_ms(&interval).unwrap_or(5 * 60_000),
        );
    }

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
