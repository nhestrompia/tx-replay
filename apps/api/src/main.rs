mod models;
mod routes;
mod services;

use std::{env, net::SocketAddr, sync::Arc};

use axum::Router;
use services::hyperliquid_client::HyperliquidClient;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::info;

#[derive(Clone)]
pub struct AppState {
    pub client: Arc<HyperliquidClient>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,hyperliquid_position_replayer_api=debug".into()),
        )
        .init();

    let port = env::var("API_PORT")
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
        .unwrap_or(8080);

    let base_url = env::var("HYPERLIQUID_BASE_URL")
        .unwrap_or_else(|_| "https://api.hyperliquid.xyz/info".to_string());

    let state = AppState {
        client: Arc::new(HyperliquidClient::new(base_url)),
    };

    let app = Router::new()
        .merge(routes::router())
        .with_state(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("API listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
