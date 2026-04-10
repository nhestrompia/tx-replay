"use client"

import { useMemo } from "react"
import { Liveline } from "liveline"

import { formatAxisTime } from "@/lib/format"
import { Candle, ReplayEvent } from "@/lib/types"

type ReplayChartProps = {
  candles: Candle[]
  events: ReplayEvent[]
  cursor: number
  replayStart: number
  replayEnd: number
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
    return 300
  }

  let minDiffMs = Number.MAX_SAFE_INTEGER
  for (let index = 1; index < candles.length; index += 1) {
    const diff = candles[index].timestamp - candles[index - 1].timestamp
    if (diff > 0 && diff < minDiffMs) {
      minDiffMs = diff
    }
  }

  if (!Number.isFinite(minDiffMs) || minDiffMs <= 0 || minDiffMs === Number.MAX_SAFE_INTEGER) {
    return 300
  }
  return Math.max(1, Math.round(minDiffMs / 1000))
}

export function ReplayChart({ candles, events, cursor, replayStart, replayEnd }: ReplayChartProps) {
  const ordered = useMemo(
    () => [...candles].sort((a, b) => a.timestamp - b.timestamp),
    [candles]
  )
  if (!ordered.length) {
    return (
      <div className="relative h-[420px] w-full overflow-hidden rounded-lg border bg-white">
        <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
          No market candle data returned for this replay window.
        </div>
      </div>
    )
  }

  let live = ordered[0]
  for (const candle of ordered) {
    if (candle.timestamp <= cursor) {
      live = candle
    } else {
      break
    }
  }
  const chartWindowSeconds = Math.max(60, Math.ceil((replayEnd - replayStart) / 1000))
  const candleWidth = inferCandleWidthSeconds(ordered)
  const includeDateInAxis = chartWindowSeconds >= 24 * 60 * 60
  const replayEndSec = Math.floor(replayEnd / 1000)
  const timeOffsetSec = useMemo(
    () => Math.floor(Date.now() / 1000) - replayEndSec,
    [replayEndSec]
  )

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
  const liveCandle = live ? toLivelineCandle(live, timeOffsetSec) : undefined

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-lg border bg-white">
      <div className="absolute inset-0 p-2">
        <Liveline
          data={lineData}
          value={live?.close ?? 0}
          mode="candle"
          candles={chartCandles}
          liveCandle={liveCandle}
          candleWidth={candleWidth}
          window={chartWindowSeconds}
          theme="light"
          color="#1985A1"
          grid
          scrub
          lineMode={false}
          formatTime={(t) => formatAxisTime(t - timeOffsetSec, includeDateInAxis)}
        />
      </div>

      <div className="pointer-events-none absolute bottom-1 left-0 right-0 h-4">
        {events.map((event, idx) => {
          const left = ((event.timestamp - replayStart) / (replayEnd - replayStart || 1)) * 100
          const color =
            event.event_type === "entry"
              ? "bg-sky-500"
              : event.event_type === "add"
                ? "bg-emerald-500"
                : event.event_type === "partial_close"
                  ? "bg-amber-500"
                  : "bg-rose-500"

          const opacity = event.timestamp <= cursor ? "opacity-100" : "opacity-35"

          return (
            <span
              key={`${event.timestamp}-${idx}`}
              className={`absolute top-0 h-3 w-0.5 ${color} ${opacity}`}
              style={{ left: `${left}%` }}
            />
          )
        })}
      </div>
    </div>
  )
}
