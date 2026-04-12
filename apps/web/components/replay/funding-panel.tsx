"use client"

import { useMemo, useRef, useState } from "react"

import { formatDateShort, formatFundingRatePercent } from "@/lib/format"
import { FundingPoint } from "@/lib/types"

type FundingPanelProps = {
  points: FundingPoint[]
  cursor: number
}

function buildPath(points: FundingPoint[]) {
  if (!points.length) {
    return ""
  }

  const minTs = points[0].timestamp
  const maxTs = points[points.length - 1].timestamp
  const minRate = Math.min(...points.map((point) => point.rate), 0)
  const maxRate = Math.max(...points.map((point) => point.rate), 0)
  const spanTs = Math.max(1, maxTs - minTs)
  const spanRate = Math.max(1e-12, maxRate - minRate)

  return points
    .map((point, index) => {
      const x = ((point.timestamp - minTs) / spanTs) * 100
      const y = 100 - ((point.rate - minRate) / spanRate) * 100
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(" ")
}

function cursorX(points: FundingPoint[], timestamp: number): number {
  if (!points.length) {
    return 0
  }
  const minTs = points[0].timestamp
  const maxTs = points[points.length - 1].timestamp
  const span = Math.max(1, maxTs - minTs)
  return Math.max(0, Math.min(100, ((timestamp - minTs) / span) * 100))
}

function nearestPointIndex(points: FundingPoint[], timestamp: number): number | null {
  if (!points.length) {
    return null
  }
  let bestIndex = 0
  let bestDistance = Math.abs(points[0].timestamp - timestamp)
  for (let index = 1; index < points.length; index += 1) {
    const distance = Math.abs(points[index].timestamp - timestamp)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }
  return bestIndex
}

function singlePointY(point: FundingPoint): number {
  return point.rate >= 0 ? 35 : 65
}

export function FundingPanel({ points, cursor }: FundingPanelProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const sorted = useMemo(() => [...points].sort((a, b) => a.timestamp - b.timestamp), [points])
  const path = buildPath(sorted)

  const cursorIndex = nearestPointIndex(sorted, cursor)
  const activeIndex = hoveredIndex ?? cursorIndex
  const activePoint = activeIndex === null ? null : sorted[activeIndex]
  const activeTimestamp = activePoint?.timestamp ?? cursor
  const activeX = cursorX(sorted, activeTimestamp)
  const latest = activePoint ?? sorted[sorted.length - 1]
  const singleY = sorted.length === 1 ? singlePointY(sorted[0]) : 50

  const handleMove = (clientX: number) => {
    if (!svgRef.current || sorted.length === 0) {
      return
    }
    const rect = svgRef.current.getBoundingClientRect()
    const relative = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)))
    const ts = sorted[0].timestamp + relative * (sorted[sorted.length - 1].timestamp - sorted[0].timestamp)
    setHoveredIndex(nearestPointIndex(sorted, ts))
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <h3 className="mb-2 text-sm font-semibold">Funding Timeline</h3>
      <p className="mb-2 text-sm">
        Current rate: <strong>{latest ? formatFundingRatePercent(latest.rate, 4) : "N/A"}</strong>
      </p>
      <p className="mb-2 text-xs text-muted-foreground">
        {latest ? formatDateShort(latest.timestamp) : "No funding timestamp"}
      </p>

      <div className="h-24 rounded border bg-muted/30 p-2">
        {sorted.length > 1 ? (
          <svg
            ref={svgRef}
            viewBox="0 0 100 100"
            className="h-full w-full cursor-crosshair"
            preserveAspectRatio="none"
            onMouseMove={(event) => handleMove(event.clientX)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <line x1="0" y1="50" x2="100" y2="50" stroke="#64748b" strokeDasharray="2 2" strokeWidth="0.8" />
            <path d={path} fill="none" stroke="#0e7490" strokeWidth="1.8" />
            <line x1={activeX} y1="0" x2={activeX} y2="100" stroke="#0f172a" strokeWidth="0.8" />
          </svg>
        ) : sorted.length === 1 ? (
          <svg
            ref={svgRef}
            viewBox="0 0 100 100"
            className="h-full w-full cursor-crosshair"
            preserveAspectRatio="none"
            onMouseMove={(event) => handleMove(event.clientX)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <line x1="0" y1={singleY} x2="100" y2={singleY} stroke="#0e7490" strokeWidth="1.6" />
            <circle cx="50" cy={singleY} r="1.8" fill="#0e7490" />
          </svg>
        ) : (
          <p className="text-xs text-muted-foreground">
            No funding points returned for this replay window.
          </p>
        )}
      </div>
    </div>
  )
}
