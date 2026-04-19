import { cn } from "@/lib/cn"

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/80 bg-card/90 text-card-foreground shadow-[0_18px_48px_-28px_rgba(5,8,20,0.95)]",
        className
      )}
    >
      {children}
    </section>
  )
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <header className={cn("px-5 pb-0 pt-5 md:px-6 md:pt-6", className)}>{children}</header>
}

export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h2 className={cn("text-lg font-semibold leading-tight", className)}>{children}</h2>
}

export function CardContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-5 md:p-6", className)}>{children}</div>
}
