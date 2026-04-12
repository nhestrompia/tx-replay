import { Badge } from "@/components/ui/badge"
import { ReplayEvent } from "@/lib/types"
import { formatDateShort, formatPriceWithUnit, formatSizeWithUnit, quoteCurrencyFromPair } from "@/lib/format"

const LABELS: Record<ReplayEvent["event_type"], string> = {
  entry: "Entry",
  add: "Scale In",
  partial_close: "Partial Close",
  full_close: "Full Close"
}

function eventTone(type: ReplayEvent["event_type"]): "default" | "green" | "red" {
  if (type === "entry" || type === "add") {
    return "green"
  }
  if (type === "full_close") {
    return "red"
  }
  return "default"
}

type EventListProps = {
  events: ReplayEvent[]
  cursor: number
  pair: string
}

export function EventList({ events, cursor, pair }: EventListProps) {
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp)
  const current = [...sorted].reverse().find((event) => event.timestamp <= cursor)
  const happened = sorted.filter((event) => event.timestamp <= cursor)
  const recentHappened = [...happened].reverse()
  const upcomingCount = Math.max(0, sorted.length - happened.length)
  const quote = quoteCurrencyFromPair(pair)

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Position Events</h3>
        <Badge tone="default">
          {happened.length}/{sorted.length}
        </Badge>
      </div>

      <div className="mb-3 rounded-md border bg-muted/20 p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Current Event</p>
        {current ? (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2">
              <Badge tone={eventTone(current.event_type)}>{LABELS[current.event_type]}</Badge>
              <span className="text-xs text-muted-foreground">{formatDateShort(current.timestamp)}</span>
            </div>
            <p className="text-sm">
              {formatSizeWithUnit(current.fill_size, pair, 4)} @ {formatPriceWithUnit(current.fill_price, quote, 2)}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Waiting for first event</p>
        )}
        {upcomingCount > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Upcoming: {upcomingCount}</p>
        ) : null}
      </div>

      <ul className="max-h-64 space-y-2 overflow-auto pr-1 text-xs">
        {recentHappened.map((event, idx) => (
          <li key={`${event.timestamp}-${idx}`} className="rounded-md border bg-background/80 px-3 py-2">
            <div className="mb-1 flex items-center gap-2">
              <Badge tone={eventTone(event.event_type)}>{LABELS[event.event_type]}</Badge>
              <span className="text-muted-foreground">{formatDateShort(event.timestamp)}</span>
            </div>
            <p className="text-foreground">
              {formatSizeWithUnit(event.fill_size, pair, 4)} @ {formatPriceWithUnit(event.fill_price, quote, 2)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
