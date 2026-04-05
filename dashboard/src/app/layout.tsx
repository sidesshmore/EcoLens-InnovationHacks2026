import type { Metadata } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import "./globals.css"
import { AccessibilityFAB } from "@/components/AccessibilityFAB"

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
})

export const metadata: Metadata = {
  title: "EcoLens — Know What You're Really Buying",
  description: "Track your sustainable shopping impact. See CO₂ saved, scan history, and sustainability streaks.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full bg-white text-zinc-900">
        <div id="app-content" className="min-h-full">
          {children}
        </div>
        <AccessibilityFAB />
      </body>
    </html>
  )
}
