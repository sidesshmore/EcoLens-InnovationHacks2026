import { ExternalLink } from "lucide-react"
import type { RichScanItem } from "@/lib/supabase"

// ── Dimension metadata ────────────────────────────────────────────────────────

const DIM_META = [
  { key: "carbon",         label: "Carbon Footprint", icon: "🌫️", weight: "30%" },
  { key: "brand_ethics",   label: "Brand Ethics",     icon: "🤝", weight: "25%" },
  { key: "packaging",      label: "Packaging",        icon: "📦", weight: "20%" },
  { key: "certifications", label: "Certifications",   icon: "🏆", weight: "15%" },
  { key: "durability",     label: "Durability",       icon: "⚙️", weight: "10%" },
] as const

// ── Score-based theme helpers ─────────────────────────────────────────────────

function scoreTheme(score: number) {
  if (score >= 75) return {
    gradient:     "from-emerald-50 to-white",
    border:       "border-l-emerald-500",
    ring:         "ring-emerald-200",
    badgeBg:      "bg-emerald-600",
    badgeText:    "text-white",
    verdictBg:    "bg-emerald-100",
    verdictText:  "text-emerald-800",
    verdictLabel: "BUY",
  }
  if (score >= 60) return {
    gradient:     "from-sky-50 to-white",
    border:       "border-l-sky-500",
    ring:         "ring-sky-200",
    badgeBg:      "bg-sky-600",
    badgeText:    "text-white",
    verdictBg:    "bg-sky-100",
    verdictText:  "text-sky-800",
    verdictLabel: "BUY",
  }
  if (score >= 45) return {
    gradient:     "from-amber-50 to-white",
    border:       "border-l-amber-500",
    ring:         "ring-amber-200",
    badgeBg:      "bg-amber-500",
    badgeText:    "text-white",
    verdictBg:    "bg-amber-100",
    verdictText:  "text-amber-800",
    verdictLabel: "PAUSE",
  }
  return {
    gradient:     "from-red-50 to-white",
    border:       "border-l-red-500",
    ring:         "ring-red-200",
    badgeBg:      "bg-red-500",
    badgeText:    "text-white",
    verdictBg:    "bg-red-100",
    verdictText:  "text-red-800",
    verdictLabel: "SKIP",
  }
}

function dimBarColor(score: number) {
  if (score >= 65) return "bg-emerald-500"
  if (score >= 40) return "bg-amber-400"
  return "bg-red-400"
}

function confidenceDot(confidence: "High" | "Medium" | "Low") {
  if (confidence === "High")   return "bg-emerald-500"
  if (confidence === "Medium") return "bg-amber-400"
  return "bg-zinc-400"
}

// ── Relative date ─────────────────────────────────────────────────────────────

function relativeDate(iso: string): string {
  const ms   = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 1)   return "just now"
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs  < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)   return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ── Alt score badge (small) ───────────────────────────────────────────────────

function AltScoreBadge({ score }: { score: number }) {
  const bg =
    score >= 75 ? "bg-emerald-600 text-white" :
    score >= 60 ? "bg-sky-600 text-white"     :
    score >= 45 ? "bg-amber-500 text-white"   :
                  "bg-red-500 text-white"
  return (
    <span className={`inline-flex items-center justify-center h-8 w-8 rounded-lg text-xs font-bold shrink-0 ${bg}`}>
      {score}
    </span>
  )
}

// ── ProductCard ───────────────────────────────────────────────────────────────

