import { cn } from "@/lib/cn"

export function PageShell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <main className={cn("container mx-auto py-6", className)}>{children}</main>
}
