use once_cell::sync::Lazy;
use regex::Regex;

use crate::models::{
    api::{PositionsQuery, ReplayQuery},
    error::ApiError,
};

const MAX_RANGE_MS: i64 = 365 * 24 * 60 * 60 * 1000;
const MAX_PADDING_MS: i64 = 24 * 60 * 60 * 1000;

static WALLET_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^0x[a-fA-F0-9]{40}$").expect("valid"));
static PAIR_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^[A-Z0-9]+-PERP$").expect("valid"));

pub fn validate_positions_query(query: &PositionsQuery) -> Result<(), ApiError> {
    validate_wallet(&query.wallet)?;
    validate_time_range(query.from, query.to)?;

    if let Some(pair) = &query.pair {
        if !PAIR_RE.is_match(pair) {
            return Err(ApiError::bad_request(
                "invalid_pair",
                "pair must match format COIN-PERP",
            ));
        }
    }

    if let Some(direction) = &query.direction {
        let d = direction.to_ascii_lowercase();
        if d != "long" && d != "short" {
            return Err(ApiError::bad_request(
                "invalid_direction",
                "direction must be long or short",
            ));
        }
    }

    if query.page.unwrap_or(1) == 0 {
        return Err(ApiError::bad_request(
            "invalid_page",
            "page must be at least 1",
        ));
    }

    if let Some(size) = query.page_size {
        if size == 0 || size > 100 {
            return Err(ApiError::bad_request(
                "invalid_page_size",
                "page_size must be between 1 and 100",
            ));
        }
    }

    Ok(())
}

pub fn validate_replay_query(query: &ReplayQuery) -> Result<(), ApiError> {
    validate_wallet(&query.wallet)?;
    validate_time_range(query.from, query.to)?;

    if let Some(pre_ms) = query.pre_ms {
        if !(0..=MAX_PADDING_MS).contains(&pre_ms) {
            return Err(ApiError::bad_request(
                "invalid_pre_ms",
                "pre_ms must be between 0 and 86400000",
            ));
        }
    }

    if let Some(post_ms) = query.post_ms {
        if !(0..=MAX_PADDING_MS).contains(&post_ms) {
            return Err(ApiError::bad_request(
                "invalid_post_ms",
                "post_ms must be between 0 and 86400000",
            ));
        }
    }

    if let Some(interval) = &query.interval {
        let ok = matches!(
            interval.as_str(),
            "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "8h" | "12h" | "1d"
        );
        if !ok {
            return Err(ApiError::bad_request(
                "invalid_interval",
                "interval must be one of 1m,3m,5m,15m,30m,1h,2h,4h,8h,12h,1d",
            ));
        }
    }

    Ok(())
}

fn validate_wallet(wallet: &str) -> Result<(), ApiError> {
    if !WALLET_RE.is_match(wallet) {
        return Err(ApiError::bad_request(
            "invalid_wallet",
            "wallet must be a valid 0x-prefixed 40-byte hex address",
        ));
    }
    Ok(())
}

fn validate_time_range(from: i64, to: i64) -> Result<(), ApiError> {
    if from <= 0 || to <= 0 {
        return Err(ApiError::bad_request(
            "invalid_time",
            "from and to must be positive unix timestamps in milliseconds",
        ));
    }

    if from >= to {
        return Err(ApiError::bad_request(
            "invalid_time_range",
            "from must be less than to",
        ));
    }

    if to - from > MAX_RANGE_MS {
        return Err(ApiError::bad_request(
            "range_too_large",
            "date range cannot exceed 365 days",
        ));
    }

    Ok(())
}
