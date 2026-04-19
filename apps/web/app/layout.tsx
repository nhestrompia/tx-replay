import type { Metadata } from "next"
import { Public_Sans, Rajdhani } from "next/font/google"

import { Providers } from "@/app/providers"
import "@/app/globals.css"

const bodyFont = Public_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap"
})

const displayFont = Rajdhani({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"]
})

export const metadata: Metadata = {
  title: "Hyperliquid Position Replayer",
  description: "Wallet-first position reconstruction and replay for Hyperliquid"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
