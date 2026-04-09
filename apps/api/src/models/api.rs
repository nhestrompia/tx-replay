use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fill {
    pub wallet: String,
    pub pair: String,
    pub side: String,
    pub price: f64,
    pub size: f64,
    pub timestamp: i64,
    pub fee: f64,
    pub dir: Option<String>,
    pub trade_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PositionDirection {
    Long,
    Short,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReplayEventType {
    Entry,
    Add,
    PartialClose,
    FullClose,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplayEvent {
    pub timestamp: i64,
    pub event_type: ReplayEventType,
    pub fill_price: f64,
    pub fill_size: f64,
    pub net_size_after: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub id: String,
    pub wallet: String,
    pub pair: String,
    pub direction: PositionDirection,
    pub opened_at: i64,
    pub closed_at: i64,
    pub fills: Vec<Fill>,
    pub events: Vec<ReplayEvent>,
    pub max_size: f64,
    pub avg_entry: f64,
    pub avg_exit: f64,
    pub realized_pnl: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Candle {
    pub timestamp: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FundingPoint {
    pub timestamp: i64,
    pub rate: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PositionListResponse {
    pub items: Vec<Position>,
    pub total: usize,
    pub page: usize,
    pub page_size: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayResponse {
    pub position: Position,
    pub events: Vec<ReplayEvent>,
    pub candles: Vec<Candle>,
    pub funding: Vec<FundingPoint>,
    pub replay_start: i64,
    pub replay_end: i64,
}

#[derive(Debug, Deserialize)]
pub struct PositionsQuery {
    pub wallet: String,
    pub from: i64,
    pub to: i64,
    pub pair: Option<String>,
    pub direction: Option<String>,
    pub page: Option<usize>,
    pub page_size: Option<usize>,
}

#[derive(Debug, Deserialize)]
pub struct ReplayQuery {
    pub wallet: String,
    pub from: i64,
    pub to: i64,
    pub pre_ms: Option<i64>,
    pub post_ms: Option<i64>,
    pub interval: Option<String>,
}
