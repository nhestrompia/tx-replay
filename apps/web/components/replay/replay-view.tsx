"use client"

import Link from "next/link"
import { useEffect } from "react"
import { ArrowLeft } from "lucide-react"

import { EventList } from "@/components/replay/event-list"
import { FundingPanel } from "@/components/replay/funding-panel"
import { MarketContextPanel } from "@/components/replay/market-context-panel"
import { ReplayChart } from "@/components/replay/replay-chart"
import { ReplayControls } from "@/components/replay/replay-controls"
import { PositionSummary } from "@/components/replay/position-summary"
import { PageShell } from "@/components/shared/page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useReplayPnl } from "@/hooks/use-replay-pnl"
import { useReplayPlayer } from "@/hooks/use-replay-player"
import { useReplayQuery } from "@/hooks/use-replay-query"

type ReplayViewProps = {
  id: string
  wallet: string
  from: number
  to: number
}

function buildPositionsHref(wallet: string, from: number, to: number): string {
  if (!wallet || !from || !to) {
    return "/"
  }
  const params = new URLSearchParams({
    wallet,
    from: String(from),
    to: String(to)
  })
  return `/positions?${params.toString()}`
}

export function ReplayView({ id, wallet, from, to }: ReplayViewProps) {
  const query = useReplayQuery({ id, wallet, from, to })
  const errorMessage =
    query.error instanceof Error ? query.error.message : "Failed to load replay."
  const backHref = buildPositionsHref(wallet, from, to)

  if (!id || !wallet || !from || !to) {
    return (
      <PageShell>
        <Link href="/">
          <Button variant="outline" size="sm" className="mb-3">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
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
        <Link href={backHref}>
          <Button variant="outline" size="sm" className="mb-3">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Positions
          </Button>
        </Link>
        <p className="text-sm text-muted-foreground">Loading replay...</p>
      </PageShell>
    )
  }

  if (query.error || !query.data) {
    return (
      <PageShell>
        <Link href={backHref}>
          <Button variant="outline" size="sm" className="mb-3">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Positions
          </Button>
        </Link>
        <p className="text-sm text-red-600">{errorMessage}</p>
      </PageShell>
    )
  }

  return <ReplayLoadedView replay={query.data} backHref={backHref} />
}

function ReplayLoadedView({
  replay,
  backHref
}: {
  replay: NonNullable<ReturnType<typeof useReplayQuery>["data"]>
  backHref: string
}) {
  const anchors = [
    ...replay.candles.map((candle) => candle.timestamp),
    ...replay.events.map((event) => event.timestamp)
  ]

  const player = useReplayPlayer({
    start: replay.replayStart,
    end: replay.replayEnd,
    anchors
  })
  const replayPnl = useReplayPnl({
    position: replay.position,
    events: replay.events,
    candles: replay.candles,
    cursor: player.cursor
  })
  const chartPnl = replayPnl.status === "closed" ? replayPnl.finalRealizedPnl : replayPnl.replayPnl

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== " ") {
        return
      }

      const target = event.target as HTMLElement | null
      if (target) {
        const tag = target.tagName.toLowerCase()
        if (tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable) {
          return
        }
      }

      event.preventDefault()
      if (player.isPlaying) {
        player.pause()
      } else {
        if (player.cursor >= replay.replayEnd - 1) {
          player.reset()
        }
        player.play()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [player.cursor, player.isPlaying, player.pause, player.play, player.reset, replay.replayEnd])

  return (
    <PageShell className="space-y-4">
      <div>
        <Link href={backHref}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Positions
          </Button>
        </Link>
      </div>

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
        <div className="space-y-4">
          <ReplayChart
            candles={replay.candles}
            events={replay.events}
            cursor={player.cursor}
            replayStart={replay.replayStart}
            replayEnd={replay.replayEnd}
            pair={replay.position.pair}
            pnl={chartPnl}
            pnlStatus={replayPnl.status}
          />
          <EventList events={replay.events} cursor={player.cursor} pair={replay.position.pair} />
        </div>

        <div className="space-y-4">
          <PositionSummary position={replay.position} replayPnl={replayPnl} />
          <FundingPanel points={replay.funding} cursor={player.cursor} />
          <MarketContextPanel
            pair={replay.position.pair}
            direction={replay.position.direction}
            replayStart={replay.replayStart}
            replayEnd={replay.replayEnd}
            activeStart={replay.position.opened_at}
            activeEnd={replay.position.closed_at}
            candles={replay.candles}
            funding={replay.funding}
            events={replay.events}
          />
        </div>
      </div>
    </PageShell>
  )
}
