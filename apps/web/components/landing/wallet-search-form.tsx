"use client"

import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { isoDateInput } from "@/lib/format"

const DEFAULT_LOOKBACK_DAYS = 30

function defaultDateRange() {
  const to = new Date()
  const from = new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  return {
    from: isoDateInput(from.getTime()),
    to: isoDateInput(to.getTime())
  }
}

function toMs(dateInput: FormDataEntryValue | null, endOfDay: boolean): number {
  const value = String(dateInput ?? "")
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 0
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999)
  } else {
    date.setHours(0, 0, 0, 0)
  }

  return date.getTime()
}

export function WalletSearchForm() {
  const router = useRouter()
  const defaults = defaultDateRange()

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
            const formData = new FormData(event.currentTarget)
            const wallet = String(formData.get("wallet") ?? "").trim()
            const from = toMs(formData.get("from"), false)
            const to = toMs(formData.get("to"), true)

            if (!wallet || !from || !to || from >= to) {
              return
            }

            const search = new URLSearchParams({
              wallet,
              from: String(from),
              to: String(to)
            })
            router.push(`/positions?${search.toString()}`)
          }}
        >
          <Input name="wallet" placeholder="0x... wallet address" required />
          <Input name="from" type="date" defaultValue={defaults.from} required />
          <Input name="to" type="date" defaultValue={defaults.to} required />
          <Button type="submit">Load Positions</Button>
        </form>
        <p className="mt-3 text-sm text-muted-foreground">
          Date-bounded queries are required to keep large wallets fast.
        </p>
      </CardContent>
    </Card>
  )
}
