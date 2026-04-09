use axum::{
    extract::{Query, State},
    Json,
};

use crate::{
    models::api::{PositionListResponse, PositionsQuery},
    services::reconstruction::{reconstruct_positions, PositionFilter},
    AppState,
};

pub async fn list_positions(
    State(state): State<AppState>,
    Query(query): Query<PositionsQuery>,
) -> Result<Json<PositionListResponse>, (axum::http::StatusCode, String)> {
    if query.from >= query.to {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            "from must be less than to".to_string(),
        ));
    }

    let fills = state
        .client
        .fetch_fills(&query.wallet, query.from, query.to)
        .await
        .map_err(internal_error)?;

    let mut positions = reconstruct_positions(
        &query.wallet,
        &fills,
        PositionFilter {
            pair: query.pair.clone(),
            direction: query.direction.clone(),
        },
    );

    positions.sort_by_key(|p| p.opened_at);
    positions.reverse();

    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(25).clamp(1, 100);
    let total = positions.len();
    let start = (page - 1) * page_size;
    let items = positions.into_iter().skip(start).take(page_size).collect();

    Ok(Json(PositionListResponse {
        items,
        total,
        page,
        page_size,
    }))
}

fn internal_error(err: anyhow::Error) -> (axum::http::StatusCode, String) {
    (
        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
        err.to_string(),
    )
}
