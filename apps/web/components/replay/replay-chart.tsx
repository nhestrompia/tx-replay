"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Liveline } from "liveline"
import { CandlestickChart, ChartLine } from "lucide-react"

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
import { cn } from "@/lib/cn"
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
const LIVELINE_BASE_BUFFER_RATIO = 0.05
const LIVELINE_MOMENTUM_BUFFER_PIXELS = 37

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

function padCandlesToReplayWindow(candles: Candle[], replayStart: number, replayEnd: number): Candle[] {
  if (candles.length === 0) {
    return candles
  }

  const stepSec = inferCandleWidthSeconds(candles)
  const stepMs = Math.max(1_000, stepSec * 1000)
  const first = candles[0]
  const seedPrice = first.open > 0 ? first.open : first.close
  if (!Number.isFinite(seedPrice) || seedPrice <= 0) {
    return candles
  }

  let padded = candles
  if (replayStart < first.timestamp) {
    const leftPadding: Candle[] = []
    for (let timestamp = first.timestamp - stepMs; timestamp > replayStart; timestamp -= stepMs) {
      leftPadding.unshift({
        timestamp,
        open: seedPrice,
        high: seedPrice,
        low: seedPrice,
        close: seedPrice,
        volume: 0
      })
    }
    leftPadding.unshift({
      timestamp: replayStart,
      open: seedPrice,
      high: seedPrice,
      low: seedPrice,
      close: seedPrice,
      volume: 0
    })
    padded = [...leftPadding, ...padded]
  }

  const last = padded[padded.length - 1]
  const tailPrice = last.close > 0 ? last.close : last.open
  if (!Number.isFinite(tailPrice) || tailPrice <= 0) {
    return padded
  }

  if (replayEnd > last.timestamp) {
    const rightPadding: Candle[] = []
    for (let timestamp = last.timestamp + stepMs; timestamp < replayEnd; timestamp += stepMs) {
      rightPadding.push({
        timestamp,
        open: tailPrice,
        high: tailPrice,
        low: tailPrice,
        close: tailPrice,
        volume: 0
      })
    }
    rightPadding.push({
      timestamp: replayEnd,
      open: tailPrice,
      high: tailPrice,
      low: tailPrice,
      close: tailPrice,
      volume: 0
    })
    padded = [...padded, ...rightPadding]
  }

  return padded
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
  const chartRef = useRef<HTMLDivElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [zoomPercent, setZoomPercent] = useState(100)
  const [chartStyle, setChartStyle] = useState<"line" | "candles">("line")
  const [hoveredClusterKey, setHoveredClusterKey] = useState<string | null>(null)
  const [hoverPoint, setHoverPoint] = useState<{ time: number; value: number } | null>(null)
  const [tooltipAnchor, setTooltipAnchor] = useState<{ x: number; y: number } | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(null)
  const [chartWidthPx, setChartWidthPx] = useState(1600)
  const chartNowSecRef = useRef<number>(Math.floor(Date.now() / 1000))
  const closeTooltipTimerRef = useRef<number | null>(null)

  const orderedEvents = useMemo(
    () => [...events].sort((a, b) => a.timestamp - b.timestamp),
    [events]
  )
  const ordered = useMemo(() => {
    const sortedCandles = [...candles]
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

    if (sortedCandles.length > 0) {
      return padCandlesToReplayWindow(sortedCandles, replayStart, replayEnd)
    }

    const fallback = buildEventFallbackCandles(orderedEvents, replayStart, replayEnd)
    return padCandlesToReplayWindow(fallback, replayStart, replayEnd)
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
    if (!chartRef.current) {
      return
    }

    const node = chartRef.current
    const updateSize = () => setChartWidthPx(node.getBoundingClientRect().width)
    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isZoomAllowed(zoomPercent)) {
      setZoomPercent(100)
    }
  }, [zoomPercent, fullWindowSeconds, minZoomWindowSeconds])

  const requestedWindow = Math.round(fullWindowSeconds * (zoomPercent / 100))
  const chartWindowSeconds = zoomPercent === 100
    ? fullWindowSeconds
    : Math.min(fullWindowSeconds, Math.max(minZoomWindowSeconds, requestedWindow))
  const chartInnerWidthPx = Math.max(1, chartWidthPx - (PLOT_PADDING.left + PLOT_PADDING.right))
  const livelineBufferRatio = Math.max(
    LIVELINE_BASE_BUFFER_RATIO,
    LIVELINE_MOMENTUM_BUFFER_PIXELS / chartInnerWidthPx
  )
  const visibleWindowSeconds = chartStyle === "candles"
    ? chartWindowSeconds + candleWidth
    : chartWindowSeconds
  const livelineWindowSeconds = Math.max(
    60,
    Math.ceil(visibleWindowSeconds / (1 - livelineBufferRatio))
  )
  const edgeGuardSeconds = Math.max(
    candleWidth,
    Math.ceil(livelineWindowSeconds * livelineBufferRatio)
  )

  const tfLabel = timeframeLabel(candleWidth)
  const includeDateInAxis = chartWindowSeconds >= 24 * 60 * 60
  const replayEndSec = Math.floor(replayEnd / 1000)
  const timeOffsetSec = chartNowSecRef.current - replayEndSec
  const progress = Math.max(
    0,
    Math.min(1, (cursor - replayStart) / Math.max(1, replayEnd - replayStart))
  )
  const revealLeftPercent = `${(progress * 100).toFixed(4)}%`

  const baseChartCandles = ordered.map((candle) => toLivelineCandle(candle, timeOffsetSec))
  const lineRenderData = baseChartCandles.length > 0
    ? [
        {
          time: baseChartCandles[0].time - edgeGuardSeconds,
          value: baseChartCandles[0].close
        },
        ...baseChartCandles.map((candle) => ({ time: candle.time, value: candle.close })),
        {
          time: baseChartCandles[baseChartCandles.length - 1].time + edgeGuardSeconds,
          value: baseChartCandles[baseChartCandles.length - 1].close
        }
      ]
    : []

  const candleRenderData = baseChartCandles.length > 0
    ? [
        {
          ...baseChartCandles[0],
          time: baseChartCandles[0].time - edgeGuardSeconds,
          close: baseChartCandles[0].open,
          high: baseChartCandles[0].open,
          low: baseChartCandles[0].open
        },
        ...baseChartCandles,
        {
          ...baseChartCandles[baseChartCandles.length - 1],
          time: baseChartCandles[baseChartCandles.length - 1].time + edgeGuardSeconds,
          close: baseChartCandles[baseChartCandles.length - 1].close,
          high: baseChartCandles[baseChartCandles.length - 1].close,
          low: baseChartCandles[baseChartCandles.length - 1].close
        }
      ]
    : []

  const lineData = lineRenderData.map((point) => ({
    time: point.time,
    value: point.value
  }))

  const hoverSnapData = baseChartCandles.map((candle) => ({
    time: candle.time,
    value: candle.close
  }))
  const findNearestLinePoint = (targetTime: number) => {
    if (hoverSnapData.length === 0) {
      return null
    }
    return hoverSnapData.reduce((best, candidate) => {
      return Math.abs(candidate.time - targetTime) < Math.abs(best.time - targetTime) ? candidate : best
    }, hoverSnapData[0])
  }
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
        ? "text-emerald-300"
        : "text-rose-300"
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
    if (!hasCandles || baseChartCandles.length === 0) {
      return []
    }

    const rightEdgeSec = baseChartCandles[baseChartCandles.length - 1].time
    const leftEdgeSec = rightEdgeSec - visibleWindowSeconds
    const visibleCandles = baseChartCandles.filter((candle) => candle.time >= leftEdgeSec && candle.time <= rightEdgeSec)
    const scope = visibleCandles.length > 0 ? visibleCandles : baseChartCandles
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
        const y = chartStyle === "line"
          ? 0.9
          : 1 - Math.max(0, Math.min(1, yValue))
        return {
          ...cluster,
          x: Math.max(chartStyle === "line" ? 0.03 : 0.04, Math.min(chartStyle === "line" ? 0.96 : 0.94, x)),
          y
        }
      })
      .filter((cluster): cluster is EventCluster & { x: number; y: number } => cluster !== null && cluster.x >= 0 && cluster.x <= 1)
      .map((cluster) => {
        const xBucket = Math.round(cluster.x * 180)
        const lane = laneByXBucket.get(xBucket) ?? 0
        laneByXBucket.set(xBucket, lane + 1)
        return { ...cluster, lane }
      })
  }, [clusters, visibleWindowSeconds, timeOffsetSec, baseChartCandles, hasCandles, chartStyle])

  const hoveredCluster = hoveredClusterKey
    ? (visibleClusters.find((cluster) => cluster.key === hoveredClusterKey) ?? null)
    : null

  const positionTooltip = () => {
    if (!hoveredCluster || !chartRef.current || !tooltipRef.current) {
      return
    }

    const chartRect = chartRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const inset = 8

    const plotLeft = inset + PLOT_PADDING.left
    const plotRight = chartRect.width - (inset + PLOT_PADDING.right)
    const plotTop = inset + PLOT_PADDING.top
    const plotBottom = chartRect.height - (inset + PLOT_PADDING.bottom)

    const fallbackX = plotLeft + hoveredCluster.x * Math.max(1, plotRight - plotLeft)
    const fallbackY = plotTop + hoveredCluster.y * Math.max(1, plotBottom - plotTop)
    const anchorX = tooltipAnchor?.x ?? fallbackX
    const anchorY = tooltipAnchor?.y ?? fallbackY

    const preferLeft = anchorX > chartRect.width * 0.62
    let left = preferLeft ? anchorX - tooltipRect.width - 14 : anchorX + 14
    let top = anchorY - tooltipRect.height * 0.5

    left = Math.max(inset, Math.min(chartRect.width - tooltipRect.width - inset, left))
    top = Math.max(54, Math.min(chartRect.height - tooltipRect.height - inset, top))

    setTooltipPosition({ left, top })
  }

  const clearTooltipCloseTimer = () => {
    if (closeTooltipTimerRef.current !== null) {
      window.clearTimeout(closeTooltipTimerRef.current)
      closeTooltipTimerRef.current = null
    }
  }

  const scheduleTooltipClose = () => {
    clearTooltipCloseTimer()
    closeTooltipTimerRef.current = window.setTimeout(() => {
      setHoveredClusterKey(null)
      closeTooltipTimerRef.current = null
    }, 140)
  }

  useEffect(() => {
    return () => {
      clearTooltipCloseTimer()
    }
  }, [])

  useEffect(() => {
    if (!hoveredCluster) {
      setTooltipPosition(null)
      return
    }
    positionTooltip()
    const onResize = () => positionTooltip()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [hoveredCluster?.key, hoveredCluster?.x, hoveredCluster?.y, tooltipAnchor?.x, tooltipAnchor?.y])

  return (
    <div
      ref={chartRef}
      className="relative h-[420px] w-full overflow-hidden rounded-2xl border border-border/80 bg-card/95"
      onMouseLeave={() => {
        clearTooltipCloseTimer()
        setHoveredClusterKey(null)
        setHoverPoint(null)
      }}
    >
      <div className="absolute left-3 top-3 z-30 text-xs font-medium text-muted-foreground">
        <div className="mb-1 flex items-center gap-2">
          <span>{tfLabel}</span>
        </div>
        <p className="text-[10px] font-normal text-muted-foreground/80">
          Window {windowLabel} · Active {activityLabel}
        </p>
        <p className="text-[10px] font-normal text-muted-foreground/80">Price ({quote})</p>
        {chartStyle === "line" && hoverPoint ? (
          <p className="text-[10px] font-normal text-foreground/90">
            {formatAxisTime(hoverPoint.time - timeOffsetSec, includeDateInAxis)} · {formatPriceWithUnit(hoverPoint.value, quote, 2)}
          </p>
        ) : null}
      </div>
      <div className="absolute left-1/2 top-3 z-30 -translate-x-1/2 text-xs font-semibold">
        <span className={pnlToneClass}>
          PnL {pnlStatus === "closed" ? "(Final)" : "(Live)"} {pnlText}
        </span>
      </div>
      <div className="absolute right-2.5 top-2.5 z-40 flex items-center gap-1.5">
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-border/70 bg-background/85 p-0.5 shadow-[0_8px_20px_-16px_rgba(0,0,0,0.75)]">
          <button
            type="button"
            onClick={() => setChartStyle("line")}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              chartStyle === "line"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent/45 hover:text-accent-foreground"
            )}
            title="Line chart"
            aria-label="Line chart"
          >
            <ChartLine className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setChartStyle("candles")}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              chartStyle === "candles"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent/45 hover:text-accent-foreground"
            )}
            title="Candlestick chart"
            aria-label="Candlestick chart"
          >
            <CandlestickChart className="h-3.5 w-3.5" />
          </button>
        </div>
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
              mode={chartStyle === "line" ? "line" : "candle"}
              candles={chartStyle === "candles" ? candleRenderData : undefined}
              candleWidth={chartStyle === "candles" ? candleWidth : undefined}
              window={livelineWindowSeconds}
              theme="dark"
              color="#14b8a6"
              grid
              scrub={chartStyle === "line"}
              cursor={chartStyle === "line" ? "crosshair" : "default"}
              pulse={false}
              paused
              lineMode={false}
              formatTime={formatTime}
              onHover={(point) => {
                if (!point) {
                  setHoverPoint(null)
                  return
                }
                const nearest = findNearestLinePoint(point.time)
                if (!nearest) {
                  setHoverPoint(null)
                  return
                }
                setHoverPoint({ time: nearest.time, value: nearest.value })
              }}
              padding={PLOT_PADDING}
            />
          </div>

          <div
            className="pointer-events-none absolute inset-2 bg-background/50"
            style={{
              left: `calc(${revealLeftPercent} + 8px)`,
              right: `${PLOT_PADDING.right + 8}px`
            }}
          />

          <div className="absolute inset-2 z-40 pointer-events-none">
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
                    transform: chartStyle === "line"
                      ? `translate(-50%, calc(-50% - ${cluster.lane * 16}px))`
                      : `translate(-50%, calc(-50% - ${cluster.lane * 14}px))`
                  }}
                  onMouseEnter={() => {
                    if (chartRef.current) {
                      const chartRect = chartRef.current.getBoundingClientRect()
                      const xPx = PLOT_PADDING.left + 8 + (cluster.x * (chartRect.width - (PLOT_PADDING.left + PLOT_PADDING.right + 16)))
                      const yPx = PLOT_PADDING.top + 8 + (cluster.y * (chartRect.height - (PLOT_PADDING.top + PLOT_PADDING.bottom + 16)))
                      setTooltipAnchor({ x: xPx, y: yPx })
                    }
                    clearTooltipCloseTimer()
                    setHoveredClusterKey(cluster.key)
                  }}
                  onMouseLeave={scheduleTooltipClose}
                >
                  {chartStyle === "line" ? (
                    <span
                      className={
                        cluster.tone === "red"
                          ? "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500/30 px-1 text-[11px] font-semibold text-rose-100"
                          : cluster.tone === "green"
                            ? "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500/30 px-1 text-[11px] font-semibold text-emerald-100"
                            : "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-700 px-1 text-[11px] font-semibold text-slate-100"
                      }
                    >
                      {cluster.label}
                    </span>
                  ) : (
                    <Badge tone={cluster.tone}>{cluster.label}</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          {hoveredCluster ? (
            <div
              ref={tooltipRef}
              className="absolute z-50 w-[320px] pointer-events-auto"
              style={tooltipPosition ? { left: tooltipPosition.left, top: tooltipPosition.top } : { left: 8, top: 56 }}
              onMouseEnter={clearTooltipCloseTimer}
              onMouseLeave={scheduleTooltipClose}
            >
              <Card className="bg-card/95 shadow-xl">
                <CardContent className="space-y-2 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {hoveredCluster.events.length} event{hoveredCluster.events.length > 1 ? "s" : ""}
                    </p>
                    <Badge tone={hoveredCluster.tone}>{summarizeEventTypes(hoveredCluster.events)}</Badge>
                  </div>
                  <p className="text-muted-foreground">{formatDateShort(hoveredCluster.ts)}</p>
                  <div
                    className="max-h-56 space-y-1 overflow-y-auto overscroll-contain pr-1"
                    onWheel={(event) => {
                      event.stopPropagation()
                    }}
                  >
                    {hoveredCluster.events.map((event, index) => (
                      <p key={`${event.timestamp}-${index}`}>
                        {eventLabel(event.event_type)} · {formatSizeWithUnit(event.fill_size, pair, 4)} @ {formatPriceWithUnit(event.fill_price, quote, 2)}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-sm text-muted-foreground">
          No market candle data returned for this replay window.
        </div>
      )}
    </div>
  )
}
