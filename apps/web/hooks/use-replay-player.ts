"use client"

import { useEffect, useMemo, useState } from "react"

export function useReplayPlayer(input: {
  start: number
  end: number
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [cursor, setCursor] = useState(input.start)

  const duration = useMemo(() => Math.max(1, input.end - input.start), [input.end, input.start])

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
        const next = prev + elapsed * speed * 20
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

  return {
    cursor,
    duration,
    isPlaying,
    speed,
    setSpeed,
    setCursor,
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
    reset: () => {
      setCursor(input.start)
      setIsPlaying(false)
    }
  }
}