export function ProductCard({ item }: { item: RichScanItem }) {
  const theme = scoreTheme(item.score)

  // Find the lowest-scoring dimension key
  const dimEntries = DIM_META.map(d => ({
    ...d,
    value: (item.dimensions as unknown as Record<string, number>)[d.key] ?? 0,
  }))
  const lowestKey = dimEntries.reduce((min, d) => d.value < min.value ? d : min, dimEntries[0]).key

  const amazonUrl = `https://www.amazon.com/dp/${item.asin}`

  return (
    <article
      className={`bg-white rounded-2xl border border-zinc-200 border-l-4 ${theme.border} shadow-sm overflow-hidden`}
    >
      {/* ── Section 1: Header ─────────────────────────────────────────────── */}
      <div className={`px-6 py-5 bg-gradient-to-r ${theme.gradient} border-b border-zinc-100`}>
        <div className="flex items-start gap-4">

          {/* Score badge */}
          <div className={`h-16 w-16 rounded-2xl bg-white shadow-sm flex flex-col items-center justify-center ring-2 ${theme.ring} shrink-0`}>
            <span className="text-2xl font-extrabold leading-none text-zinc-900 tabular-nums">
              {item.score}
            </span>
            <span className="text-xs text-zinc-400 font-medium mt-0.5">/100</span>
          </div>

          {/* Title + verdict */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-zinc-900 leading-snug mb-2">
              {item.product_title ?? item.asin}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {/* Verdict */}
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${theme.verdictBg} ${theme.verdictText}`}>
                {theme.verdictLabel}
              </span>
              {/* Climate pledge */}
              {item.climate_pledge_friendly && (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                  Climate Pledge Friendly ✓
                </span>
              )}
            </div>
          </div>

          {/* Meta: date + CO2 + decision */}
          <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
            <span className="text-xs text-zinc-400">{relativeDate(item.scanned_at)}</span>
            {item.co2_saved_kg > 0 && (
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                −{item.co2_saved_kg.toFixed(2)} kg CO₂
              </span>
            )}
            {item.decision === "skip" && (
              <span className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                Skipped
              </span>
            )}
            {item.decision === "buy" && (
              <span className="text-xs font-semibold text-zinc-700 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-full">
                Bought
              </span>
            )}
          </div>

        </div>
      </div>

      {/* ── Section 2: Dimensions ─────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-zinc-100">
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 border-l-2 border-emerald-400 pl-2">
          Sustainability Breakdown
        </p>
        <div className="space-y-2.5">
          {dimEntries.map(dim => {
            const isLowest = dim.key === lowestKey
            return (
              <div
                key={dim.key}
                className={`flex items-center gap-3 ${isLowest ? "bg-red-50 rounded-lg px-2 -mx-2" : ""} py-0.5`}
              >
                <span className="text-base w-5 text-center shrink-0" aria-hidden>{dim.icon}</span>
                <span className="text-sm text-zinc-700 w-36 shrink-0 font-medium">{dim.label}</span>
                <span className="text-xs text-zinc-400 w-8 shrink-0">{dim.weight}</span>
                <div className="flex-1 h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${dimBarColor(dim.value)}`}
                    style={{ width: `${Math.max(2, dim.value)}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-zinc-700 tabular-nums w-12 text-right shrink-0">
                  {dim.value}/100
                </span>
                {isLowest && (
                  <span className="text-xs font-bold text-red-500 shrink-0">↓ Lowest</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Section 3: AI Explanation ─────────────────────────────────────── */}
      {item.explanation && (
        <div className="px-6 py-4 border-b border-zinc-100">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 border-l-2 border-emerald-400 pl-2">
            AI Analysis
          </p>
          <p className="text-base text-zinc-700 leading-relaxed">{item.explanation}</p>
        </div>
      )}

      {/* ── Section 5: Alternatives ───────────────────────────────────────── */}
      {item.alternatives.length > 0 && (
        <div className="px-6 py-4 border-b border-zinc-100">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 border-l-2 border-emerald-400 pl-2">
            Greener Alternatives
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            {item.alternatives.slice(0, 3).map(alt => (
              <a
                key={alt.asin}
                href={`https://www.amazon.com/dp/${alt.asin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 bg-emerald-50 rounded-xl border border-emerald-100 p-3 flex items-start gap-2.5 hover:bg-emerald-100 transition-colors group"
              >
                <AltScoreBadge score={alt.score} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 truncate leading-snug">{alt.title}</p>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">{alt.reason}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {alt.price_delta != null && (
                      <span className={`text-xs font-semibold ${alt.price_delta <= 0 ? "text-emerald-700" : "text-zinc-500"}`}>
                        {alt.price_delta === 0 ? "Same price" : alt.price_delta < 0 ? `$${Math.abs(alt.price_delta).toFixed(2)} cheaper` : `$${alt.price_delta.toFixed(2)} more`}
                      </span>
                    )}
                    <ExternalLink className="h-3 w-3 text-zinc-400 group-hover:text-emerald-600 ml-auto shrink-0" aria-hidden />
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 4: Footer ─────────────────────────────────────────────── */}
      <div className="px-6 py-3 bg-zinc-50/60 flex flex-wrap items-center gap-x-5 gap-y-2">

        {/* Confidence */}
        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span className={`h-2 w-2 rounded-full shrink-0 ${confidenceDot(item.confidence)}`} />
          {item.confidence} confidence
        </span>

        {/* Data sources */}
        {item.data_sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.data_sources.map(src => (
              <span
                key={src}
                className="text-xs bg-white border border-zinc-200 rounded-full px-2 py-0.5 text-zinc-500"
              >
                {src}
              </span>
            ))}
          </div>
        )}

        {/* Spacer */}
        <span className="flex-1" />

        {/* ASIN */}
        <span className="text-xs text-zinc-400 font-mono hidden sm:inline">{item.asin}</span>

        {/* Amazon link */}
        <a
          href={amazonUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
          aria-label={`View ${item.product_title ?? item.asin} on Amazon`}
        >
          Amazon <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>

      </div>
    </article>
  )
}
