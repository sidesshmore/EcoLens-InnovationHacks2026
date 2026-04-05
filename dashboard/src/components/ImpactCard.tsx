"use client"

import { useState } from "react"
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Share2, Check } from "lucide-react"

export function ImpactCard({ totalKg, scanCount, email }: {
  totalKg:   number
  scanCount: number
  email:     string
}) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const text =
      `I've avoided ${totalKg.toFixed(1)} kg of CO₂ by making sustainable choices on Amazon` +
      ` (${scanCount} products scored with EcoLens). ecolens.app`
    if (navigator.share) {
      try { await navigator.share({ title: "My EcoLens Impact", text }); return } catch {}
    }
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const kmEquiv   = Math.round(totalKg * 8.3)
  const treeYears = (totalKg / 21).toFixed(2)

  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-green-600 to-green-400" />
      <CardHeader>
        <CardTitle>Impact Summary</CardTitle>
        <CardDescription>Your cumulative environmental savings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary metric */}
        <div>
          <p className="text-4xl font-bold tracking-tight text-foreground leading-none">
            {totalKg.toFixed(1)}
            <span className="text-xl font-semibold text-muted-foreground ml-1.5">kg CO₂</span>
          </p>
          <p className="text-sm text-muted-foreground mt-1.5">avoided through greener choices</p>
        </div>

        <Separator />

        {/* Context breakdown */}
        <div className="space-y-2.5">
          {[
            { label: "Driving equivalent",  value: `${kmEquiv} km`         },
            { label: "Tree absorption",      value: `${treeYears} tree-yrs` },
            { label: "Products scored",      value: String(scanCount)       },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="text-sm font-semibold text-foreground">{value}</span>
            </div>
          ))}
        </div>

        <Separator />

        {/* Share button */}
        <button
          onClick={handleShare}
          className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted text-sm font-medium transition-colors cursor-pointer"
        >
          {copied ? (
            <><Check className="h-4 w-4 text-green-600" /> Copied to clipboard</>
          ) : (
            <><Share2 className="h-4 w-4" /> Share my impact</>
          )}
        </button>

        <p className="text-xs text-center text-muted-foreground">
          EcoLens · Innovation Hacks 2026
        </p>
      </CardContent>
    </Card>
  )
}
