use std::str::FromStr;

use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions},
    SqlitePool,
};

pub async fn init_pool(database_url: &str) -> anyhow::Result<SqlitePool> {
    std::fs::create_dir_all("data")?;

    let options = SqliteConnectOptions::from_str(database_url)?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    migrate(&pool).await?;
    Ok(pool)
}

async fn migrate(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS fills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wallet TEXT NOT NULL,
            pair TEXT NOT NULL,
            side TEXT NOT NULL,
            price REAL NOT NULL,
            size REAL NOT NULL,
            timestamp INTEGER NOT NULL,
            fee REAL NOT NULL,
            dir TEXT,
            trade_id INTEGER
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_fills_trade
        ON fills(wallet, trade_id)
        WHERE trade_id IS NOT NULL;
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_fills_fallback
        ON fills(
            wallet,
            pair,
            timestamp,
            price,
            size,
            side,
            COALESCE(dir, ''),
            COALESCE(trade_id, -1)
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_fills_wallet_time
        ON fills(wallet, timestamp);
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS synced_days (
            wallet TEXT NOT NULL,
            day_start INTEGER NOT NULL,
            day_end INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (wallet, day_start)
        );
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}
