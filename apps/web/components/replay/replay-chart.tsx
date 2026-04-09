"use client"

import { Liveline } from "liveline"

import { Candle, ReplayEvent } from "@/lib/types"

type ReplayChartProps = {
  candles: Candle[]
  events: ReplayEvent[]
  cursor: number
  replayStart: number
  replayEnd: number
}

function toLivelineCandle(candle: Candle) {
  return {
    time: Math.floor(candle.timestamp / 1000),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close
  }
}

export function ReplayChart({ candles, events, cursor, replayStart, replayEnd }: ReplayChartProps) {
  const lineData = candles.map((candle) => ({
    time: Math.floor(candle.timestamp / 1000),
    value: candle.close
  }))
  const liveIndex = Math.max(
    0,
    candles.findIndex((candle) => candle.timestamp >= cursor)
  )
  const live = candles[liveIndex] ?? candles[candles.length - 1]

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-lg border bg-white">
      <div className="absolute inset-0 p-2">
        <Liveline
          data={lineData}
          value={live?.close ?? 0}
          mode="candle"
          candles={candles.map(toLivelineCandle)}
          liveCandle={live ? toLivelineCandle(live) : undefined}
          candleWidth={300}
          window={90}
          theme="light"
          color="#1985A1"
          grid
          scrub
          lineMode={false}
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

          return <span key={`${event.timestamp}-${idx}`} className={`absolute top-0 h-3 w-0.5 ${color}`} style={{ left: `${left}%` }} />
        })}
      </div>
    </div>
  )
}
