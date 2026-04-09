export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString()
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
