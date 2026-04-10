"use client"

import Link from "next/link"

import { EventList } from "@/components/replay/event-list"
import { FundingPanel } from "@/components/replay/funding-panel"
import { ReplayChart } from "@/components/replay/replay-chart"
import { ReplayControls } from "@/components/replay/replay-controls"
import { PositionSummary } from "@/components/replay/position-summary"
import { PageShell } from "@/components/shared/page-shell"
import { Card, CardContent } from "@/components/ui/card"
import { useReplayPlayer } from "@/hooks/use-replay-player"
import { useReplayQuery } from "@/hooks/use-replay-query"

type ReplayViewProps = {
  id: string
  wallet: string
  from: number
  to: number
}

export function ReplayView({ id, wallet, from, to }: ReplayViewProps) {
  const query = useReplayQuery({ id, wallet, from, to })
  const errorMessage =
    query.error instanceof Error ? query.error.message : "Failed to load replay."

  if (!id || !wallet || !from || !to) {
    return (
      <PageShell>
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Missing replay params. Return to <Link href="/" className="text-primary underline">wallet search</Link>.
          </CardContent>
        </Card>
      </PageShell>
    )
  }

  if (query.isLoading) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Loading replay...</p>
      </PageShell>
    )
  }

  if (query.error || !query.data) {
    return (
      <PageShell>
        <p className="text-sm text-red-600">{errorMessage}</p>
      </PageShell>
    )
  }

  return <ReplayLoadedView replay={query.data} />
}

function ReplayLoadedView({ replay }: { replay: NonNullable<ReturnType<typeof useReplayQuery>["data"]> }) {
  const anchors = [
    ...replay.candles.map((candle) => candle.timestamp),
    ...replay.events.map((event) => event.timestamp)
  ]

  const player = useReplayPlayer({
    start: replay.replayStart,
    end: replay.replayEnd,
    anchors
  })

  return (
    <PageShell className="space-y-4">
      <ReplayControls
        isPlaying={player.isPlaying}
        speed={player.speed}
        cursor={player.cursor}
        replayStart={replay.replayStart}
        replayEnd={replay.replayEnd}
        onPlay={player.play}
        onPause={player.pause}
        onReset={player.reset}
        onStepBack={player.stepBack}
        onStepForward={player.stepForward}
        onCursorChange={player.setCursor}
        onSpeedChange={player.setSpeed}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <ReplayChart
          candles={replay.candles}
          cursor={player.cursor}
          replayStart={replay.replayStart}
          replayEnd={replay.replayEnd}
        />

        <div className="space-y-4">
          <PositionSummary position={replay.position} />
          <FundingPanel points={replay.funding} cursor={player.cursor} />
          <EventList events={replay.events} cursor={player.cursor} />
        </div>
      </div>
    </PageShell>
  )
}
