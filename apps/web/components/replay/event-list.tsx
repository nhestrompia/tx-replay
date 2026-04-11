import { ReplayEvent } from "@/lib/types"
import { formatDateShort } from "@/lib/format"

const LABELS: Record<ReplayEvent["event_type"], string> = {
  entry: "Entry",
  add: "Scale In",
  partial_close: "Partial Close",
  full_close: "Full Close"
}

type EventListProps = {
  events: ReplayEvent[]
  cursor: number
}

export function EventList({ events, cursor }: EventListProps) {
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp)
  const current = [...sorted].reverse().find((event) => event.timestamp <= cursor)
  const happened = sorted.filter((event) => event.timestamp <= cursor)
  const upcomingCount = Math.max(0, sorted.length - happened.length)

  return (
    <div className="rounded-lg border bg-card p-3">
      <h3 className="mb-2 text-sm font-semibold">Position Events</h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Current event:{" "}
        {current
          ? `${LABELS[current.event_type]} · ${current.fill_size.toFixed(4)} @ ${current.fill_price.toFixed(2)}`
          : "Waiting for first event"}
      </p>
      {upcomingCount > 0 ? (
        <p className="mb-2 text-xs text-muted-foreground">
          Upcoming: {upcomingCount}
        </p>
      ) : null}
      <ul className="max-h-56 space-y-1 overflow-auto text-xs">
        {happened.map((event, idx) => {
          return (
            <li key={`${event.timestamp}-${idx}`} className="text-foreground">
              {formatDateShort(event.timestamp)} · {LABELS[event.event_type]} · {event.fill_size.toFixed(4)} @ {event.fill_price.toFixed(2)}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
