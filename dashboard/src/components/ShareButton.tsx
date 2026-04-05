"use client"

import { useState } from "react"
import { Share2, Check } from "lucide-react"

export function ShareButton({ totalKg, scanCount }: {
  totalKg:   number
  scanCount: number
}) {
  const [copied, setCopied] = useState(false)

  async function handle() {
    const text =
      `I've avoided ${totalKg.toFixed(1)} kg of CO₂ through eco-conscious shopping ` +
      `(${scanCount} products scored with EcoLens).`
    if (navigator.share) {
      try { await navigator.share({ title: "My EcoLens Impact", text }); return } catch {}
    }
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  return (
    <button
      onClick={handle}
      className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
    >
      {copied
        ? <><Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />Copied to clipboard</>
        : <><Share2 className="h-3.5 w-3.5" aria-hidden="true" />Share my impact</>}
    </button>
  )
}
