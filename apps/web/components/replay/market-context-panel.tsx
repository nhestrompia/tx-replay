"use client"

import { ExternalLink } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/cn"
import { formatNumber, formatPriceWithUnit, formatDateShort, quoteCurrencyFromPair, baseAssetFromPair } from "@/lib/format"
import { Candle, FundingPoint, ReplayEvent, PositionDirection } from "@/lib/types"

type MarketContextPanelProps = {
  pair: string
  direction: PositionDirection
  replayStart: number
  replayEnd: number
  activeStart: number
  activeEnd: number
  candles: Candle[]
  funding: FundingPoint[]
  events: ReplayEvent[]
}

function inferCandleStepMs(candles: Candle[]): number {
  if (candles.length < 2) {
    return 60_000
  }

  let minDiff = Number.MAX_SAFE_INTEGER
  for (let index = 1; index < candles.length; index += 1) {
    const diff = candles[index].timestamp - candles[index - 1].timestamp
    if (diff > 0 && diff < minDiff) {
      minDiff = diff
    }
  }

  if (!Number.isFinite(minDiff) || minDiff <= 0 || minDiff === Number.MAX_SAFE_INTEGER) {
    return 60_000
  }
  return minDiff
}

function nearestClose(candles: Candle[], ts: number): number | null {
  if (candles.length === 0) {
    return null
  }

  let best = candles[0]
  let bestDist = Math.abs(candles[0].timestamp - ts)
  for (let index = 1; index < candles.length; index += 1) {
    const dist = Math.abs(candles[index].timestamp - ts)
    if (dist < bestDist) {
      best = candles[index]
      bestDist = dist
    }
  }
  return best.close
}

function signedSizeAt(events: ReplayEvent[], ts: number): number {
  let size = 0
  for (const event of events) {
    if (event.timestamp > ts) {
      break
    }
    size = event.net_size_after
  }
  return size
}

function stdDev(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  const mean = values.reduce((acc, value) => acc + value, 0) / values.length
  const variance = values.reduce((acc, value) => {
    const delta = value - mean
    return acc + delta * delta
  }, 0) / values.length
  return Math.sqrt(variance)
}

export function MarketContextPanel({
  pair,
  direction,
  replayStart,
  replayEnd,
  activeStart,
  activeEnd,
  candles,
  funding,
  events
}: MarketContextPanelProps) {
  const inActiveWindow = (ts: number) => ts >= activeStart && ts <= activeEnd
  const sortedCandles = [...candles]
    .filter((candle) => inActiveWindow(candle.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp)
  const sortedFunding = [...funding]
    .filter((point) => inActiveWindow(point.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp)
  const sortedEvents = [...events]
    .filter((event) => inActiveWindow(event.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp)
  const candlesForStats = sortedCandles.length > 0 ? sortedCandles : [...candles].sort((a, b) => a.timestamp - b.timestamp)
  const fundingForStats = sortedFunding.length > 0 ? sortedFunding : [...funding].sort((a, b) => a.timestamp - b.timestamp)
  const eventsForStats = sortedEvents.length > 0 ? sortedEvents : [...events].sort((a, b) => a.timestamp - b.timestamp)
  const quote = quoteCurrencyFromPair(pair)
  const base = baseAssetFromPair(pair)

  const firstClose = candlesForStats[0]?.close ?? null
  const lastClose = candlesForStats[candlesForStats.length - 1]?.close ?? null
  const priceMovePct = firstClose && lastClose
    ? ((lastClose - firstClose) / Math.max(1e-9, firstClose)) * 100
    : null

  const stepMs = inferCandleStepMs(candlesForStats)
  const barsPerYear = (365 * 24 * 60 * 60 * 1000) / Math.max(1, stepMs)
  const returns: number[] = []
  for (let index = 1; index < candlesForStats.length; index += 1) {
    const prev = candlesForStats[index - 1].close
    const next = candlesForStats[index].close
    if (prev > 0 && next > 0) {
      returns.push(Math.log(next / prev))
    }
  }
  const realizedVolPct = returns.length > 1
    ? stdDev(returns) * Math.sqrt(barsPerYear) * 100
    : null

  const volumes = candlesForStats.map((candle) => candle.volume)
  const latestVolume = volumes[volumes.length - 1] ?? null
  const volumeStd = stdDev(volumes)
  const volumeMean = volumes.length ? volumes.reduce((acc, v) => acc + v, 0) / volumes.length : 0
  const volumeZ = latestVolume !== null && volumeStd > 0
    ? (latestVolume - volumeMean) / volumeStd
    : null

  let fundingPaid = 0
  let fundingReceived = 0
  for (const point of fundingForStats) {
    const size = Math.abs(signedSizeAt(eventsForStats, point.timestamp))
    if (size <= 0) {
      continue
    }

    const price = nearestClose(candlesForStats, point.timestamp)
    if (!price || price <= 0) {
      continue
    }

    const notional = size * price
    const payment = (direction === "long" ? -1 : 1) * notional * point.rate
    if (payment >= 0) {
      fundingReceived += payment
    } else {
      fundingPaid += Math.abs(payment)
    }
  }
  const netFunding = fundingReceived - fundingPaid

  const sinceDate = new Date(activeStart).toISOString().slice(0, 10)
  const untilDate = new Date(activeEnd + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const xQuery = encodeURIComponent(`${base} since:${sinceDate} until:${untilDate}`)
  const xSearchUrl = `https://x.com/search?q=${xQuery}&src=typed_query&f=live`

  return (
    <div className="rounded-2xl border border-border/80 bg-card/90 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">Market Context</h3>

      <div className="space-y-1 text-xs text-foreground/90">
        <p>
          Window: <span className="text-muted-foreground">{formatDateShort(activeStart)} → {formatDateShort(activeEnd)}</span>
        </p>
        <p>
          Replay: <span className="text-muted-foreground">{formatDateShort(replayStart)} → {formatDateShort(replayEnd)}</span>
        </p>
        <p>
          Price move:{" "}
          <strong>
            {priceMovePct === null ? "N/A" : `${formatNumber(priceMovePct, 2)}%`}
          </strong>
        </p>
        <p>
          Realized vol:{" "}
          <strong>
            {realizedVolPct === null ? "N/A" : `${formatNumber(realizedVolPct, 1)}%`}
          </strong>
        </p>
        <p>
          Volume z-score:{" "}
          <strong>
            {volumeZ === null ? "N/A" : formatNumber(volumeZ, 2)}
          </strong>
        </p>
        <p>
          Funding est. net:{" "}
          <strong>{formatPriceWithUnit(netFunding, quote, 3)}</strong>
          {" "}({formatPriceWithUnit(fundingPaid, quote, 3)} paid / {formatPriceWithUnit(fundingReceived, quote, 3)} received)
        </p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <a href={xSearchUrl} target="_blank" rel="noreferrer">
          <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full justify-between")}>
            Search on X
            <ExternalLink className="h-3.5 w-3.5" />
          </span>
        </a>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Order-book history, liquidation timeline, and OI deltas can be added with an archived market-data feed.
      </p>
    </div>
  )
}
