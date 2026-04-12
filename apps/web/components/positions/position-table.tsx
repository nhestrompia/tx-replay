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
}

export function PositionTable({ wallet, from, to, positions }: PositionTableProps) {
  if (!positions.length) {
    return <p className="text-sm text-muted-foreground">No positions found in this date range.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <Thead>
          <tr>
            <Th>Pair</Th>
            <Th>Direction</Th>
            <Th>Open</Th>
            <Th>Close</Th>
            <Th>Duration</Th>
            <Th>Realized PnL</Th>
            <Th>Max Size</Th>
            <Th>Fills</Th>
            <Th></Th>
          </tr>
        </Thead>
        <Tbody>
          {positions.map((position) => {
            const tone = position.realized_pnl >= 0 ? "green" : "red"
            const duration = position.closed_at - position.opened_at
            const quote = quoteCurrencyFromPair(position.pair)

            return (
              <tr key={position.id}>
                <Td className="font-medium">{position.pair}</Td>
                <Td>
                  <Badge tone={position.direction === "long" ? "green" : "red"}>{position.direction}</Badge>
                </Td>
                <Td>{formatDateShort(position.opened_at)}</Td>
                <Td>{formatDateShort(position.closed_at)}</Td>
                <Td>{formatDuration(duration)}</Td>
                <Td>
                  <Badge tone={tone}>{formatPnlWithUnit(position.realized_pnl, quote, 3)}</Badge>
                </Td>
                <Td>{formatSizeWithUnit(position.max_size, position.pair, 4)}</Td>
                <Td>{position.fills.length}</Td>
                <Td>
                  <Link
                    className="text-primary underline-offset-4 hover:underline"
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
