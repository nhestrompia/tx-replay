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
    queryKey: ["replay", input, { preMs: 0, postMs: 0, interval: "1m" }],
    queryFn: () =>
      fetchReplay({
        id: input.id,
        wallet: input.wallet,
        from: input.from,
        to: input.to,
        preMs: 0,
        postMs: 0,
        interval: "1m"
      }),
    enabled: Boolean(input.id && input.wallet && input.from && input.to),
    staleTime: 30_000
  })
}
