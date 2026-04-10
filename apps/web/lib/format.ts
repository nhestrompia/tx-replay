const DATE_TIME_LONG = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
})

const DATE_TIME_SHORT = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
})

const TIME_ONLY = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
})

export function formatDate(ts: number): string {
  return DATE_TIME_LONG.format(new Date(ts))
}

export function formatDateShort(ts: number): string {
  return DATE_TIME_SHORT.format(new Date(ts))
}

export function formatTime(ts: number): string {
  return TIME_ONLY.format(new Date(ts))
}

export function formatAxisTime(unixSeconds: number, includeDate = false): string {
  const ts = unixSeconds * 1000
  return includeDate ? formatDateShort(ts) : formatTime(ts)
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const hrs = Math.floor(totalSec / 3600)
  const min = Math.floor((totalSec % 3600) / 60)
  if (hrs > 0) {
    return `${hrs}h ${min}m`
  }
  return `${min}m`
}

export function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

export function isoDateInput(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}
