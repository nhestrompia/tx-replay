import { cn } from "@/lib/cn"

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return <table className={cn("w-full text-sm text-foreground", className)}>{children}</table>
}

export function Thead({ className, children }: { className?: string; children: React.ReactNode }) {
  return <thead className={cn("bg-muted/55 text-left", className)}>{children}</thead>
}

export function Tbody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <tbody className={cn("divide-y divide-border/70", className)}>{children}</tbody>
}

export function Th({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
        className
      )}
    >
      {children}
    </th>
  )
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2.5", className)}>{children}</td>
}
