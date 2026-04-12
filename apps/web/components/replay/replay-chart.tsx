"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Liveline } from "liveline"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  formatAxisTime,
  formatDateShort,
  formatDuration,
  formatPnlWithUnit,
  formatPriceWithUnit,
  formatSizeWithUnit,
  quoteCurrencyFromPair
} from "@/lib/format"
import { Candle, ReplayEvent } from "@/lib/types"

type ReplayChartProps = {
  candles: Candle[]
  events: ReplayEvent[]
  cursor: number
  replayStart: number
  replayEnd: number
  pair: string
  pnl: number
  pnlStatus: "pre_open" | "open" | "closed"
}

const PLOT_PADDING = {
  top: 12,
  right: 80,
  bottom: 28,
  left: 12
}

const ZOOM_PERCENTS = [25, 50, 75, 100]

type EventCluster = {
  key: string
  events: ReplayEvent[]
  label: string
  tone: "default" | "green" | "red"
  ts: number
  price: number
}

function toLivelineCandle(candle: Candle, offsetSec: number) {
  return {
    time: Math.floor(candle.timestamp / 1000) + offsetSec,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close
  }
}

function inferCandleWidthSeconds(candles: Candle[]): number {
  if (candles.length < 2) {
    return 60
  }

  let minDiffMs = Number.MAX_SAFE_INTEGER
  for (let index = 1; index < candles.length; index += 1) {
    const diff = candles[index].timestamp - candles[index - 1].timestamp
    if (diff > 0 && diff < minDiffMs) {
      minDiffMs = diff
    }
  }

  if (!Number.isFinite(minDiffMs) || minDiffMs <= 0 || minDiffMs === Number.MAX_SAFE_INTEGER) {
    return 60
  }
  return Math.max(1, Math.round(minDiffMs / 1000))
}

function timeframeLabel(seconds: number): string {
  const presets = [
    60, 180, 300, 900, 1800, 3600, 7200, 14_400, 28_800, 43_200, 86_400
  ]
  let best = presets[0]
  let bestDiff = Math.abs(seconds - best)
  for (const preset of presets) {
    const diff = Math.abs(seconds - preset)
    if (diff < bestDiff) {
      best = preset
      bestDiff = diff
    }
  }

  if (best >= 3600) {
    return `${Math.round(best / 3600)}h`
  }
  return `${Math.round(best / 60)}m`
}

function eventShortLabel(type: ReplayEvent["event_type"]): string {
  if (type === "entry") {
    return "E"
  }
  if (type === "add") {
    return "A"
  }
  if (type === "partial_close") {
    return "P"
  }
  return "F"
}

function eventLabel(type: ReplayEvent["event_type"]): string {
  if (type === "entry") {
    return "Entry"
  }
  if (type === "add") {
    return "Scale In"
  }
  if (type === "partial_close") {
    return "Partial Close"
  }
  return "Full Close"
}

function clusterTone(events: ReplayEvent[]): "default" | "green" | "red" {
  if (events.some((event) => event.event_type === "full_close")) {
    return "red"
  }
  if (events.every((event) => event.event_type === "entry" || event.event_type === "add")) {
    return "green"
  }
  return "default"
}

function summarizeEventTypes(events: ReplayEvent[]): string {
  const counts = new Map<ReplayEvent["event_type"], number>()
  for (const event of events) {
    counts.set(event.event_type, (counts.get(event.event_type) ?? 0) + 1)
  }

  const order: ReplayEvent["event_type"][] = ["entry", "add", "partial_close", "full_close"]
  return order
    .filter((type) => (counts.get(type) ?? 0) > 0)
    .map((type) => `${eventShortLabel(type)}×${counts.get(type)}`)
    .join(" ")
}

function alignDown(value: number, step: number): number {
  return value - (value % step)
}

