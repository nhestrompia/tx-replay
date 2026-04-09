use axum::{routing::get, Router};

use crate::AppState;

mod positions;
mod replay;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .route("/v1/positions", get(positions::list_positions))
        .route("/v1/replay/{position_id}", get(replay::get_replay))
}

async fn health() -> &'static str {
    "ok"
}
