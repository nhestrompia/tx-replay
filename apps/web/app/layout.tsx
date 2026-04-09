import type { Metadata } from "next"

import { Providers } from "@/app/providers"
import "@/app/globals.css"

export const metadata: Metadata = {
  title: "Hyperliquid Position Replayer",
  description: "Wallet-first position reconstruction and replay for Hyperliquid"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
