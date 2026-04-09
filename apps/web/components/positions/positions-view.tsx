"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { PageShell } from "@/components/shared/page-shell"
import { PositionFilters } from "@/components/positions/position-filters"
import { PositionTable } from "@/components/positions/position-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { usePositionsQuery } from "@/hooks/use-positions-query"

function parseRange(searchParams: URLSearchParams) {
  const wallet = searchParams.get("wallet") ?? ""
  const from = Number(searchParams.get("from") ?? 0)
  const to = Number(searchParams.get("to") ?? 0)
  const pair = searchParams.get("pair") ?? ""
  const direction = searchParams.get("direction") ?? ""
  return { wallet, from, to, pair, direction }
}

export function PositionsView() {
  const searchParams = useSearchParams()
  const { wallet, from, to, pair, direction } = parseRange(searchParams)

  const query = usePositionsQuery({
    wallet,
    from,
    to,
    pair: pair || undefined,
    direction: (direction as "long" | "short") || undefined,
    page: 1,
    pageSize: 100
  })

  if (!wallet || !from || !to) {
    return (
      <PageShell>
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              Missing query params. Go back to <Link href="/" className="text-primary underline">wallet input</Link>.
            </p>
          </CardContent>
        </Card>
      </PageShell>
    )
  }

  return (
    <PageShell className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Positions for {wallet}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Showing positions between {new Date(from).toLocaleDateString()} and {new Date(to).toLocaleDateString()}.
          </p>
        </CardContent>
      </Card>

      <PositionFilters wallet={wallet} from={from} to={to} pair={pair} direction={direction} />

      <Card>
        <CardHeader>
          <CardTitle>Reconstructed Positions</CardTitle>
        </CardHeader>
        <CardContent>
          {query.isLoading && <p className="text-sm text-muted-foreground">Loading positions...</p>}
          {query.error && <p className="text-sm text-red-600">Failed to load positions.</p>}
          {query.data && <PositionTable wallet={wallet} from={from} to={to} positions={query.data.items} />}
        </CardContent>
      </Card>
    </PageShell>
  )
}
