"use client"

import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"

type PositionFiltersProps = {
  wallet: string
  from: number
  to: number
  pair?: string
  direction?: string
}

export function PositionFilters({ wallet, from, to, pair, direction }: PositionFiltersProps) {
  const router = useRouter()

  return (
    <Card>
      <CardContent className="pt-4">
        <form
          className="grid gap-3 md:grid-cols-[1fr_180px_auto]"
          onSubmit={(event) => {
            event.preventDefault()
            const formData = new FormData(event.currentTarget)
            const next = new URLSearchParams({
              wallet,
              from: String(from),
              to: String(to)
            })

            const nextPair = String(formData.get("pair") ?? "").trim()
            const nextDirection = String(formData.get("direction") ?? "").trim()

            if (nextPair) {
              next.set("pair", nextPair)
            }
            if (nextDirection) {
              next.set("direction", nextDirection)
            }

            router.replace(`/positions?${next.toString()}`)
          }}
        >
          <Input name="pair" placeholder="Filter pair (e.g. BTC-PERP)" defaultValue={pair ?? ""} />
          <Select name="direction" defaultValue={direction ?? ""}>
            <option value="">All directions</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </Select>
          <Button type="submit" variant="secondary">
            Apply Filters
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
