import { Badge } from "@/components/ui/badge"
import { ReplayPnlSnapshot } from "@/hooks/use-replay-pnl"
import {
  formatDuration,
  formatPnlWithUnit,
  formatPriceWithUnit,
  formatSizeWithUnit,
  quoteCurrencyFromPair
} from "@/lib/format"
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
  const quote = quoteCurrencyFromPair(position.pair)
  const statusTone = replayPnl.status === "open" ? "green" : "default"
  const statusLabel =
    replayPnl.status === "pre_open"
      ? "not open"
      : replayPnl.status === "open"
        ? "open"
        : "closed"

  return (
    <div className="rounded-2xl border border-border/80 bg-card/90 p-4 text-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">Position Summary</h3>
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
          <Badge tone={pnlTone(pnlValue)}>{formatPnlWithUnit(pnlValue, quote, 3)}</Badge>
        </span>

        <span className="text-muted-foreground">Mark Price</span>
        <span>{replayPnl.markPrice === null ? "N/A" : formatPriceWithUnit(replayPnl.markPrice, quote, 2)}</span>

        <span className="text-muted-foreground">Open Size</span>
        <span>{formatSizeWithUnit(replayPnl.openSize, position.pair, 4)}</span>

        <span className="text-muted-foreground">Unrealized</span>
        <span>{replayPnl.status === "open" ? formatPnlWithUnit(replayPnl.unrealizedPnl, quote, 3) : "-"}</span>

        <span className="text-muted-foreground">Avg Entry</span>
        <span>{formatPriceWithUnit(position.avg_entry, quote, 4)}</span>

        <span className="text-muted-foreground">Avg Exit</span>
        <span>{formatPriceWithUnit(position.avg_exit, quote, 4)}</span>

        <span className="text-muted-foreground">Max Size</span>
        <span>{formatSizeWithUnit(position.max_size, position.pair, 4)}</span>
      </div>
    </div>
  )
}
