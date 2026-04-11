import { Badge } from "@/components/ui/badge"
import { ReplayPnlSnapshot } from "@/hooks/use-replay-pnl"
import { formatDuration, formatNumber } from "@/lib/format"
import { Position } from "@/lib/types"

type PositionSummaryProps = {
  position: Position
  replayPnl: ReplayPnlSnapshot
}

function pnlTone(value: number): "green" | "red" | "default" {
  if (value > 0) {
    return "green"
  }
  if (value < 0) {
    return "red"
  }
  return "default"
}

export function PositionSummary({ position, replayPnl }: PositionSummaryProps) {
  const pnlValue = replayPnl.status === "closed" ? replayPnl.finalRealizedPnl : replayPnl.replayPnl
  const pnlLabel = replayPnl.status === "closed" ? "PnL (Final)" : "PnL (Live)"
  const statusTone = replayPnl.status === "open" ? "green" : "default"
  const statusLabel =
    replayPnl.status === "pre_open"
      ? "not open"
      : replayPnl.status === "open"
        ? "open"
        : "closed"

  return (
    <div className="rounded-lg border bg-card p-3 text-sm">
      <h3 className="mb-2 font-semibold">Position Summary</h3>
      <div className="grid grid-cols-2 gap-2">
        <span className="text-muted-foreground">Pair</span>
        <span>{position.pair}</span>

        <span className="text-muted-foreground">Direction</span>
        <span>
          <Badge tone={position.direction === "long" ? "green" : "red"}>{position.direction}</Badge>
        </span>

        <span className="text-muted-foreground">Duration</span>
        <span>{formatDuration(position.closed_at - position.opened_at)}</span>

        <span className="text-muted-foreground">Status</span>
        <span>
          <Badge tone={statusTone}>{statusLabel}</Badge>
        </span>

        <span className="text-muted-foreground">{pnlLabel}</span>
        <span>
          <Badge tone={pnlTone(pnlValue)}>{formatNumber(pnlValue, 3)}</Badge>
        </span>

        <span className="text-muted-foreground">Mark Price</span>
        <span>{replayPnl.markPrice === null ? "N/A" : formatNumber(replayPnl.markPrice, 2)}</span>

        <span className="text-muted-foreground">Open Size</span>
        <span>{formatNumber(replayPnl.openSize, 4)}</span>

        <span className="text-muted-foreground">Unrealized</span>
        <span>{replayPnl.status === "open" ? formatNumber(replayPnl.unrealizedPnl, 3) : "-"}</span>

        <span className="text-muted-foreground">Avg Entry</span>
        <span>{formatNumber(position.avg_entry, 4)}</span>

        <span className="text-muted-foreground">Avg Exit</span>
        <span>{formatNumber(position.avg_exit, 4)}</span>

        <span className="text-muted-foreground">Max Size</span>
        <span>{formatNumber(position.max_size, 4)}</span>
      </div>
    </div>
  )
}
