export type Fill = {
  wallet: string
  pair: string
  side: string
  price: number
  size: number
  timestamp: number
  fee: number
  dir?: string | null
  trade_id?: number | null
}

export type ReplayEventType = "entry" | "add" | "partial_close" | "full_close"

export type ReplayEvent = {
  timestamp: number
  event_type: ReplayEventType
  fill_price: number
  fill_size: number
  net_size_after: number
}

export type PositionDirection = "long" | "short"

export type Position = {
  id: string
  wallet: string
  pair: string
  direction: PositionDirection
  opened_at: number
  closed_at: number
  fills: Fill[]
  events: ReplayEvent[]
  max_size: number
  avg_entry: number
  avg_exit: number
  realized_pnl: number
}

export type Candle = {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type FundingPoint = {
  timestamp: number
  rate: number
}

export type PositionListResponse = {
  items: Position[]
  total: number
  page: number
  pageSize: number
}

export type ReplayResponse = {
  position: Position
  events: ReplayEvent[]
  candles: Candle[]
  funding: FundingPoint[]
  replayStart: number
  replayEnd: number
}
