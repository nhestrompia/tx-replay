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
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle>Hyperliquid Position Replayer</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 md:grid-cols-[1fr_180px_180px_auto]"
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
          <Input
            name="wallet"
            placeholder="0x... wallet address"
            required
            value={wallet}
            onChange={(event) => setWallet(event.target.value)}
          />
          <DatePicker
            value={fromDate}
            onChange={setFromDate}
            placeholder="From date"
            disabled={(date) => date > today || (toDate ? date > toDate : false)}
          />
          <DatePicker
            value={toDate}
            onChange={setToDate}
            placeholder="To date"
            disabled={(date) => date > today || (fromDate ? date < fromDate : false)}
          />
          <Button type="submit">Load Positions</Button>
        </form>
        <p className="mt-3 text-sm text-muted-foreground">
          Date-bounded queries are required to keep large wallets fast.
        </p>
      </CardContent>
    </Card>
  )
}
