"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

function firstGreater(values: number[], target: number): number | undefined {
  for (const value of values) {
    if (value > target) {
      return value
    }
  }
  return undefined
}

function lastLower(values: number[], target: number): number | undefined {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] < target) {
      return values[index]
    }
  }
  return undefined
}

export function useReplayPlayer(input: {
  start: number
  end: number
  anchors?: number[]
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(3)
  const [cursor, setCursor] = useState(input.start)

  const duration = useMemo(() => Math.max(1, input.end - input.start), [input.end, input.start])
  const sortedAnchors = useMemo(() => {
    const values = (input.anchors ?? [])
      .filter((value) => value >= input.start && value <= input.end)
      .sort((a, b) => a - b)

    const deduped: number[] = []
    for (const value of values) {
      if (!deduped.length || deduped[deduped.length - 1] !== value) {
        deduped.push(value)
      }
    }
    return deduped
  }, [input.anchors, input.end, input.start])

  useEffect(() => {
    setCursor(input.start)
  }, [input.start])

  useEffect(() => {
    if (!isPlaying) {
      return
    }

    let rafId = 0
    let lastTime = performance.now()

    const tick = (now: number) => {
      const elapsed = now - lastTime
      lastTime = now

      setCursor((prev) => {
        const next = prev + elapsed * speed * 60
        if (next >= input.end) {
          setIsPlaying(false)
          return input.end
        }
        return next
      })

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [input.end, isPlaying, speed])

  const stepForward = useCallback(() => {
    setIsPlaying(false)
    const next = firstGreater(sortedAnchors, cursor)
    setCursor(next ?? input.end)
  }, [sortedAnchors, cursor, input.end])

  const stepBack = useCallback(() => {
    setIsPlaying(false)
    const previous = lastLower(sortedAnchors, cursor)
    setCursor(previous ?? input.start)
  }, [sortedAnchors, cursor, input.start])

  const play = useCallback(() => setIsPlaying(true), [])
  const pause = useCallback(() => setIsPlaying(false), [])
  const reset = useCallback(() => {
    setCursor(input.start)
    setIsPlaying(false)
  }, [input.start])

  return {
    cursor,
    duration,
    isPlaying,
    speed,
    setSpeed,
    setCursor,
    stepForward,
    stepBack,
    play,
    pause,
    reset
  }
}
