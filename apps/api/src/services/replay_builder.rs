use crate::{
    models::api::{Position, ReplayResponse},
    services::hyperliquid_client::HyperliquidClient,
};

pub async fn build_replay(
    client: &HyperliquidClient,
    position: Position,
    pre_ms: i64,
    post_ms: i64,
    interval: String,
) -> anyhow::Result<ReplayResponse> {
    let replay_start = position.opened_at - pre_ms;
    let replay_end = position.closed_at + post_ms;

    let candles = client
        .fetch_candles(&position.pair, &interval, replay_start, replay_end)
        .await?;

    let funding = client
        .fetch_funding(
            &position.wallet,
            replay_start,
            replay_end,
            Some(&position.pair),
        )
        .await?
        .into_iter()
        .collect();

    Ok(ReplayResponse {
        events: position.events.clone(),
        position,
        candles,
        funding,
        replay_start,
        replay_end,
    })
}
