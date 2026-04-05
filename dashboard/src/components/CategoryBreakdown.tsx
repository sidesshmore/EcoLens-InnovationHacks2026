import type { ScanHistoryItem } from "@/lib/supabase"

const PATTERNS: [string, RegExp][] = [
  ["Electronics",       /phone|tablet|laptop|monitor|keyboard|mouse|cable|charger|speaker|headphone|earbud|camera|tv\b|television|printer|router|smart home|echo|kindle|fire hd|usb|hdmi|graphics card|processor|ram\b/i],
  ["Clothing",          /shirt|pants|jeans|jacket|coat|shoe|boot|dress|sweater|hoodie|sock|underwear|clothing|apparel|sneaker|sandal|hat\b|cap\b|glove/i],
  ["Home & Kitchen",    /pillow|lamp|chair|desk|shelf|storage|cookware|pan\b|pot\b|bathroom|curtain|mattress|furniture|blender|toaster|coffee maker|vacuum|mop|broom|dish/i],
  ["Food & Health",     /food|snack|drink|coffee|tea\b|supplement|vitamin|protein|granola|cereal|organic|health|nutrition|energy bar/i],
  ["Sports & Outdoors", /gym|yoga|fitness|exercise|sport|bike|bicycle|ball\b|mat\b|dumbbell|treadmill|running|camping|hiking|tent\b/i],
  ["Books & Media",     /book\b|novel|textbook|guide\b|manual\b|hardcover|paperback|audiobook/i],
  ["Garden & Tools",    /garden|plant\b|seed\b|outdoor|lawn|pool\b|drill\b|hammer|wrench|screwdriver|hardware/i],
  ["Beauty & Personal", /shampoo|conditioner|moisturizer|serum|lipstick|mascara|perfume|cologne|razor|toothbrush|skincare|haircare/i],
  ["Toys & Games",      /toy\b|game\b|puzzle|lego|kids|children|baby|doll|board game|action figure/i],
]

const COLORS: Record<string, { dot: string; bar: string; track: string }> = {
  "Electronics":       { dot: "bg-blue-500",    bar: "bg-gradient-to-r from-blue-400 to-blue-500",    track: "bg-blue-100"    },
  "Clothing":          { dot: "bg-violet-500",  bar: "bg-gradient-to-r from-violet-400 to-violet-500",track: "bg-violet-100"  },
  "Home & Kitchen":    { dot: "bg-amber-500",   bar: "bg-gradient-to-r from-amber-400 to-amber-500",  track: "bg-amber-100"   },
  "Food & Health":     { dot: "bg-emerald-500", bar: "bg-gradient-to-r from-emerald-400 to-emerald-500",track:"bg-emerald-100"},
  "Sports & Outdoors": { dot: "bg-orange-500",  bar: "bg-gradient-to-r from-orange-400 to-orange-500",track: "bg-orange-100"  },
  "Books & Media":     { dot: "bg-teal-500",    bar: "bg-gradient-to-r from-teal-400 to-teal-500",    track: "bg-teal-100"    },
  "Garden & Tools":    { dot: "bg-lime-500",    bar: "bg-gradient-to-r from-lime-400 to-lime-500",    track: "bg-lime-100"    },
  "Beauty & Personal": { dot: "bg-pink-500",    bar: "bg-gradient-to-r from-pink-400 to-pink-500",    track: "bg-pink-100"    },
  "Toys & Games":      { dot: "bg-yellow-500",  bar: "bg-gradient-to-r from-yellow-400 to-yellow-500",track:"bg-yellow-100"  },
  "Other":             { dot: "bg-zinc-400",    bar: "bg-gradient-to-r from-zinc-300 to-zinc-400",    track: "bg-zinc-100"    },
}

function inferCategory(title: string | null): string {
  if (!title) return "Other"
  for (const [cat, re] of PATTERNS) if (re.test(title)) return cat
  return "Other"
}

export function CategoryBreakdown({ items }: { items: ScanHistoryItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-400 py-2">No products scanned yet.</p>
  }

  const map = new Map<string, { count: number; co2: number; scores: number[] }>()
  for (const item of items) {
    const cat = inferCategory(item.product_title)
    if (!map.has(cat)) map.set(cat, { count: 0, co2: 0, scores: [] })
    const g = map.get(cat)!
    g.count++
    g.co2 += Number(item.co2_saved_kg ?? 0)
    if (item.score !== null) g.scores.push(item.score)
  }

  const rows = Array.from(map.entries())
    .map(([cat, g]) => ({
      cat,
      count:    g.count,
      co2:      Math.round(g.co2 * 100) / 100,
      avgScore: g.scores.length
        ? Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length)
        : null,
    }))
    .sort((a, b) => b.count - a.count)

  const maxCount = rows[0]?.count ?? 1

  return (
    <div className="space-y-3">
      {rows.map(({ cat, count, co2, avgScore }) => {
        const c = COLORS[cat] ?? COLORS["Other"]
        const pct = Math.round((count / maxCount) * 100)
        return (
          <div key={cat} className="group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${c.dot}`} />
                <span className="text-sm font-semibold text-zinc-700">{cat}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {co2 > 0 && (
                  <span className="text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-full ring-1 ring-emerald-200">
                    −{co2} kg
                  </span>
                )}
                {avgScore !== null && <span className="text-zinc-400">avg {avgScore}/100</span>}
                <span className="text-zinc-500 font-medium">{count}</span>
              </div>
            </div>
            <div className={`h-2 ${c.track} rounded-full overflow-hidden`}>
              <div
                className={`h-full rounded-full transition-all duration-700 ${c.bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
