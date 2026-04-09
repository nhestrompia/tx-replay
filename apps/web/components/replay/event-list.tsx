import { ReplayEvent } from "@/lib/types"

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
  return (
    <div className="rounded-lg border bg-card p-3">
      <h3 className="mb-2 text-sm font-semibold">Position Events</h3>
      <ul className="max-h-56 space-y-1 overflow-auto text-xs">
        {events.map((event, idx) => {
          const isPassed = event.timestamp <= cursor
          return (
            <li key={`${event.timestamp}-${idx}`} className={isPassed ? "text-foreground" : "text-muted-foreground"}>
              {new Date(event.timestamp).toLocaleTimeString()} · {LABELS[event.event_type]} · {event.fill_size.toFixed(4)} @ {event.fill_price.toFixed(2)}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
