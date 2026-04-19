import { Suspense } from "react"

import { PositionsView } from "@/components/positions/positions-view"

export default function PositionsPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-[1380px] px-4 py-6 text-sm text-muted-foreground md:px-6">Loading...</main>}>
      <PositionsView />
    </Suspense>
  )
}
