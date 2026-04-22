import { Suspense } from "react"

import { PositionsPageSkeleton } from "@/components/positions/positions-skeleton"
import { PositionsView } from "@/components/positions/positions-view"

export default function PositionsPage() {
  return (
    <Suspense fallback={<PositionsPageSkeleton />}>
      <PositionsView />
    </Suspense>
  )
}
