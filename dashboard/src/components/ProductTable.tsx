"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Search, X, ExternalLink, ChevronUp, ChevronDown } from "lucide-react"
import type { RichScanItem } from "@/lib/supabase"

// ── Dimension metadata ────────────────────────────────────────────────────────

const DIM_META = [
  { key: "carbon",         label: "Carbon Footprint", icon: "🌫️", weight: "30%" },
  { key: "brand_ethics",   label: "Brand Ethics",     icon: "🤝", weight: "25%" },
  { key: "packaging",      label: "Packaging",        icon: "📦", weight: "20%" },
  { key: "certifications", label: "Certifications",   icon: "🏆", weight: "15%" },
  { key: "durability",     label: "Durability",       icon: "⚙️", weight: "10%" },
] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreTheme(score: number) {
  if (score >= 75) return { gradient: "from-emerald-50 to-white", ring: "ring-emerald-200", badgeBg: "bg-emerald-600", verdictBg: "bg-emerald-100", verdictText: "text-emerald-800", verdictLabel: "BUY",   bar: "bg-emerald-500" }
  if (score >= 60) return { gradient: "from-sky-50 to-white",     ring: "ring-sky-200",     badgeBg: "bg-sky-600",     verdictBg: "bg-sky-100",     verdictText: "text-sky-800",     verdictLabel: "BUY",   bar: "bg-sky-500"     }
  if (score >= 45) return { gradient: "from-amber-50 to-white",   ring: "ring-amber-200",   badgeBg: "bg-amber-500",   verdictBg: "bg-amber-100",   verdictText: "text-amber-800",   verdictLabel: "PAUSE", bar: "bg-amber-400"   }
  return                  { gradient: "from-red-50 to-white",     ring: "ring-red-200",     badgeBg: "bg-red-500",     verdictBg: "bg-red-100",     verdictText: "text-red-800",     verdictLabel: "SKIP",  bar: "bg-red-400"     }
}

function dimBarColor(score: number) {
  if (score >= 65) return "bg-emerald-500"
  if (score >= 40) return "bg-amber-400"
  return "bg-red-400"
}

function confidenceDot(c: "High" | "Medium" | "Low") {
  if (c === "High")   return "bg-emerald-500"
  if (c === "Medium") return "bg-amber-400"
  return "bg-zinc-400"
}

function relativeDate(iso: string): string {
  const ms   = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 1)   return "Just now"
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)   return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ── Detail modal ─────────────────────────────────────────────────────────────

