import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { PageShell } from "@/components/shared/page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type ReplayPageSkeletonProps = {
  backHref?: string
}

export function ReplayPageSkeleton({ backHref }: ReplayPageSkeletonProps) {
  return (
    <PageShell className="space-y-6">
      <div className="space-y-3">
        {backHref ? (
          <Link href={backHref}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Positions
            </Button>
          </Link>
        ) : (
          <Skeleton className="h-8 w-40" />
        )}
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-7 w-20" />
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-44" />
            <Skeleton className="h-3 w-36" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-20" />
          </div>
          <Skeleton className="h-2 w-full" />
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <div className="space-y-5">
          <Skeleton className="h-[420px] w-full" />
          <Skeleton className="h-[260px] w-full" />
        </div>

        <div className="space-y-5">
          <Skeleton className="h-[250px] w-full" />
          <Skeleton className="h-[180px] w-full" />
          <Skeleton className="h-[220px] w-full" />
        </div>
      </div>
    </PageShell>
  )
}
