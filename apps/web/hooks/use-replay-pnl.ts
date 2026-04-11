"use client"

import { useMemo } from "react"

import { Candle, Position, ReplayEvent } from "@/lib/types"

export type ReplayPnlSnapshot = {
  status: "pre_open" | "open" | "closed"
  markPrice: number | null
  openSize: number
  avgEntry: number | null
  realizedToCursor: number
  unrealizedPnl: number
  replayPnl: number
  finalRealizedPnl: number
}

function directionMultiplier(direction: Position["direction"]): number {
  return direction === "long" ? 1 : -1
}

function sortAsc<T extends { timestamp: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.timestamp - b.timestamp)
}

function findMarkPrice(candles: Candle[], cursor: number): number | null {
  if (!candles.length) {
    return null
  }

  for (let index = candles.length - 1; index >= 0; index -= 1) {
    if (candles[index].timestamp <= cursor) {
      return candles[index].close
    }
  }

  return candles[0].close
}

export function useReplayPnl(params: {
  position: Position
  events: ReplayEvent[]
  candles: Candle[]
  cursor: number
}): ReplayPnlSnapshot {
  const orderedEvents = useMemo(() => sortAsc(params.events), [params.events])
  const orderedCandles = useMemo(() => sortAsc(params.candles), [params.candles])

  return useMemo(() => {
    const markPrice = findMarkPrice(orderedCandles, params.cursor)
    const multiplier = directionMultiplier(params.position.direction)
    const activeEvents = orderedEvents.filter((event) => event.timestamp <= params.cursor)

    let openSize = 0
    let avgEntry = 0
    let realizedToCursor = 0

    for (const event of activeEvents) {
      if (event.event_type === "entry" || event.event_type === "add") {
        const nextSize = openSize + event.fill_size
        avgEntry = nextSize > 0
          ? ((avgEntry * openSize) + (event.fill_price * event.fill_size)) / nextSize
          : 0
        openSize = nextSize
        continue
      }

      const closeSize = Math.min(openSize, event.fill_size)
      if (closeSize > 0) {
        realizedToCursor += (event.fill_price - avgEntry) * closeSize * multiplier
      }
      openSize = Math.max(0, openSize - event.fill_size)
      if (openSize === 0) {
        avgEntry = 0
      }
    }

    const unrealizedPnl =
      openSize > 0 && markPrice !== null
        ? (markPrice - avgEntry) * openSize * multiplier
        : 0

    const hasOpened = params.cursor >= params.position.opened_at
    const isClosed = params.cursor >= params.position.closed_at
    const status: ReplayPnlSnapshot["status"] = !hasOpened ? "pre_open" : (isClosed ? "closed" : "open")

    return {
      status,
      markPrice,
      openSize,
      avgEntry: openSize > 0 ? avgEntry : null,
      realizedToCursor,
      unrealizedPnl,
      replayPnl: realizedToCursor + unrealizedPnl,
      finalRealizedPnl: params.position.realized_pnl
    }
  }, [orderedCandles, orderedEvents, params.cursor, params.position])
}
