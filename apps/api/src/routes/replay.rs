use axum::{
    extract::{Path, Query, State},
    Json,
};
use tracing::error;

use crate::{
    models::{
        api::{ReplayQuery, ReplayResponse},
        error::ApiError,
    },
    services::{
        fill_cache::get_fills_with_cache,
        reconstruction::{reconstruct_positions, PositionFilter},
        replay_builder::build_replay,
        validation::validate_replay_query,
    },
    AppState,
};

pub async fn get_replay(
    Path(position_id): Path<String>,
    State(state): State<AppState>,
    Query(query): Query<ReplayQuery>,
) -> Result<Json<ReplayResponse>, ApiError> {
    validate_replay_query(&query)?;

    let fills = get_fills_with_cache(
        &state.db,
        &state.client,
        &query.wallet,
        query.from,
        query.to,
    )
    .await
    .map_err(|err| {
        error!(
            "replay fills cache failure wallet={} from={} to={}: {}",
            query.wallet, query.from, query.to, err
        );
        ApiError::internal(err.to_string())
    })?;

    let positions = reconstruct_positions(
        &query.wallet,
        &fills,
        PositionFilter {
            pair: None,
            direction: None,
        },
    );

    let target = positions
        .into_iter()
        .find(|p| p.id == position_id)
        .ok_or_else(|| ApiError::not_found("position_not_found", "position not found"))?;

    let replay = build_replay(
        &state.client,
        target,
        query.pre_ms.unwrap_or(4 * 60 * 60 * 1000),
        query.post_ms.unwrap_or(60 * 60 * 1000),
        query.interval.clone().unwrap_or_else(|| "5m".to_string()),
    )
    .await
    .map_err(|err| {
        error!("replay build failure position_id={}: {}", position_id, err);
        ApiError::internal(err.to_string())
    })?;

    Ok(Json(replay))
}
