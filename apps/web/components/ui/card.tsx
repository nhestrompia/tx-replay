import { cn } from "@/lib/cn"

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-lg border bg-card text-card-foreground", className)}>{children}</section>
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <header className={cn("border-b px-4 py-3", className)}>{children}</header>
}

export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h2 className={cn("text-base font-semibold", className)}>{children}</h2>
}

export function CardContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-4", className)}>{children}</div>
}