function ProductDetail({ item, onClose }: { item: RichScanItem; onClose: () => void }) {
  const theme = scoreTheme(item.score)
  const dimEntries = DIM_META.map(d => ({
    ...d,
    value: (item.dimensions as unknown as Record<string, number>)[d.key] ?? 0,
  }))
  const lowestKey = dimEntries.reduce(
    (min, d) => d.value < min.value ? d : min,
    dimEntries[0]
  ).key

  const handleClose = useCallback(onClose, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose() }
    document.addEventListener("keydown", handler)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handler)
      document.body.style.overflow = ""
    }
  }, [handleClose])

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">

        {/* Modal header */}
        <div className={`px-6 py-5 bg-gradient-to-r ${theme.gradient} border-b border-zinc-100 flex items-start gap-4 shrink-0`}>
          <div className={`h-14 w-14 rounded-xl bg-white shadow-sm flex flex-col items-center justify-center ring-2 ${theme.ring} shrink-0`}>
            <span className="text-2xl font-extrabold leading-none text-zinc-900 tabular-nums">{item.score}</span>
            <span className="text-xs text-zinc-400 font-medium">/100</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-zinc-900 leading-snug">{item.product_title ?? item.asin}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${theme.verdictBg} ${theme.verdictText}`}>
                {theme.verdictLabel}
              </span>
              {item.climate_pledge_friendly && (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Climate Pledge ✓
                </span>
              )}
              {item.decision === "skip" && (
                <span className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                  Skipped
                </span>
              )}
              {item.decision === "buy" && (
                <span className="text-xs font-semibold text-zinc-600 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-full">
                  Bought
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors shrink-0 mt-0.5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">

          {/* Dimensions */}
          <div className="px-6 py-4 border-b border-zinc-100">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 border-l-2 border-emerald-400 pl-2">
              Sustainability Breakdown
            </p>
            <div className="space-y-2">
              {dimEntries.map(dim => {
                const isLowest = dim.key === lowestKey
                return (
                  <div
                    key={dim.key}
                    className={`flex items-center gap-3 py-1 ${isLowest ? "bg-red-50 rounded-lg px-2 -mx-2" : ""}`}
                  >
                    <span className="w-5 text-center text-base shrink-0" aria-hidden>{dim.icon}</span>
                    <span className="text-sm font-medium text-zinc-700 w-36 shrink-0">{dim.label}</span>
                    <span className="text-xs text-zinc-400 w-7 shrink-0">{dim.weight}</span>
                    <div className="flex-1 h-2 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${dimBarColor(dim.value)}`}
                        style={{ width: `${Math.max(2, dim.value)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-zinc-700 tabular-nums w-12 text-right shrink-0">
                      {dim.value}/100
                    </span>
                    {isLowest && (
                      <span className="text-xs font-bold text-red-500 shrink-0">↓ Low</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* AI Explanation */}
          {item.explanation && (
            <div className="px-6 py-4 border-b border-zinc-100">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 border-l-2 border-emerald-400 pl-2">
                AI Analysis
              </p>
              <p className="text-sm text-zinc-700 leading-relaxed">{item.explanation}</p>
            </div>
          )}

          {/* Alternatives */}
          {item.alternatives.length > 0 && (
            <div className="px-6 py-4 border-b border-zinc-100">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 border-l-2 border-emerald-400 pl-2">
                Greener Alternatives
              </p>
              <div className="space-y-2">
                {item.alternatives.slice(0, 3).map(alt => {
                  const altTheme = scoreTheme(alt.score)
                  return (
                    <a
                      key={alt.asin}
                      href={`https://www.amazon.com/dp/${alt.asin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 bg-emerald-50 rounded-xl border border-emerald-100 px-3 py-2.5 hover:bg-emerald-100 transition-colors group"
                    >
                      <span className={`inline-flex items-center justify-center h-8 w-10 rounded-lg text-xs font-bold text-white shrink-0 ${altTheme.badgeBg}`}>
                        {alt.score}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 truncate">{alt.title}</p>
                        <p className="text-xs text-zinc-500 truncate">{alt.reason}</p>
                      </div>
                      {alt.price_delta != null && (
                        <span className={`text-xs font-semibold shrink-0 ${alt.price_delta <= 0 ? "text-emerald-700" : "text-zinc-500"}`}>
                          {alt.price_delta === 0 ? "Same price" : alt.price_delta < 0 ? `$${Math.abs(alt.price_delta).toFixed(2)} cheaper` : `$${alt.price_delta.toFixed(2)} more`}
                        </span>
                      )}
                      <ExternalLink className="h-3.5 w-3.5 text-zinc-400 shrink-0 group-hover:text-emerald-600 transition-colors" aria-hidden />
                    </a>
                  )
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-3 bg-zinc-50/70 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="flex items-center gap-1.5 text-sm text-zinc-500">
              <span className={`h-2 w-2 rounded-full shrink-0 ${confidenceDot(item.confidence)}`} />
              {item.confidence} confidence
            </span>
            {item.data_sources.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {item.data_sources.map(src => (
                  <span key={src} className="text-xs bg-white border border-zinc-200 rounded-full px-2 py-0.5 text-zinc-500">
                    {src}
                  </span>
                ))}
              </div>
            )}
            <span className="flex-1" />
            <span className="text-xs text-zinc-400 font-mono hidden sm:inline">{item.asin}</span>
            <a
              href={`https://www.amazon.com/dp/${item.asin}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              Amazon <ExternalLink className="h-3.5 w-3.5 ml-0.5" aria-hidden />
            </a>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15

type SortKey      = "score" | "scanned_at" | "co2_saved_kg" | "product_title"
type SortDir      = "asc"   | "desc"
type VerdictFilter = "all"  | "BUY" | "PAUSE" | "SKIP"

function SortBtn({ col, active, dir, onClick, children }: {
  col: SortKey; active: boolean; dir: SortDir
  onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 hover:text-zinc-700 transition-colors"
    >
      {children}
      {active
        ? dir === "asc"
          ? <ChevronUp   className="h-3 w-3 text-zinc-600" />
          : <ChevronDown className="h-3 w-3 text-zinc-600" />
        : <ChevronDown className="h-3 w-3 opacity-25" />}
    </button>
  )
}

function Pagination({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void
}) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  const pages: (number | "…")[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3)                 pages.push("…")
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2)    pages.push("…")
    pages.push(totalPages)
  }

  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between mt-3 px-1">
      <span className="text-sm text-zinc-400">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          aria-label="Previous page"
        >
          <ChevronUp className="h-4 w-4 -rotate-90" />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="h-8 w-8 flex items-center justify-center text-sm text-zinc-300 select-none">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`h-8 w-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                page === p
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          disabled={page === totalPages}
          onClick={() => onChange(page + 1)}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          aria-label="Next page"
        >
          <ChevronDown className="h-4 w-4 -rotate-90" />
        </button>
      </div>
    </div>
  )
}

export function ProductTable({ items }: { items: RichScanItem[] }) {
  const [query,    setQuery]    = useState("")
  const [verdict,  setVerdict]  = useState<VerdictFilter>("all")
  const [sortKey,  setSortKey]  = useState<SortKey>("scanned_at")
  const [sortDir,  setSortDir]  = useState<SortDir>("desc")
  const [page,     setPage]     = useState(1)
  const [selected, setSelected] = useState<RichScanItem | null>(null)

  // Reset to page 1 whenever filters/sort change
  useEffect(() => setPage(1), [query, verdict, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir(key === "scanned_at" ? "desc" : key === "score" ? "desc" : "asc") }
  }

  // Counts per verdict for the filter chips
  const counts = useMemo(() => {
    const c = { BUY: 0, PAUSE: 0, SKIP: 0 }
    for (const i of items) {
      const v = scoreTheme(i.score).verdictLabel as keyof typeof c
      c[v]++
    }
    return c
  }, [items])

  // Filter + sort
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = items

    if (q) {
      list = list.filter(i =>
        (i.product_title ?? "").toLowerCase().includes(q) ||
        i.asin.toLowerCase().includes(q)
      )
    }
    if (verdict !== "all") {
      list = list.filter(i => scoreTheme(i.score).verdictLabel === verdict)
    }

    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === "score")         cmp = a.score           - b.score
      if (sortKey === "co2_saved_kg")  cmp = a.co2_saved_kg    - b.co2_saved_kg
      if (sortKey === "scanned_at")    cmp = new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime()
      if (sortKey === "product_title") cmp = (a.product_title ?? "").localeCompare(b.product_title ?? "")
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [items, query, verdict, sortKey, sortDir])

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const FILTER_TABS: { key: VerdictFilter; label: string; count: number }[] = [
    { key: "all",   label: "All",   count: items.length },
    { key: "BUY",   label: "BUY",   count: counts.BUY   },
    { key: "PAUSE", label: "PAUSE", count: counts.PAUSE  },
    { key: "SKIP",  label: "SKIP",  count: counts.SKIP   },
  ]

  return (
    <>
      {/* ── Search + filters row ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or ASIN…"
            className="w-full pl-10 pr-9 py-2 text-sm border border-zinc-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-zinc-300 placeholder:text-zinc-400"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Verdict filter tabs */}
        <div className="flex items-center gap-1 bg-zinc-100 rounded-xl p-1 shrink-0">
          {FILTER_TABS.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setVerdict(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                verdict === key
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {label}
              <span className={`text-xs tabular-nums ${verdict === key ? "text-zinc-400" : "text-zinc-400"}`}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">

        {/* Column headers */}
        <div className="grid grid-cols-[56px_1fr_84px_100px_80px] border-b border-zinc-200 bg-zinc-50 px-0 text-xs font-semibold text-zinc-400 uppercase tracking-wider select-none">
          <div className="px-4 py-3">
            <SortBtn col="score" active={sortKey === "score"} dir={sortDir} onClick={() => toggleSort("score")}>
              Score
            </SortBtn>
          </div>
          <div className="px-3 py-3">
            <SortBtn col="product_title" active={sortKey === "product_title"} dir={sortDir} onClick={() => toggleSort("product_title")}>
              Product
            </SortBtn>
          </div>
          <div className="px-3 py-3 text-zinc-400">Verdict</div>
          <div className="px-3 py-3">
            <SortBtn col="co2_saved_kg" active={sortKey === "co2_saved_kg"} dir={sortDir} onClick={() => toggleSort("co2_saved_kg")}>
              CO₂
            </SortBtn>
          </div>
          <div className="px-3 py-3 flex justify-end pr-4">
            <SortBtn col="scanned_at" active={sortKey === "scanned_at"} dir={sortDir} onClick={() => toggleSort("scanned_at")}>
              Date
            </SortBtn>
          </div>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-zinc-400">
              {query || verdict !== "all" ? "No products match these filters." : "No scans yet."}
            </p>
          </div>
        ) : (
          pageItems.map(item => {
            const theme = scoreTheme(item.score)
            return (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className="grid grid-cols-[56px_1fr_84px_100px_80px] w-full border-b border-zinc-100 last:border-0 hover:bg-zinc-50/80 transition-colors text-left focus-visible:outline-none focus-visible:bg-zinc-50"
              >
                <div className="px-4 py-3 flex items-center">
                  <span className={`inline-flex items-center justify-center h-8 w-10 rounded-lg text-sm font-bold text-white tabular-nums ${theme.badgeBg}`}>
                    {item.score}
                  </span>
                </div>
                <div className="px-3 py-3 flex items-center min-w-0">
                  <div className="flex flex-col min-w-0 overflow-hidden">
                    <span className="text-sm font-medium text-zinc-900 truncate">
                      {item.product_title ?? item.asin}
                    </span>
                    {item.product_title && item.product_title !== item.asin && !item.product_title.includes(" ") && (
                      <span className="text-[11px] text-zinc-400 font-mono truncate">{item.asin}</span>
                    )}
                  </div>
                </div>
                <div className="px-3 py-3 flex items-center">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${theme.verdictBg} ${theme.verdictText}`}>
                    {theme.verdictLabel}
                  </span>
                </div>
                <div className="px-3 py-3 flex items-center">
                  {item.co2_saved_kg > 0 ? (
                    <span className="text-sm font-medium text-emerald-600 tabular-nums">
                      −{item.co2_saved_kg.toFixed(2)} kg
                    </span>
                  ) : (
                    <span className="text-sm text-zinc-300">—</span>
                  )}
                </div>
                <div className="pr-4 py-3 flex items-center justify-end">
                  <span className="text-sm text-zinc-400 tabular-nums whitespace-nowrap">
                    {relativeDate(item.scanned_at)}
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      <Pagination
        page={page}
        total={filtered.length}
        pageSize={PAGE_SIZE}
        onChange={setPage}
      />

      {/* Detail modal */}
      {selected && (
        <ProductDetail item={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}
