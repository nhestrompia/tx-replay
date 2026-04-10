"use client"

import { useMemo } from "react"
import { Liveline } from "liveline"

import { formatAxisTime } from "@/lib/format"
import { Candle } from "@/lib/types"

type ReplayChartProps = {
  candles: Candle[]
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

export function ReplayChart({ candles, cursor, replayStart, replayEnd }: ReplayChartProps) {
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

  const latestClose = ordered[ordered.length - 1]?.close ?? 0
  const chartWindowSeconds = Math.max(60, Math.ceil((replayEnd - replayStart) / 1000))
  const candleWidth = inferCandleWidthSeconds(ordered)
  const tfLabel = timeframeLabel(candleWidth)
  const includeDateInAxis = chartWindowSeconds >= 24 * 60 * 60
  const replayEndSec = Math.floor(replayEnd / 1000)
  const timeOffsetSec = useMemo(
    () => Math.floor(Date.now() / 1000) - replayEndSec,
    [replayEndSec]
  )
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

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-lg border bg-white">
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
        />
      </div>
      <div
        className="pointer-events-none absolute inset-2 bg-white/55"
        style={{ left: `calc(${revealLeftPercent} + 8px)` }}
      />
      <div className="pointer-events-none absolute left-3 top-3 rounded bg-slate-900/80 px-2 py-1 text-[11px] font-medium text-white">
        {tfLabel} candles
      </div>

    </div>
  )
}
