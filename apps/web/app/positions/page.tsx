import { Suspense } from "react"

import { PositionsView } from "@/components/positions/positions-view"

export default function PositionsPage() {
  return (
    <Suspense fallback={<main className="container mx-auto py-6 text-sm text-muted-foreground">Loading...</main>}>
      <PositionsView />
    </Suspense>
  )
}