function buildEventFallbackCandles(
  events: ReplayEvent[],
  replayStart: number,
  replayEnd: number,
  bucketMs = 60_000
): Candle[] {
  if (events.length === 0 || replayStart > replayEnd) {
    return []
  }

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp)
  let index = 0
  let price = sorted[0]?.fill_price ?? 0
  if (!Number.isFinite(price) || price <= 0) {
    return []
  }

  const out: Candle[] = []
  let bucketStart = alignDown(replayStart, bucketMs)
  const bucketEnd = alignDown(replayEnd, bucketMs)

  while (bucketStart <= bucketEnd) {
    const nextBucket = bucketStart + bucketMs
    const open = price
    let high = price
    let low = price
    let close = price
    let volume = 0

    while (index < sorted.length && sorted[index].timestamp < nextBucket) {
      const event = sorted[index]
      if (event.timestamp >= bucketStart) {
        high = Math.max(high, event.fill_price)
        low = Math.min(low, event.fill_price)
        close = event.fill_price
        volume += event.fill_size
      }
      index += 1
    }

    out.push({
      timestamp: bucketStart,
      open,
      high,
      low,
      close,
      volume
    })
    price = close
    bucketStart = nextBucket
  }

  return out
}

export function ReplayChart({
  candles,
  events,
  cursor,
  replayStart,
  replayEnd,
  pair,
  pnl,
  pnlStatus
}: ReplayChartProps) {
  const [zoomPercent, setZoomPercent] = useState(100)
  const [hoveredClusterKey, setHoveredClusterKey] = useState<string | null>(null)
  const chartNowSecRef = useRef<number>(Math.floor(Date.now() / 1000))

  const orderedEvents = useMemo(
    () => [...events].sort((a, b) => a.timestamp - b.timestamp),
    [events]
  )
  const ordered = useMemo(() => {
    const sorted = [...candles]
      .filter(
        (candle) =>
          Number.isFinite(candle.open) &&
          Number.isFinite(candle.high) &&
          Number.isFinite(candle.low) &&
          Number.isFinite(candle.close) &&
          candle.high > 0 &&
          candle.low > 0
      )
      .sort((a, b) => a.timestamp - b.timestamp)

    if (sorted.length > 0) {
      return sorted
    }

    return buildEventFallbackCandles(orderedEvents, replayStart, replayEnd)
  }, [candles, orderedEvents, replayStart, replayEnd])

  const hasCandles = ordered.length > 0
  const latestClose = ordered[ordered.length - 1]?.close ?? 0
  const candleWidth = inferCandleWidthSeconds(ordered)
  const replayWindowSeconds = Math.max(60, Math.ceil((replayEnd - replayStart) / 1000))
  const candleWindowSeconds = ordered.length > 1
    ? Math.max(
        candleWidth,
        Math.ceil((ordered[ordered.length - 1].timestamp - ordered[0].timestamp) / 1000) +
        candleWidth
      )
    : Math.max(60, candleWidth * 2)
  const fullWindowSeconds = Math.max(replayWindowSeconds, candleWindowSeconds)
  const minZoomWindowSeconds = Math.max(60, candleWidth * 4)
  const isZoomAllowed = (percent: number) =>
    percent === 100 || fullWindowSeconds * (percent / 100) >= minZoomWindowSeconds

  useEffect(() => {
    if (!isZoomAllowed(zoomPercent)) {
      setZoomPercent(100)
    }
  }, [zoomPercent, fullWindowSeconds, minZoomWindowSeconds])

  const requestedWindow = Math.round(fullWindowSeconds * (zoomPercent / 100))
  const chartWindowSeconds = zoomPercent === 100
    ? fullWindowSeconds
    : Math.min(fullWindowSeconds, Math.max(minZoomWindowSeconds, requestedWindow))

  const tfLabel = timeframeLabel(candleWidth)
  const includeDateInAxis = chartWindowSeconds >= 24 * 60 * 60
  const replayEndSec = Math.floor(replayEnd / 1000)
  const timeOffsetSec = chartNowSecRef.current - replayEndSec
  const progress = Math.max(
    0,
    Math.min(1, (cursor - replayStart) / Math.max(1, replayEnd - replayStart))
  )
  const revealLeftPercent = `${(progress * 100).toFixed(4)}%`

  let chartCandles = ordered.map((candle) => toLivelineCandle(candle, timeOffsetSec))
  if (chartCandles.length === 1) {
    const only = chartCandles[0]
    chartCandles = [
      { ...only, time: only.time - candleWidth, close: only.open, high: only.open, low: only.open },
      only
    ]
  }

  const lineData = chartCandles.map((candle) => ({
    time: candle.time,
    value: candle.close
  }))
  const formatTime = (t: number) => formatAxisTime(t - timeOffsetSec, includeDateInAxis)
  const windowLabel = formatDuration((replayEnd - replayStart))
  const activityLabel = orderedEvents.length > 1
    ? formatDuration(orderedEvents[orderedEvents.length - 1].timestamp - orderedEvents[0].timestamp)
    : "0m"
  const quote = quoteCurrencyFromPair(pair)
  const pnlToneClass =
    pnlStatus === "pre_open"
      ? "text-muted-foreground"
      : pnl >= 0
        ? "text-emerald-700"
        : "text-rose-700"
  const pnlText = pnlStatus === "pre_open" ? "--" : formatPnlWithUnit(pnl, quote, 3)

  const occurredEvents = useMemo(
    () => orderedEvents.filter((event) => event.timestamp <= cursor),
    [orderedEvents, cursor]
  )
  const clusterBucketMs = Math.max(30_000, candleWidth * 1000)

  const clusters = useMemo<EventCluster[]>(() => {
    const grouped = new Map<number, ReplayEvent[]>()
    for (const event of occurredEvents) {
      const key = Math.floor((event.timestamp - replayStart) / clusterBucketMs)
      const list = grouped.get(key) ?? []
      list.push(event)
      grouped.set(key, list)
    }

    return [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([bucket, clusterEvents]) => {
        const ts = Math.round(
          clusterEvents.reduce((acc, event) => acc + event.timestamp, 0) /
          Math.max(1, clusterEvents.length)
        )

        return {
          key: `cluster-${bucket}`,
          events: clusterEvents,
          label:
            clusterEvents.length === 1
              ? eventShortLabel(clusterEvents[0].event_type)
              : String(clusterEvents.length),
          tone: clusterTone(clusterEvents),
          ts,
          price:
            clusterEvents.reduce((acc, event) => acc + event.fill_price, 0) /
            Math.max(1, clusterEvents.length)
        }
      })
  }, [occurredEvents, replayStart, clusterBucketMs])

  const visibleClusters = useMemo(() => {
    if (!hasCandles || chartCandles.length === 0) {
      return []
    }

    const rightEdgeSec = chartCandles[chartCandles.length - 1].time
    const leftEdgeSec = rightEdgeSec - chartWindowSeconds
    const visibleCandles = chartCandles.filter((candle) => candle.time >= leftEdgeSec && candle.time <= rightEdgeSec)
    const scope = visibleCandles.length > 0 ? visibleCandles : chartCandles
    const scopeTimes = scope.map((candle) => candle.time).sort((a, b) => a - b)
    if (scopeTimes.length === 0) {
      return []
    }
    const minPrice = Math.min(...scope.map((candle) => candle.low))
    const maxPrice = Math.max(...scope.map((candle) => candle.high))
    const priceSpan = Math.max(1e-9, maxPrice - minPrice)
    const laneByXBucket = new Map<number, number>()
    const chartSpan = Math.max(1, rightEdgeSec - leftEdgeSec)

    return clusters
      .map((cluster) => {
        const shiftedTsSec = Math.floor(cluster.ts / 1000) + timeOffsetSec
        const xRaw = (shiftedTsSec - leftEdgeSec) / chartSpan
        if (xRaw < 0 || xRaw > 1) {
          return null
        }
        const nearestCandleTime = scopeTimes.reduce((best, candidate) => {
          return Math.abs(candidate - shiftedTsSec) < Math.abs(best - shiftedTsSec) ? candidate : best
        }, scopeTimes[0])
        const x = (nearestCandleTime - leftEdgeSec) / chartSpan
        const yValue = (cluster.price - minPrice) / priceSpan
        const y = 1 - Math.max(0, Math.min(1, yValue))
        return { ...cluster, x, y }
      })
      .filter((cluster): cluster is EventCluster & { x: number; y: number } => cluster !== null && cluster.x >= 0 && cluster.x <= 1)
      .map((cluster) => {
        const xBucket = Math.round(cluster.x * 180)
        const lane = laneByXBucket.get(xBucket) ?? 0
        laneByXBucket.set(xBucket, lane + 1)
        return { ...cluster, lane }
      })
  }, [clusters, chartWindowSeconds, timeOffsetSec, chartCandles, hasCandles])

  return (
    <div
      className="relative h-[420px] w-full overflow-hidden rounded-lg border bg-white"
      onMouseLeave={() => setHoveredClusterKey(null)}
    >
      <div className="absolute left-3 top-3 z-30 text-xs font-medium text-muted-foreground">
        <p>{tfLabel}</p>
        <p className="text-[10px] font-normal text-muted-foreground/80">
          Window {windowLabel} · Active {activityLabel}
        </p>
        <p className="text-[10px] font-normal text-muted-foreground/80">Price ({quote})</p>
      </div>
      <div className="absolute left-1/2 top-3 z-30 -translate-x-1/2 text-xs font-semibold">
        <span className={pnlToneClass}>
          PnL {pnlStatus === "closed" ? "(Final)" : "(Live)"} {pnlText}
        </span>
      </div>
      <div className="absolute right-3 top-3 z-30 flex items-center gap-1">
        {ZOOM_PERCENTS.map((percent) => (
          <Button
            key={percent}
            size="sm"
            variant={zoomPercent === percent ? "default" : "secondary"}
            onClick={() => setZoomPercent(percent)}
            className="h-7 px-2 text-xs"
            disabled={!isZoomAllowed(percent)}
          >
            {percent}%
          </Button>
        ))}
      </div>

      {hasCandles ? (
        <>
          <div className="absolute inset-0 p-2">
            <Liveline
              data={lineData}
              value={latestClose}
              mode="candle"
              candles={chartCandles}
              candleWidth={candleWidth}
              window={chartWindowSeconds}
              theme="light"
              color="#1985A1"
              grid
              scrub={false}
              pulse={false}
              lineMode={false}
              formatTime={formatTime}
              padding={PLOT_PADDING}
            />
          </div>

          <div
            className="pointer-events-none absolute inset-2 bg-white/55"
            style={{
              left: `calc(${revealLeftPercent} + 8px)`,
              right: `${PLOT_PADDING.right + 8}px`
            }}
          />

          <div className="absolute inset-2 z-30 pointer-events-none">
            <div
              className="absolute"
              style={{
                left: `${PLOT_PADDING.left}px`,
                right: `${PLOT_PADDING.right}px`,
                top: `${PLOT_PADDING.top}px`,
                bottom: `${PLOT_PADDING.bottom}px`
              }}
            >
              {visibleClusters.map((cluster) => (
                <div
                  key={cluster.key}
                  className="absolute pointer-events-auto"
                  style={{
                    left: `${(cluster.x * 100).toFixed(4)}%`,
                    top: `${(cluster.y * 100).toFixed(4)}%`,
                    transform: `translate(-50%, calc(-50% - ${cluster.lane * 14}px))`
                  }}
                  onMouseEnter={() => setHoveredClusterKey(cluster.key)}
                  onMouseLeave={() => setHoveredClusterKey(null)}
                >
                  <Badge tone={cluster.tone}>{cluster.label}</Badge>
                  {hoveredClusterKey === cluster.key ? (
                    <div
                      className="absolute z-40 w-[280px]"
                      style={
                        cluster.x > 0.66
                          ? { right: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" }
                          : { left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" }
                      }
                    >
                      <Card className="bg-white/95 shadow-sm">
                        <CardContent className="space-y-1 p-3 text-xs">
                          <p className="font-semibold">
                            {cluster.events.length} event{cluster.events.length > 1 ? "s" : ""}
                          </p>
                          <p className="text-muted-foreground">{formatDateShort(cluster.ts)}</p>
                          <p>{summarizeEventTypes(cluster.events)}</p>
                          <div
                            className="max-h-32 space-y-1 overflow-auto pr-1"
                            onWheel={(event) => {
                              event.stopPropagation()
                            }}
                          >
                            {cluster.events.map((event, index) => (
                              <p key={`${event.timestamp}-${index}`}>
                                {eventLabel(event.event_type)} · {formatSizeWithUnit(event.fill_size, pair, 4)} @ {formatPriceWithUnit(event.fill_price, quote, 2)}
                              </p>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-sm text-muted-foreground">
          No market candle data returned for this replay window.
        </div>
      )}
    </div>
  )
}
