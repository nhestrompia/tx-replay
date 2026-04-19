"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"

const DEFAULT_LOOKBACK_DAYS = 30

function defaultDateRange() {
  const to = new Date()
  to.setHours(0, 0, 0, 0)
  const from = new Date(to.getTime() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  return {
    from,
    to
  }
}

function toMs(date: Date | undefined, endOfDay: boolean): number {
  if (!date) {
    return 0
  }
  const next = new Date(date.getTime())
  if (endOfDay) {
    next.setHours(23, 59, 59, 999)
  } else {
    next.setHours(0, 0, 0, 0)
  }
  return next.getTime()
}

export function WalletSearchForm() {
  const router = useRouter()
  const defaults = useMemo(() => defaultDateRange(), [])
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(23, 59, 59, 999)
    return d
  }, [])
  const [wallet, setWallet] = useState("")
  const [fromDate, setFromDate] = useState<Date | undefined>(defaults.from)
  const [toDate, setToDate] = useState<Date | undefined>(defaults.to)

  return (
    <div className="fade-in-up mx-auto max-w-5xl space-y-6">
      <header className="space-y-3 text-left">
        <p className="inline-flex items-center rounded-full bg-accent/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-accent-foreground">
          Hyperliquid Replay Engine
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-none text-foreground md:text-6xl">
          Replay every fill and market turn with timeline precision.
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
          Load wallet positions in a strict date window, then inspect event-by-event PnL and market context.
        </p>
      </header>

      <Card className="border-primary/25">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Find Wallet Positions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Date-bounded queries keep large wallets responsive and deterministic.
          </p>
        </CardHeader>
        <CardContent>
          <form
            className="panel-grid md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              const nextWallet = wallet.trim()
              const from = toMs(fromDate, false)
              const to = toMs(toDate, true)

              if (!nextWallet || !from || !to || from >= to) {
                return
              }

              const search = new URLSearchParams({
                wallet: nextWallet,
                from: String(from),
                to: String(to)
              })
              router.push(`/positions?${search.toString()}`)
            }}
          >
            <div className="space-y-2 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Wallet
              </p>
              <Input
                name="wallet"
                placeholder="0x... wallet address"
                required
                value={wallet}
                onChange={(event) => setWallet(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Start Date
              </p>
              <DatePicker
                value={fromDate}
                onChange={setFromDate}
                placeholder="From date"
                disabled={(date) => date > today || (toDate ? date > toDate : false)}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                End Date
              </p>
              <DatePicker
                value={toDate}
                onChange={setToDate}
                placeholder="To date"
                disabled={(date) => date > today || (fromDate ? date < fromDate : false)}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" className="h-11 w-full md:w-auto">
                Load Positions
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
