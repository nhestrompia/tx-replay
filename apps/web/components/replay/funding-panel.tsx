import { FundingPoint } from "@/lib/types"

type FundingPanelProps = {
  points: FundingPoint[]
  cursor: number
}

export function FundingPanel({ points, cursor }: FundingPanelProps) {
  const latest = [...points].reverse().find((point) => point.timestamp <= cursor)

  return (
    <div className="rounded-lg border bg-card p-3">
      <h3 className="mb-2 text-sm font-semibold">Funding</h3>
      <p className="text-sm">
        Current rate: <strong>{latest ? latest.rate.toFixed(6) : "N/A"}</strong>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Showing wallet funding history aligned to replay timeline.</p>
    </div>
  )
}
