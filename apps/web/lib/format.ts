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

export const DEFAULT_QUOTE_CURRENCY = "USDC"

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
  if (totalSec < 60) {
    return `${totalSec}s`
  }

  const hrs = Math.floor(totalSec / 3600)
  const min = Math.floor((totalSec % 3600) / 60)
  const sec = totalSec % 60

  if (hrs > 0) {
    return sec > 0 ? `${hrs}h ${min}m ${sec}s` : `${hrs}h ${min}m`
  }
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`
}

export function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

export function baseAssetFromPair(pair: string): string {
  const [base] = pair.split("-")
  return base || "BASE"
}

export function quoteCurrencyFromPair(_: string): string {
  return DEFAULT_QUOTE_CURRENCY
}

export function formatPriceWithUnit(value: number, quote = DEFAULT_QUOTE_CURRENCY, digits = 2): string {
  return `${formatNumber(value, digits)} ${quote}`
}

export function formatSizeWithUnit(value: number, pair: string, digits = 4): string {
  return `${formatNumber(value, digits)} ${baseAssetFromPair(pair)}`
}

export function formatPnlWithUnit(value: number, quote = DEFAULT_QUOTE_CURRENCY, digits = 3): string {
  return `${formatNumber(value, digits)} ${quote}`
}

export function formatFundingRatePercent(rate: number, digits = 4): string {
  return `${formatNumber(rate * 100, digits)}%`
}

export function isoDateInput(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}
