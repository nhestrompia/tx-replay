import { PageShell } from "@/components/shared/page-shell"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function PositionsPageSkeleton() {
  return (
    <PageShell className="space-y-6">
      <Skeleton className="h-8 w-32" />

      <Card>
        <CardHeader className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <Skeleton className="h-3 w-28" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <PositionsResultsSkeleton />
        </CardContent>
      </Card>
    </PageShell>
  )
}

export function PositionsResultsSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}
