import { PositionListResponse, ReplayResponse } from "@/lib/types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/v1"

type PositionParams = {
  wallet: string
  from: number
  to: number
  pair?: string
  direction?: "long" | "short"
  page?: number
  pageSize?: number
}

type ReplayParams = {
  id: string
  wallet: string
  from: number
  to: number
  preMs?: number
  postMs?: number
  interval?: string
}

function buildUrl(path: string, params: Record<string, string | number | undefined>) {
  const url = new URL(`${API_BASE_URL}${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

export async function fetchPositions(params: PositionParams): Promise<PositionListResponse> {
  const url = buildUrl("/positions", {
    wallet: params.wallet,
    from: params.from,
    to: params.to,
    pair: params.pair,
    direction: params.direction,
    page: params.page,
    page_size: params.pageSize
  })

  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Failed to fetch positions (${response.status})`)
  }

  return response.json()
}

export async function fetchReplay(params: ReplayParams): Promise<ReplayResponse> {
  const url = buildUrl(`/replay/${params.id}`, {
    wallet: params.wallet,
    from: params.from,
    to: params.to,
    pre_ms: params.preMs,
    post_ms: params.postMs,
    interval: params.interval
  })

  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Failed to fetch replay (${response.status})`)
  }

  return response.json()
}
