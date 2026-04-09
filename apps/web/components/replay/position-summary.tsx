import { Badge } from "@/components/ui/badge"
import { formatDuration, formatNumber } from "@/lib/format"
import { Position } from "@/lib/types"

type PositionSummaryProps = {
  position: Position
}

export function PositionSummary({ position }: PositionSummaryProps) {
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

        <span className="text-muted-foreground">PnL</span>
        <span>{formatNumber(position.realized_pnl, 3)}</span>

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
