"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchReplay } from "@/lib/api-client"

export function useReplayQuery(input: {
  id: string
  wallet: string
  from: number
  to: number
}) {
  return useQuery({
    queryKey: ["replay", input],
    queryFn: () =>
      fetchReplay({
        id: input.id,
        wallet: input.wallet,
        from: input.from,
        to: input.to
      }),
    enabled: Boolean(input.id && input.wallet && input.from && input.to),
    staleTime: 30_000
  })
}
