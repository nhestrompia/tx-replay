import { cn } from "@/lib/cn"

export function PageShell({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <main className={cn("app-shell mx-auto w-full max-w-[1380px] px-4 pb-10 pt-6 md:px-6 md:pt-8", className)}>
      {children}
    </main>
  )
}
