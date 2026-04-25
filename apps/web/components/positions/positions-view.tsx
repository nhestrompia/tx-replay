"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { ArrowLeft } from "lucide-react"

import { PageShell } from "@/components/shared/page-shell"
import { PositionFilters } from "@/components/positions/position-filters"
import { PositionsResultsSkeleton } from "@/components/positions/positions-skeleton"
import { PositionTable } from "@/components/positions/position-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { usePositionsQuery } from "@/hooks/use-positions-query"

type PositionSortBy = "opened_at" | "closed_at" | "max_size"
type PositionSortDir = "asc" | "desc"
const PAGE_SIZE = 25

function normalizeDirection(value: string): "long" | "short" | "" {
  const next = value.trim().toLowerCase()
  if (next === "long" || next === "short") {
    return next
  }
  return ""
}

function normalizeSortBy(value: string | null): PositionSortBy {
  if (value === "closed_at" || value === "max_size" || value === "opened_at") {
    return value
  }
  return "opened_at"
}

function normalizeSortDir(value: string | null): PositionSortDir {
  return value === "asc" ? "asc" : "desc"
}

function parseRange(searchParams: URLSearchParams) {
  const wallet = searchParams.get("wallet") ?? ""
  const from = Number(searchParams.get("from") ?? 0)
  const to = Number(searchParams.get("to") ?? 0)
  const pair = searchParams.get("pair") ?? ""
  const direction = normalizeDirection(searchParams.get("direction") ?? "")
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1)
  const sortBy = normalizeSortBy(searchParams.get("sort_by"))
  const sortDir = normalizeSortDir(searchParams.get("sort_dir"))
  return { wallet, from, to, pair, direction, page, sortBy, sortDir }
}

function buildPositionsSearch(input: {
  wallet: string
  from: number
  to: number
  pair: string
  direction: "long" | "short" | ""
  page: number
  sortBy: PositionSortBy
  sortDir: PositionSortDir
}) {
  const next = new URLSearchParams({
    wallet: input.wallet,
    from: String(input.from),
    to: String(input.to),
    page: String(Math.max(1, input.page)),
    sort_by: input.sortBy,
    sort_dir: input.sortDir
  })
  if (input.pair.trim().length > 0) {
    next.set("pair", input.pair.trim().toUpperCase())
  }
  if (input.direction) {
    next.set("direction", input.direction)
  }
  return next
}

export function PositionsView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { wallet, from, to, pair, direction, page, sortBy, sortDir } = parseRange(searchParams)

  const query = usePositionsQuery({
    wallet,
    from,
    to,
    pair: pair.trim().length > 0 ? pair.trim().toUpperCase() : undefined,
    direction: direction || undefined,
    page,
    pageSize: PAGE_SIZE,
    sortBy,
    sortDir
  })
  const items = query.data?.items ?? []
  const totalItems = query.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const filtersActive = pair.trim().length > 0 || Boolean(direction)
  const startIndex = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endIndex = totalItems === 0 ? 0 : Math.min(totalItems, startIndex + Math.max(0, items.length - 1))

  useEffect(() => {
    if (!query.data) {
      return
    }
    if (page <= totalPages) {
      return
    }
    const nextSearch = buildPositionsSearch({
      wallet,
      from,
      to,
      pair,
      direction,
      page: totalPages,
      sortBy,
      sortDir
    })
    router.replace(`/positions?${nextSearch.toString()}`)
  }, [query.data, page, totalPages, wallet, from, to, pair, direction, sortBy, sortDir, router])

  const changeSort = (nextSortBy: PositionSortBy) => {
    const nextDir: PositionSortDir = sortBy === nextSortBy && sortDir === "desc" ? "asc" : "desc"
    const nextSearch = buildPositionsSearch({
      wallet,
      from,
      to,
      pair,
      direction,
      page: 1,
      sortBy: nextSortBy,
      sortDir: nextDir
    })
    router.replace(`/positions?${nextSearch.toString()}`)
  }

  const changePage = (nextPage: number) => {
    const clamped = Math.max(1, Math.min(totalPages, nextPage))
    if (clamped === page) {
      return
    }
    const nextSearch = buildPositionsSearch({
      wallet,
      from,
      to,
      pair,
      direction,
      page: clamped,
      sortBy,
      sortDir
    })
    router.push(`/positions?${nextSearch.toString()}`)
  }

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
              {query.isLoading ? (
                <Skeleton className="mt-1 h-5 w-24" />
              ) : (
                <p className="text-sm font-medium">{totalItems} positions</p>
              )}
            </div>
          </div>
          {query.data ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {filtersActive
                ? `Filtered ${startIndex}-${endIndex} of ${totalItems} results.`
                : `Showing ${startIndex}-${endIndex} of ${totalItems} results.`}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="fade-in-up">
        <PositionFilters
          wallet={wallet}
          from={from}
          to={to}
          pair={pair}
          direction={direction}
          sortBy={sortBy}
          sortDir={sortDir}
        />
      </div>

      <Card className="fade-in-up">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Reconstructed Positions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Open any row to launch the position replay timeline.
          </p>
        </CardHeader>
        <CardContent>
          {query.isLoading && <PositionsResultsSkeleton />}
          {query.error ? (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4">
              <p className="text-sm text-rose-200">Failed to load positions.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  void query.refetch()
                }}
              >
                Retry
              </Button>
            </div>
          ) : null}
          {query.data && (
            <>
              <PositionTable
                wallet={wallet}
                from={from}
                to={to}
                positions={items}
                sortBy={sortBy}
                sortDir={sortDir}
                onSortChange={changeSort}
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => changePage(page - 1)} disabled={page <= 1}>
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => changePage(page + 1)}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </PageShell>
  )
}
