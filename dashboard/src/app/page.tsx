import Image from "next/image"
import { auth0 } from "@/lib/auth0"
import {
  getCommunityStats, getRichScanHistory,
  type CommunityStats,
} from "@/lib/supabase"
import { ProductTable } from "@/components/ProductTable"
import { Leaf } from "lucide-react"

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default async function Home() {
  const session   = await auth0.getSession()
  const community = await getCommunityStats()
  if (!session) return <LandingPage community={community} />

  const email = session.user.email ?? ""
  const items = await getRichScanHistory(session.user.sub, 200)

  const totalKg  = items.reduce((s, i) => s + i.co2_saved_kg, 0)
  const avgScore = items.length
    ? Math.round(items.reduce((s, i) => s + i.score, 0) / items.length)
    : 0

  return (
    <div className="min-h-screen bg-white">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-zinc-200 sticky top-0 bg-background/90 backdrop-blur-sm z-10">
        <div className="max-w-5xl mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Leaf className="h-4 w-4 text-emerald-600" aria-hidden />
            <span className="text-sm font-bold text-zinc-900 tracking-tight">EcoLens</span>
          </div>
          <div className="flex items-center gap-5">
            <span className="text-sm text-zinc-400 hidden sm:block">{email}</span>
            <a
              href="/auth/logout"
              className="text-sm font-medium text-zinc-500 hover:text-zinc-900 border border-zinc-200 rounded-lg px-3 py-1 hover:bg-zinc-50 transition-all duration-150"
            >
              Sign out
            </a>
          </div>
        </div>
      </header>

      {/* ── Page title ──────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Scanned Products</h1>
        {items.length > 0 && (
          <p className="text-sm text-zinc-400 mt-1">
            {items.length} product{items.length !== 1 ? "s" : ""}
            {totalKg > 0 && <> · <span className="text-emerald-600 font-medium">{totalKg.toFixed(1)} kg CO₂ avoided</span></>}
            {avgScore > 0 && <> · avg score {avgScore}/100</>}
          </p>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-6 pb-16">
        <ProductTable items={items} />
      </main>

    </div>
  )
}

// ── Image helpers ─────────────────────────────────────────────────────────────

const T = (id: string) =>
  `https://lftz25oez4aqbxpq.public.blob.vercel-storage.com/image-${id}.png`

const IMG = {
  earth:   T("TjlQjzEjOBahJ7XJYI49jbifgXpz41"),
  leaf:    T("emC1BR5ljWANScSXgr4K8nwvA1f0aW"),
  bag:     T("1kzlhXN3lasEQYBtwdeQrzzhBEwurX"),
  barcode: T("F3M4BJ8SuSig9aCnYRXpV1IaSMwCXA"),
  recycle: T("HZ6ApvzZPWoVMnwUwVqBGJPM5thwro"),
  chart:   T("73pNGHJBFF75t0zRsAgQInW9DAM4vd"),
  glass:   T("QPl7zSOxUKmFrWf7nOJIZNsfnurbAG"),
  tree:    T("yLBbZMvacxsSxiNPlvXmLCiHRwgjc9"),
  laptop:  T("UsyTZyMk2er8VfZu1T68Z4BbnfHYL1"),
  check:   T("HiChF8iNxEQpjV9vKH44UoEduGznyr"),
}

// ── Landing page ──────────────────────────────────────────────────────────────

import { ArrowRight } from "lucide-react"

function LandingPage({ community }: { community: CommunityStats }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">

      <header className="border-b border-zinc-200 sticky top-0 bg-white z-10">
        <div className="max-w-4xl mx-auto px-8 h-11 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Leaf className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
            <span className="text-sm font-semibold text-zinc-900">EcoLens</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#install"  className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors hidden sm:block">Install</a>
            <a href="#features" className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors hidden sm:block">Features</a>
            <a href="/auth/login" className="text-xs font-medium text-zinc-700 border border-zinc-200 rounded px-3 py-1.5 hover:bg-zinc-50 transition-colors">
              Sign in
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">

        {/* Hero */}
        <section className="border-b border-zinc-200">
          <div className="max-w-4xl mx-auto px-8 py-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-6">
                Free Chrome Extension · Innovation Hacks 2026
              </p>
              <h1 className="text-5xl font-bold tracking-tight leading-[1.07] mb-5 text-zinc-900">
                Shop Amazon.<br />Know the planet&apos;s cost.
              </h1>
              <p className="text-base text-zinc-500 leading-relaxed mb-8 max-w-sm">
                EcoLens scores every Amazon product for sustainability —
                carbon, packaging, brand ethics — and surfaces greener alternatives instantly.
              </p>
              <div className="flex flex-wrap gap-3 mb-8">
                <a href="/ecolens-extension.zip" download
                  className="h-9 px-4 inline-flex items-center gap-2 rounded text-sm font-semibold bg-zinc-900 text-white hover:bg-zinc-700 transition-colors">
                  Download Extension <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </a>
                <a href="/auth/login"
                  className="h-9 px-4 inline-flex items-center rounded text-sm font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-colors">
                  Sign in
                </a>
              </div>
              {community.totalScans > 0 && (
                <p className="text-xs text-zinc-400">
                  <span className="font-medium text-zinc-600">{community.totalCo2Kg.toLocaleString()} kg CO₂</span> avoided
                  {" "}by {community.totalUsers.toLocaleString()} shoppers
                </p>
              )}
            </div>
            <div className="relative flex items-center justify-center h-72 lg:h-80 select-none pointer-events-none">
              <div className="absolute inset-0 flex items-center justify-center">
                <Image src={IMG.earth} alt="Earth" width={200} height={200} className="drop-shadow-xl opacity-90" />
              </div>
              <div className="absolute top-4 right-8 lg:right-12">
                <Image src={IMG.leaf} alt="" width={72} height={72} className="drop-shadow-lg" />
              </div>
              <div className="absolute bottom-4 left-8 lg:left-12">
                <Image src={IMG.bag} alt="" width={64} height={64} className="drop-shadow-lg" />
              </div>
              <div className="absolute top-8 left-4 lg:left-10">
                <Image src={IMG.barcode} alt="" width={48} height={48} className="drop-shadow opacity-70" />
              </div>
              <div className="absolute bottom-8 right-4 lg:right-10">
                <Image src={IMG.recycle} alt="" width={48} height={48} className="drop-shadow opacity-70" />
              </div>
            </div>
          </div>
        </section>

        {/* Install */}
        <section id="install" className="border-b border-zinc-200">
          <div className="max-w-4xl mx-auto px-8 py-16 grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-16 items-start">
            <div>
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-6">How to install</p>
              <div className="space-y-6">
                {([
                  { n: 1, title: "Download the ZIP",
                    body: <>Click <a href="/ecolens-extension.zip" download className="text-zinc-900 font-medium hover:underline">Download Extension</a> to save <code className="text-[11px] bg-zinc-100 px-1.5 py-0.5 rounded font-mono">ecolens-extension.zip</code>.</> },
                  { n: 2, title: "Unzip",
                    body: <>Double-click to extract — you&apos;ll get a folder called <code className="text-[11px] bg-zinc-100 px-1.5 py-0.5 rounded font-mono">chrome-mv3-prod</code>.</> },
                  { n: 3, title: "Enable Developer Mode",
                    body: <>Go to <code className="text-[11px] bg-zinc-100 px-1.5 py-0.5 rounded font-mono">chrome://extensions</code> → enable <strong>Developer mode</strong> (top-right).</> },
                  { n: 4, title: "Load unpacked",
                    body: <>Click <strong>Load unpacked</strong>, select the <code className="text-[11px] bg-zinc-100 px-1.5 py-0.5 rounded font-mono">chrome-mv3-prod</code> folder.</> },
                  { n: 5, title: "Open Amazon",
                    body: <>EcoLens activates automatically. Sign in to save your impact history.</> },
                ] as const).map(({ n, title, body }) => (
                  <div key={n} className="flex gap-4">
                    <span className="shrink-0 text-xs font-semibold text-zinc-400 tabular-nums mt-0.5 w-4">{n}.</span>
                    <div>
                      <p className="text-sm font-semibold text-zinc-800 mb-0.5">{title}</p>
                      <p className="text-sm text-zinc-500 leading-relaxed">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-400 mt-8 border-l-2 border-zinc-100 pl-3">
                Chrome only. Manifest V3 — Firefox and Safari not supported.
              </p>
            </div>
            <div className="hidden lg:flex items-start justify-center pt-6 select-none pointer-events-none">
              <Image src={IMG.laptop} alt="" width={200} height={200} className="drop-shadow-xl opacity-80" />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-b border-zinc-200">
          <div className="max-w-4xl mx-auto px-8 py-16">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-10">What EcoLens does</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
              {[
                { img: IMG.leaf,    title: "AI Score",          desc: "0–100 rating covering carbon, packaging, brand ethics, certifications." },
                { img: IMG.glass,   title: "Voice Briefing",    desc: "ElevenLabs reads a sustainability summary aloud on any product." },
                { img: IMG.recycle, title: "Alternatives",      desc: "Better-scoring products at a similar price, surfaced instantly." },
                { img: IMG.chart,   title: "Impact Dashboard",  desc: "Track CO₂ avoided, eco grade, and annual savings over time." },
              ].map(({ img, title, desc }) => (
                <div key={title}>
                  <div className="h-16 flex items-end mb-4 select-none pointer-events-none">
                    <Image src={img} alt="" width={64} height={64} className="drop-shadow-lg opacity-90" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-800 mb-1">{title}</p>
                  <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Numbers */}
        <section>
          <div className="max-w-4xl mx-auto px-8 py-16 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-100">
            <div className="py-8 sm:py-0 sm:pr-10 first:pt-0 last:pb-0">
              <p className="text-3xl font-bold text-zinc-900">1.2 tons</p>
              <p className="text-sm text-zinc-400 mt-1 leading-snug">avg annual Amazon purchase footprint</p>
            </div>
            <div className="py-8 sm:py-0 sm:px-10">
              <p className="text-3xl font-bold text-zinc-900">240 kg</p>
              <p className="text-sm text-zinc-400 mt-1 leading-snug">saved by 20% greener choices with EcoLens</p>
            </div>
            <div className="py-8 sm:py-0 sm:pl-10">
              {community.totalCo2Kg > 0 ? (
                <>
                  <p className="text-3xl font-bold text-zinc-900">{community.totalCo2Kg} kg</p>
                  <p className="text-sm text-zinc-400 mt-1 leading-snug">CO₂ avoided by our community</p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-bold text-zinc-900">You first.</p>
                  <p className="text-sm text-zinc-400 mt-1 leading-snug">Be the first to track your impact</p>
                </>
              )}
            </div>
          </div>
        </section>

      </main>

      <footer className="border-t border-zinc-100">
        <div className="max-w-4xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Leaf className="h-3 w-3 text-emerald-600" aria-hidden />
            <span className="text-xs font-semibold text-zinc-700">EcoLens</span>
          </div>
          <span className="text-xs text-zinc-400">Innovation Hacks 2026</span>
        </div>
      </footer>

    </div>
  )
}
