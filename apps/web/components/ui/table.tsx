import { cn } from "@/lib/cn"

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return <table className={cn("w-full text-sm", className)}>{children}</table>
}

export function Thead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-muted/60 text-left">{children}</thead>
}

export function Tbody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y">{children}</tbody>
}

export function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2 font-medium text-muted-foreground">{children}</th>
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2", className)}>{children}</td>
}
