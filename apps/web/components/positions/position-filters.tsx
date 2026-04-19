"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"

type PositionFiltersProps = {
  wallet: string
  from: number
  to: number
  pair?: string
  direction?: string
}

function startOfDayMs(value: Date): number {
  const next = new Date(value.getTime())
  next.setHours(0, 0, 0, 0)
  return next.getTime()
}

function endOfDayMs(value: Date): number {
  const next = new Date(value.getTime())
  next.setHours(23, 59, 59, 999)
  return next.getTime()
}

export function PositionFilters({ wallet, from, to, pair, direction }: PositionFiltersProps) {
  const router = useRouter()
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(23, 59, 59, 999)
    return d
  }, [])

  const [pairInput, setPairInput] = useState(pair ?? "")
  const [directionInput, setDirectionInput] = useState(direction ?? "")
  const [fromDate, setFromDate] = useState<Date | undefined>(new Date(from))
  const [toDate, setToDate] = useState<Date | undefined>(new Date(to))

  useEffect(() => {
    setPairInput(pair ?? "")
  }, [pair])

  useEffect(() => {
    setDirectionInput(direction ?? "")
  }, [direction])

  useEffect(() => {
    setFromDate(new Date(from))
  }, [from])

  useEffect(() => {
    setToDate(new Date(to))
  }, [to])

  useEffect(() => {
    if (!fromDate || !toDate) {
      return
    }

    const handle = window.setTimeout(() => {
      const next = new URLSearchParams({
        wallet,
        from: String(startOfDayMs(fromDate)),
        to: String(endOfDayMs(toDate))
      })

      const normalizedPair = pairInput.trim().toUpperCase()
      if (normalizedPair.length > 0) {
        next.set("pair", normalizedPair)
      }

      const normalizedDirection = directionInput.trim().toLowerCase()
      if (normalizedDirection === "long" || normalizedDirection === "short") {
        next.set("direction", normalizedDirection)
      }

      router.replace(`/positions?${next.toString()}`)
    }, 220)

    return () => window.clearTimeout(handle)
  }, [wallet, pairInput, directionInput, fromDate, toDate, router])

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Filter Controls
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Pair</p>
            <Input
              name="pair"
              placeholder="Filter pair (e.g. BTC-PERP)"
              value={pairInput}
              onChange={(event) => setPairInput(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Direction</p>
            <Select
              name="direction"
              value={directionInput}
              onChange={(event) => setDirectionInput(event.target.value)}
            >
              <option value="">All directions</option>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">From</p>
            <DatePicker
              value={fromDate}
              onChange={setFromDate}
              placeholder="From date"
              disabled={(date) => date > today || (toDate ? date > toDate : false)}
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">To</p>
            <DatePicker
              value={toDate}
              onChange={setToDate}
              placeholder="To date"
              disabled={(date) => date > today || (fromDate ? date < fromDate : false)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
