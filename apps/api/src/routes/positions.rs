use axum::{
    extract::{Query, State},
    Json,
};
use std::cmp::Ordering;

use crate::{
    models::{
        api::{PositionListResponse, PositionsQuery},
        error::ApiError,
    },
    services::{
        fill_cache::get_fills_with_cache,
        reconstruction::{reconstruct_positions, PositionFilter},
        validation::validate_positions_query,
    },
    AppState,
};

pub async fn list_positions(
    State(state): State<AppState>,
    Query(query): Query<PositionsQuery>,
) -> Result<Json<PositionListResponse>, ApiError> {
    validate_positions_query(&query)?;

    let fills = get_fills_with_cache(
        &state.db,
        &state.client,
        &query.wallet,
        query.from,
        query.to,
    )
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?;

    let mut positions = reconstruct_positions(
        &query.wallet,
        &fills,
        PositionFilter {
            pair: query.pair.clone(),
            direction: query.direction.clone(),
        },
    );

    let sort_by = query
        .sort_by
        .as_deref()
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_else(|| "opened_at".to_string());
    let sort_dir = query
        .sort_dir
        .as_deref()
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_else(|| "desc".to_string());

    positions.sort_by(|a, b| {
        let cmp = match sort_by.as_str() {
            "max_size" => a
                .max_size
                .partial_cmp(&b.max_size)
                .unwrap_or(Ordering::Equal),
            "closed_at" => a.closed_at.cmp(&b.closed_at),
            _ => a.opened_at.cmp(&b.opened_at),
        };
        if sort_dir == "asc" {
            cmp
        } else {
            cmp.reverse()
        }
    });

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
