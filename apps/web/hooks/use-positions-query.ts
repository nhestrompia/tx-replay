"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchPositions } from "@/lib/api-client"

export function usePositionsQuery(input: {
  wallet: string
  from: number
  to: number
  pair?: string
  direction?: "long" | "short"
  page?: number
  pageSize?: number
}) {
  return useQuery({
    queryKey: ["positions", input],
    queryFn: () => fetchPositions(input),
    enabled: Boolean(input.wallet && input.from && input.to),
    staleTime: 30_000
  })
}
