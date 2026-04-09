import { cn } from "@/lib/cn"

type BadgeProps = {
  children: React.ReactNode
  tone?: "default" | "green" | "red"
}

export function Badge({ children, tone = "default" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "green" && "bg-emerald-100 text-emerald-800",
        tone === "red" && "bg-rose-100 text-rose-800",
        tone === "default" && "bg-muted text-muted-foreground"
      )}
    >
      {children}
    </span>
  )
}
