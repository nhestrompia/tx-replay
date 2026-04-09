use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct HyperliquidFill {
    pub coin: String,
    pub px: String,
    pub sz: String,
    pub side: String,
    pub time: i64,
    pub fee: String,
    pub dir: Option<String>,
    #[serde(rename = "tid")]
    pub trade_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct HyperliquidCandle {
    #[serde(rename = "t")]
    pub start_time: i64,
    #[serde(rename = "o")]
    pub open: String,
    #[serde(rename = "h")]
    pub high: String,
    #[serde(rename = "l")]
    pub low: String,
    #[serde(rename = "c")]
    pub close: String,
    #[serde(rename = "v")]
    pub volume: String,
}

#[derive(Debug, Deserialize)]
pub struct HyperliquidFunding {
    pub coin: Option<String>,
    #[serde(rename = "fundingRate")]
    pub funding_rate: String,
    pub time: i64,
}
