import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Table, Tbody, Td, Th, Thead } from "@/components/ui/table"
import { formatDateShort, formatDuration, formatPnlWithUnit, formatSizeWithUnit, quoteCurrencyFromPair } from "@/lib/format"
import { Position } from "@/lib/types"

type PositionTableProps = {
  wallet: string
  from: number
  to: number
  positions: Position[]
  sortBy: "opened_at" | "closed_at" | "max_size"
  sortDir: "asc" | "desc"
  onSortChange: (value: "opened_at" | "closed_at" | "max_size") => void
}

function sortIndicator(active: boolean, dir: "asc" | "desc"): string {
  if (!active) {
    return "↕"
  }
  return dir === "asc" ? "↑" : "↓"
}

export function PositionTable({
  wallet,
  from,
  to,
  positions,
  sortBy,
  sortDir,
  onSortChange
}: PositionTableProps) {
  if (!positions.length) {
    return (
      <p className="rounded-xl border border-border/70 bg-background/60 px-4 py-6 text-sm text-muted-foreground">
        No positions found in this date range.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70 bg-background/45">
      <Table>
        <Thead>
          <tr>
            <Th>Pair</Th>
            <Th>Direction</Th>
            <Th className="hidden md:table-cell">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-inherit"
                onClick={() => onSortChange("opened_at")}
              >
                Open {sortIndicator(sortBy === "opened_at", sortDir)}
              </button>
            </Th>
            <Th className="hidden md:table-cell">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-inherit"
                onClick={() => onSortChange("closed_at")}
              >
                Close {sortIndicator(sortBy === "closed_at", sortDir)}
              </button>
            </Th>
            <Th className="hidden lg:table-cell">Duration</Th>
            <Th>Realized PnL</Th>
            <Th className="hidden lg:table-cell">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-inherit"
                onClick={() => onSortChange("max_size")}
              >
                Max Size {sortIndicator(sortBy === "max_size", sortDir)}
              </button>
            </Th>
            <Th className="hidden sm:table-cell">Fills</Th>
            <Th></Th>
          </tr>
        </Thead>
        <Tbody>
          {positions.map((position) => {
            const tone = position.realized_pnl >= 0 ? "green" : "red"
            const duration = position.closed_at - position.opened_at
            const quote = quoteCurrencyFromPair(position.pair)

            return (
              <tr key={position.id} className="odd:bg-background/25 hover:bg-accent/25">
                <Td className="font-medium">{position.pair}</Td>
                <Td>
                  <Badge tone={position.direction === "long" ? "green" : "red"}>{position.direction}</Badge>
                </Td>
                <Td className="hidden md:table-cell">{formatDateShort(position.opened_at)}</Td>
                <Td className="hidden md:table-cell">{formatDateShort(position.closed_at)}</Td>
                <Td className="hidden lg:table-cell">{formatDuration(duration)}</Td>
                <Td>
                  <Badge tone={tone}>{formatPnlWithUnit(position.realized_pnl, quote, 3)}</Badge>
                </Td>
                <Td className="hidden lg:table-cell">{formatSizeWithUnit(position.max_size, position.pair, 4)}</Td>
                <Td className="hidden sm:table-cell">{position.fills.length}</Td>
                <Td>
                  <Link
                    className="inline-flex items-center rounded-full bg-primary/22 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary hover:bg-primary/32"
                    href={`/replay/${position.id}?wallet=${wallet}&from=${from}&to=${to}`}
                  >
                    Replay
                  </Link>
                </Td>
              </tr>
            )
          })}
        </Tbody>
      </Table>
    </div>
  )
}
