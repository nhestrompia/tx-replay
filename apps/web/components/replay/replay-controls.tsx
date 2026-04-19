"use client"

import { Pause, Play, RotateCcw, StepBack, StepForward } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatDateShort } from "@/lib/format"

type ReplayControlsProps = {
  isPlaying: boolean
  speed: number
  cursor: number
  replayStart: number
  replayEnd: number
  onPlay: () => void
  onPause: () => void
  onReset: () => void
  onStepForward: () => void
  onStepBack: () => void
  onCursorChange: (value: number) => void
  onSpeedChange: (value: number) => void
}

const SPEEDS = [3, 5, 10]

export function ReplayControls(props: ReplayControlsProps) {
  const progress = ((props.cursor - props.replayStart) / (props.replayEnd - props.replayStart || 1)) * 100

  return (
    <div className="space-y-4 rounded-2xl border border-border/80 bg-card/90 p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Replay Transport</p>
        <p className="text-xs text-muted-foreground">{progress.toFixed(1)}% complete</p>
      </div>
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

        <Button size="sm" variant="outline" onClick={props.onStepBack}>
          <StepBack className="mr-1 h-4 w-4" /> Step Back
        </Button>

        <Button size="sm" variant="outline" onClick={props.onStepForward}>
          <StepForward className="mr-1 h-4 w-4" /> Step Forward
        </Button>

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
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatDateShort(props.replayStart)}</span>
        <span className="text-center">
          {formatDateShort(props.cursor)} ({progress.toFixed(1)}%)
        </span>
        <span>{formatDateShort(props.replayEnd)}</span>
      </div>
    </div>
  )
}
