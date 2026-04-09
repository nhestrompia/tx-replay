use axum::{
    extract::{Path, Query, State},
    Json,
};

use crate::{
    models::api::{ReplayQuery, ReplayResponse},
    services::{
        reconstruction::{reconstruct_positions, PositionFilter},
        replay_builder::build_replay,
    },
    AppState,
};

pub async fn get_replay(
    Path(position_id): Path<String>,
    State(state): State<AppState>,
    Query(query): Query<ReplayQuery>,
) -> Result<Json<ReplayResponse>, (axum::http::StatusCode, String)> {
    let fills = state
        .client
        .fetch_fills(&query.wallet, query.from, query.to)
        .await
        .map_err(internal_error)?;

    let positions = reconstruct_positions(
        &query.wallet,
        &fills,
        PositionFilter {
            pair: None,
            direction: None,
        },
    );

    let target = positions.into_iter().find(|p| p.id == position_id).ok_or((
        axum::http::StatusCode::NOT_FOUND,
        "position not found".to_string(),
    ))?;

    let replay = build_replay(
        &state.client,
        target,
        query.pre_ms.unwrap_or(4 * 60 * 60 * 1000),
        query.post_ms.unwrap_or(60 * 60 * 1000),
        query.interval.clone().unwrap_or_else(|| "5m".to_string()),
    )
    .await
    .map_err(internal_error)?;

    Ok(Json(replay))
}

fn internal_error(err: anyhow::Error) -> (axum::http::StatusCode, String) {
    (
        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
        err.to_string(),
    )
}
