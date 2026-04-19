import { cn } from "@/lib/cn"

type BadgeProps = {
  children: React.ReactNode
  tone?: "default" | "green" | "red"
}

export function Badge({ children, tone = "default" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]",
        tone === "green" && "bg-emerald-400/18 text-emerald-200 ring-1 ring-emerald-400/30",
        tone === "red" && "bg-rose-400/18 text-rose-200 ring-1 ring-rose-400/30",
        tone === "default" && "bg-muted/85 text-muted-foreground ring-1 ring-border/70"
      )}
    >
      {children}
    </span>
  )
}
