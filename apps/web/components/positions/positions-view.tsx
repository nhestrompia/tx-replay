"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useMemo } from "react"
import { ArrowLeft } from "lucide-react"

import { PageShell } from "@/components/shared/page-shell"
import { PositionFilters } from "@/components/positions/position-filters"
import { PositionTable } from "@/components/positions/position-table"
import { Button } from "@/components/ui/button"
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
    page: 1,
    pageSize: 100
  })
  const filteredItems = useMemo(() => {
    if (!query.data) {
      return []
    }

    const pairNeedle = pair.trim().toUpperCase()
    const directionNeedle = direction.trim().toLowerCase()

    return query.data.items.filter((position) => {
      const pairMatches = pairNeedle.length === 0 || position.pair.toUpperCase().includes(pairNeedle)
      const directionMatches = directionNeedle.length === 0 || position.direction === directionNeedle
      return pairMatches && directionMatches
    })
  }, [query.data, pair, direction])

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
    <PageShell className="space-y-6">
      <div className="fade-in-up">
        <Link href="/">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
      </div>

      <Card className="fade-in-up border-primary/20">
        <CardHeader className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Wallet Scope</p>
          <CardTitle className="break-all text-2xl md:text-3xl">Positions for {wallet}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Showing reconstructed positions between {new Date(from).toLocaleDateString()} and{" "}
            {new Date(to).toLocaleDateString()}.
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-background/60 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">From</p>
              <p className="text-sm font-medium">{new Date(from).toLocaleDateString()}</p>
            </div>
            <div className="rounded-xl bg-background/60 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">To</p>
              <p className="text-sm font-medium">{new Date(to).toLocaleDateString()}</p>
            </div>
            <div className="rounded-xl bg-background/60 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Results</p>
              <p className="text-sm font-medium">{filteredItems.length} positions</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="fade-in-up">
        <PositionFilters wallet={wallet} from={from} to={to} pair={pair} direction={direction} />
      </div>

      <Card className="fade-in-up">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Reconstructed Positions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Open any row to launch the position replay timeline.
          </p>
        </CardHeader>
        <CardContent>
          {query.isLoading && <p className="text-sm text-muted-foreground">Loading positions...</p>}
          {query.error && <p className="text-sm text-rose-300">Failed to load positions.</p>}
          {query.data && <PositionTable wallet={wallet} from={from} to={to} positions={filteredItems} />}
        </CardContent>
      </Card>
    </PageShell>
  )
}
