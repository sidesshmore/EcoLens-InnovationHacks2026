import type { ScanHistoryItem } from "@/lib/supabase"
import { ExternalLink } from "lucide-react"

function relDate(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7)  return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function ScoreBadge({ score }: { score: number }) {
  const cfg =
    score >= 75 ? { ring: "ring-emerald-200 bg-emerald-50 text-emerald-700",  label: "Excellent", dot: "bg-emerald-500" } :
    score >= 55 ? { ring: "ring-sky-200 bg-sky-50 text-sky-700",              label: "Good",      dot: "bg-sky-500"     } :
    score >= 40 ? { ring: "ring-amber-200 bg-amber-50 text-amber-700",        label: "Fair",      dot: "bg-amber-500"   } :
    score >= 25 ? { ring: "ring-orange-200 bg-orange-50 text-orange-700",     label: "Poor",      dot: "bg-orange-500"  } :
                  { ring: "ring-red-200 bg-red-50 text-red-700",              label: "Avoid",     dot: "bg-red-500"     }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-bold tabular-nums ring-1 ${cfg.ring}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
        {score}
      </span>
      <span className="text-sm text-zinc-400">{cfg.label}</span>
    </span>
  )
}

export function ScanHistory({ items }: { items: ScanHistoryItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-400 py-2">No scans yet. Visit any Amazon product page with the extension installed.</p>
  }

  return (
    <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gradient-to-r from-zinc-50 to-zinc-100/60 border-b border-zinc-200">
            <th className="text-left text-sm font-semibold text-zinc-500 px-4 py-3 w-40">Score</th>
            <th className="text-left text-sm font-semibold text-zinc-500 px-2 py-3">Product</th>
            <th className="text-right text-sm font-semibold text-zinc-500 px-4 py-3 w-28">CO₂ saved</th>
            <th className="text-right text-sm font-semibold text-zinc-500 px-4 py-3 w-20">When</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr
              key={item.id}
              className={`group border-b border-zinc-100 last:border-0 hover:bg-emerald-50/40 transition-colors duration-150 ${idx % 2 === 0 ? "bg-white" : "bg-zinc-50/40"}`}
            >
              <td className="px-4 py-2.5">
                {item.score !== null
                  ? <ScoreBadge score={item.score} />
                  : <span className="text-zinc-300 text-xs">—</span>}
              </td>
              <td className="px-2 py-2.5 pr-6">
                <span className="text-zinc-800 leading-snug line-clamp-2 font-medium">
                  {item.product_title ?? item.asin}
                </span>
                <a
                  href={`https://amazon.com/dp/${item.asin}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-xs text-zinc-400 hover:text-emerald-600 transition-colors mt-0.5 opacity-0 group-hover:opacity-100"
                >
                  {item.asin} <ExternalLink className="h-2.5 w-2.5" aria-hidden />
                </a>
              </td>
              <td className="px-4 py-2.5 text-right">
                {item.co2_saved_kg > 0 ? (
                  <span className="inline-flex items-center gap-0.5 text-emerald-600 font-semibold tabular-nums text-sm bg-emerald-50 px-2 py-0.5 rounded-full ring-1 ring-emerald-200">
                    −{item.co2_saved_kg.toFixed(2)} kg
                  </span>
                ) : (
                  <span className="text-zinc-300">—</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right text-zinc-400 text-sm tabular-nums">{relDate(item.scanned_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
