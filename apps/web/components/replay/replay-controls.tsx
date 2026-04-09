"use client"

import { Pause, Play, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/format"

type ReplayControlsProps = {
  isPlaying: boolean
  speed: number
  cursor: number
  replayStart: number
  replayEnd: number
  onPlay: () => void
  onPause: () => void
  onReset: () => void
  onCursorChange: (value: number) => void
  onSpeedChange: (value: number) => void
}

const SPEEDS = [1, 2, 5, 10]

export function ReplayControls(props: ReplayControlsProps) {
  const progress = ((props.cursor - props.replayStart) / (props.replayEnd - props.replayStart || 1)) * 100

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        {props.isPlaying ? (
          <Button size="sm" onClick={props.onPause}>
            <Pause className="mr-1 h-4 w-4" /> Pause
          </Button>
        ) : (
          <Button size="sm" onClick={props.onPlay}>
            <Play className="mr-1 h-4 w-4" /> Play
          </Button>
        )}

        <Button size="sm" variant="outline" onClick={props.onReset}>
          <RotateCcw className="mr-1 h-4 w-4" /> Reset
        </Button>

        <div className="ml-auto flex items-center gap-2">
          {SPEEDS.map((speed) => (
            <Button
              key={speed}
              size="sm"
              variant={props.speed === speed ? "default" : "secondary"}
              onClick={() => props.onSpeedChange(speed)}
            >
              {speed}x
            </Button>
          ))}
        </div>
      </div>

      <input
        type="range"
        min={props.replayStart}
        max={props.replayEnd}
        value={props.cursor}
        onChange={(event) => props.onCursorChange(Number(event.target.value))}
        className="w-full"
      />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatDate(props.replayStart)}</span>
        <span>{progress.toFixed(1)}%</span>
        <span>{formatDate(props.replayEnd)}</span>
      </div>
    </div>
  )
}
