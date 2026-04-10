use std::collections::HashMap;

use chrono::Utc;
use sqlx::{FromRow, SqlitePool};

use crate::models::api::Fill;

use super::hyperliquid_client::HyperliquidClient;

const DAY_MS: i64 = 24 * 60 * 60 * 1000;
const RECENT_DAY_REFRESH_MS: i64 = 10 * 60 * 1000;

#[derive(Debug, FromRow)]
struct FillRow {
    wallet: String,
    pair: String,
    side: String,
    price: f64,
    size: f64,
    timestamp: i64,
    fee: f64,
    dir: Option<String>,
    trade_id: Option<i64>,
}

impl From<FillRow> for Fill {
    fn from(value: FillRow) -> Self {
        Self {
            wallet: value.wallet,
            pair: value.pair,
            side: value.side,
            price: value.price,
            size: value.size,
            timestamp: value.timestamp,
            fee: value.fee,
            dir: value.dir,
            trade_id: value.trade_id,
        }
    }
}

#[derive(Debug, FromRow)]
struct DayStatus {
    day_start: i64,
    updated_at: i64,
}

pub async fn get_fills_with_cache(
    db: &SqlitePool,
    client: &HyperliquidClient,
    wallet: &str,
    from: i64,
    to: i64,
) -> anyhow::Result<Vec<Fill>> {
    let wallet = wallet.to_ascii_lowercase();
    ensure_days_synced(db, client, &wallet, from, to).await?;
    load_cached_fills(db, &wallet, from, to).await
}

async fn ensure_days_synced(
    db: &SqlitePool,
    client: &HyperliquidClient,
    wallet: &str,
    from: i64,
    to: i64,
) -> anyhow::Result<()> {
    let day_ranges = day_ranges(from, to);
    let statuses = synced_days(db, wallet, &day_ranges).await?;
    let now = Utc::now().timestamp_millis();

    for (day_start, day_end) in day_ranges {
        let stale = statuses
            .get(&day_start)
            .is_none_or(|updated| is_stale_day(*updated, day_end, now));

        if stale {
            let fills = client
                .fetch_fills_remote(wallet, day_start, day_end)
                .await?;
            upsert_fills(db, &fills).await?;
            mark_day_synced(db, wallet, day_start, day_end, now).await?;
        }
    }

    Ok(())
}

async fn synced_days(
    db: &SqlitePool,
    wallet: &str,
    ranges: &[(i64, i64)],
) -> anyhow::Result<HashMap<i64, i64>> {
    let mut result = HashMap::new();

    for (day_start, _) in ranges {
        if let Some(row) = sqlx::query_as::<_, DayStatus>(
            r#"
            SELECT day_start, updated_at
            FROM synced_days
            WHERE wallet = ? AND day_start = ?
            "#,
        )
        .bind(wallet)
        .bind(day_start)
        .fetch_optional(db)
        .await?
        {
            result.insert(row.day_start, row.updated_at);
        }
    }

    Ok(result)
}

async fn upsert_fills(db: &SqlitePool, fills: &[Fill]) -> anyhow::Result<()> {
    if fills.is_empty() {
        return Ok(());
    }

    let mut tx = db.begin().await?;

    for fill in fills {
        sqlx::query(
            r#"
            INSERT OR IGNORE INTO fills
            (wallet, pair, side, price, size, timestamp, fee, dir, trade_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(fill.wallet.to_ascii_lowercase())
        .bind(&fill.pair)
        .bind(&fill.side)
        .bind(fill.price)
        .bind(fill.size)
        .bind(fill.timestamp)
        .bind(fill.fee)
        .bind(&fill.dir)
        .bind(fill.trade_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}

async fn mark_day_synced(
    db: &SqlitePool,
    wallet: &str,
    day_start: i64,
    day_end: i64,
    updated_at: i64,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO synced_days (wallet, day_start, day_end, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(wallet, day_start)
        DO UPDATE SET day_end = excluded.day_end, updated_at = excluded.updated_at
        "#,
    )
    .bind(wallet)
    .bind(day_start)
    .bind(day_end)
    .bind(updated_at)
    .execute(db)
    .await?;

    Ok(())
}

async fn load_cached_fills(
    db: &SqlitePool,
    wallet: &str,
    from: i64,
    to: i64,
) -> anyhow::Result<Vec<Fill>> {
    let rows = sqlx::query_as::<_, FillRow>(
        r#"
        SELECT wallet, pair, side, price, size, timestamp, fee, dir, trade_id
        FROM fills
        WHERE wallet = ? AND timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp ASC, COALESCE(trade_id, 0) ASC
        "#,
    )
    .bind(wallet)
    .bind(from)
    .bind(to)
    .fetch_all(db)
    .await?;

    Ok(rows.into_iter().map(Into::into).collect())
}

fn day_ranges(from: i64, to: i64) -> Vec<(i64, i64)> {
    let mut out = Vec::new();
    let mut day_start = floor_day(from);

    while day_start <= to {
        let day_end = (day_start + DAY_MS - 1).min(to);
        out.push((day_start, day_end));
        day_start += DAY_MS;
    }

    out
}

fn floor_day(ts_ms: i64) -> i64 {
    ts_ms - (ts_ms.rem_euclid(DAY_MS))
}

fn is_stale_day(updated_at: i64, day_end: i64, now: i64) -> bool {
    let is_recent = now - day_end <= DAY_MS;
    is_recent && now - updated_at > RECENT_DAY_REFRESH_MS
}
