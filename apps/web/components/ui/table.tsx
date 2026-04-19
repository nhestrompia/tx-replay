import { cn } from "@/lib/cn"

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return <table className={cn("w-full text-sm text-foreground", className)}>{children}</table>
}

export function Thead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-muted/55 text-left">{children}</thead>
}

export function Tbody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border/70">{children}</tbody>
}

export function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{children}</th>
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2.5", className)}>{children}</td>
}
