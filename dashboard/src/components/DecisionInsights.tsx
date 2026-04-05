import type { DecisionStats } from "@/lib/supabase"
import { SkipForward, ShoppingCart, Leaf } from "lucide-react"

function relDate(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`
}

export function DecisionInsights({ decisions }: { decisions: DecisionStats }) {
  const { skipCount, buyCount, totalCo2, skipRate, items } = decisions
  const total = skipCount + buyCount

  if (total === 0) {
    return <p className="text-sm text-zinc-400 py-2">No decisions logged yet. Skip or buy a scanned product to record one.</p>
  }

  const rateColor =
    skipRate >= 60 ? "text-emerald-600" :
    skipRate >= 35 ? "text-amber-500"   :
    "text-red-500"

  const rateRing =
    skipRate >= 60 ? "ring-emerald-200 bg-emerald-50" :
    skipRate >= 35 ? "ring-amber-200 bg-amber-50"     :
    "ring-red-200 bg-red-50"

  return (
    <div className="space-y-4">
      {/* Narrative */}
      <p className="text-base text-zinc-600 leading-relaxed">
        {totalCo2 > 0
          ? <>Kept <span className="font-bold text-zinc-900">{totalCo2.toFixed(1)} kg</span> of CO₂ out of your cart by skipping {skipCount} low-rated product{skipCount !== 1 ? "s" : ""}.</>
          : <>Logged {total} purchase decision{total !== 1 ? "s" : ""}.</>}
      </p>

      {/* Rate + stat pills */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-2xl font-bold tabular-nums ${rateColor} ${rateRing} ring-1 px-3 py-1 rounded-xl`}>
          {skipRate}%
          <span className="text-xs font-semibold ml-1 opacity-70">eco-conscious</span>
        </span>
      </div>

      {/* 3 mini-stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-lg px-2.5 py-2 text-center">
          <p className="text-lg font-bold text-emerald-700 tabular-nums">{skipCount}</p>
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mt-0.5">skipped</p>
        </div>
        <div className="bg-zinc-50 ring-1 ring-zinc-200 rounded-lg px-2.5 py-2 text-center">
          <p className="text-lg font-bold text-zinc-700 tabular-nums">{buyCount}</p>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mt-0.5">bought</p>
        </div>
        <div className="bg-sky-50 ring-1 ring-sky-200 rounded-lg px-2.5 py-2 text-center">
          <p className="text-lg font-bold text-sky-700 tabular-nums">{totalCo2.toFixed(1)}</p>
          <p className="text-xs font-semibold text-sky-600 uppercase tracking-wide mt-0.5">kg saved</p>
        </div>
      </div>

      {/* Recent list */}
      {items.length > 0 && (
        <div className="border border-zinc-200 rounded-xl overflow-hidden">
          {items.slice(0, 5).map((d, i) => (
            <div
              key={i}
              className={`flex items-center gap-2.5 px-3 py-2 border-b border-zinc-100 last:border-0 hover:bg-zinc-50 transition-colors ${
                d.decision === "skip" ? "hover:bg-emerald-50/40" : ""
              }`}
            >
              <div className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 ${
                d.decision === "skip" ? "bg-emerald-100 ring-1 ring-emerald-200" : "bg-zinc-100 ring-1 ring-zinc-200"
              }`}>
                {d.decision === "skip"
                  ? <SkipForward className="h-3 w-3 text-emerald-600" aria-hidden />
                  : <ShoppingCart className="h-3 w-3 text-zinc-500" aria-hidden />}
              </div>
              <span className="flex-1 text-sm text-zinc-700 truncate font-medium">{(d as any).product_title ?? d.asin}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {d.co2_avoided_kg > 0 && (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full ring-1 ring-emerald-200">
                    −{d.co2_avoided_kg.toFixed(2)} kg
                  </span>
                )}
                <span className="text-xs text-zinc-400">{relDate(d.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
