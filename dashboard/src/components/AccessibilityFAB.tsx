"use client"

import { useEffect, useState, useRef, useId } from "react"
import {
  Accessibility, X, ZoomIn, Contrast, Sun, Moon,
  Eye, Zap, RotateCcw, Check,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────────

type ColorBlindMode = "none" | "deuteranopia" | "protanopia" | "tritanopia"

interface A11ySettings {
  largeText:    boolean
  highContrast: boolean
  darkMode:     boolean
  reduceMotion: boolean
  colorBlind:   ColorBlindMode
}

const DEFAULT: A11ySettings = {
  largeText:    false,
  highContrast: false,
  darkMode:     false,
  reduceMotion: false,
  colorBlind:   "none",
}

function isModified(s: A11ySettings) {
  return (
    s.largeText || s.highContrast || s.darkMode ||
    s.reduceMotion || s.colorBlind !== "none"
  )
}

// ── Color-vision options ───────────────────────────────────────────────────────

const CB_OPTIONS: {
  value:    ColorBlindMode
  label:    string
  sublabel: string
  colors:   [string, string]   // [from, to] tailwind bg classes for swatch
}[] = [
  {
    value:    "none",
    label:    "Standard",
    sublabel: "Default colour vision",
    colors:   ["bg-red-500",   "bg-green-500"],
  },
  {
    value:    "deuteranopia",
    label:    "Deuteranopia",
    sublabel: "Reduced green sensitivity",
    colors:   ["bg-amber-500", "bg-blue-500"],
  },
  {
    value:    "protanopia",
    label:    "Protanopia",
    sublabel: "Reduced red sensitivity",
    colors:   ["bg-yellow-400", "bg-indigo-500"],
  },
  {
    value:    "tritanopia",
    label:    "Tritanopia",
    sublabel: "Reduced blue sensitivity",
    colors:   ["bg-pink-500",  "bg-teal-500"],
  },
]

// ── SVG colour-matrix filters ─────────────────────────────────────────────────

function A11yFilters() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        <filter id="cb-deuteranopia">
          <feColorMatrix type="matrix" values="
            0.367 0.861 -0.228 0 0
            0.280 0.673  0.047 0 0
           -0.012 0.043  0.969 0 0
            0     0      0     1 0" />
        </filter>
        <filter id="cb-protanopia">
          <feColorMatrix type="matrix" values="
            0.152 1.053 -0.205 0 0
            0.115 0.786  0.099 0 0
           -0.004 -0.048 1.052 0 0
            0     0      0     1 0" />
        </filter>
        <filter id="cb-tritanopia">
          <feColorMatrix type="matrix" values="
            1.256 -0.077 -0.179 0 0
           -0.079  0.931  0.148 0 0
            0.005  0.691  0.304 0 0
            0      0      0     1 0" />
        </filter>
      </defs>
    </svg>
  )
}

// ── Toggle row ────────────────────────────────────────────────────────────────

function ToggleRow({
  label, desc, icon, checked, onChange,
}: {
  label:    string
  desc:     string
  icon:     React.ReactNode
  checked:  boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        "group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9900] focus-visible:ring-offset-1",
        checked
          ? "bg-[#FF9900]/8 border-[#FF9900]/30"
          : "bg-transparent border-border/60 hover:bg-muted/60 hover:border-border",
      ].join(" ")}
    >
      {/* Icon bubble */}
      <span
        className={[
          "flex items-center justify-center h-8 w-8 rounded-lg shrink-0 transition-colors",
          checked ? "bg-[#FF9900]/20 text-[#b86e00]" : "bg-muted text-muted-foreground",
        ].join(" ")}
        aria-hidden="true"
      >
        {icon}
      </span>

      {/* Label */}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-foreground leading-none">{label}</span>
        <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">{desc}</span>
      </span>

      {/* Switch track — use explicit px sizes to avoid non-standard Tailwind fractions */}
      <span
        aria-hidden="true"
        className={[
          "relative shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-[#FF9900]" : "bg-muted-foreground/25",
        ].join(" ")}
        style={{ width: 40, height: 22 }}
      >
        <span
          className={[
            "absolute top-[3px] rounded-full bg-white shadow transition-transform duration-200",
            checked ? "translate-x-[19px]" : "translate-x-[3px]",
          ].join(" ")}
          style={{ width: 16, height: 16 }}
        />
      </span>
    </button>
  )
}

// ── Colour-vision radio card ──────────────────────────────────────────────────

function VisionCard({
  value, label, sublabel, colors, checked, onSelect,
}: {
  value:    ColorBlindMode
  label:    string
  sublabel: string
  colors:   [string, string]
  checked:  boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={checked}
      className={[
        "group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9900] focus-visible:ring-offset-1",
        checked
          ? "bg-[#FF9900]/8 border-[#FF9900]/30"
          : "bg-transparent border-border/60 hover:bg-muted/60 hover:border-border",
      ].join(" ")}
    >
      {/* Dual-color swatch */}
      <span className="flex h-7 w-7 shrink-0 rounded-lg overflow-hidden" aria-hidden="true">
        <span className={`flex-1 ${colors[0]}`} />
        <span className={`flex-1 ${colors[1]}`} />
      </span>

      {/* Text */}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-foreground leading-none">{label}</span>
        <span className="block text-[11px] text-muted-foreground mt-0.5">{sublabel}</span>
      </span>

      {/* Check indicator */}
      <span
        className={[
          "flex items-center justify-center h-5 w-5 rounded-full shrink-0 transition-all",
          checked
            ? "bg-[#FF9900] text-white scale-100 opacity-100"
            : "bg-muted-foreground/15 text-transparent scale-75 opacity-0",
        ].join(" ")}
        aria-hidden="true"
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    </button>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: string }) {
  return (
    <div className="flex items-center gap-1.5 px-1 mb-2">
      <span className="text-muted-foreground/70" aria-hidden="true">{icon}</span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
        {children}
      </span>
    </div>
  )
}

// ── Main FAB ──────────────────────────────────────────────────────────────────

export function AccessibilityFAB() {
  const [open,     setOpen]     = useState(false)
  const [settings, setSettings] = useState<A11ySettings>(DEFAULT)
  const [mounted,  setMounted]  = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Hydrate from localStorage
  useEffect(() => {
    setMounted(true)
    try {
      const raw = localStorage.getItem("ecolens-a11y")
      if (raw) setSettings(JSON.parse(raw) as A11ySettings)
    } catch {}
  }, [])

  // Apply to <html> + persist
  useEffect(() => {
    if (!mounted) return
    const html = document.documentElement
    html.classList.toggle("a11y-large-text",    settings.largeText)
    html.classList.toggle("a11y-high-contrast", settings.highContrast)
    html.classList.toggle("a11y-reduce-motion", settings.reduceMotion)
    html.classList.toggle("dark",               settings.darkMode)
    html.dataset.colorblind = settings.colorBlind
    try { localStorage.setItem("ecolens-a11y", JSON.stringify(settings)) } catch {}
  }, [settings, mounted])

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus() }
    }
    function onPointer(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("keydown",  onKey)
    document.addEventListener("mousedown", onPointer)
    return () => {
      document.removeEventListener("keydown",  onKey)
      document.removeEventListener("mousedown", onPointer)
    }
  }, [open])

  function patch(p: Partial<A11ySettings>) {
    setSettings(prev => ({ ...prev, ...p }))
  }

  const active = isModified(settings)

  // Count active toggles for the badge number
  const activeCount = [
    settings.largeText,
    settings.highContrast,
    settings.darkMode,
    settings.reduceMotion,
    settings.colorBlind !== "none",
  ].filter(Boolean).length

  return (
    <>
      {/* SVG filter defs must live outside the fixed container so that Safari
          and Firefox can resolve the url(#id) reference reliably.            */}
      <A11yFilters />

      <div
        ref={panelRef}
        className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
      >
        {/* ── Panel ─────────────────────────────────────────────────────────── */}
        {open && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Accessibility settings"
            className={[
              "w-80 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden",
              "animate-in slide-in-from-bottom-3 fade-in duration-200",
            ].join(" ")}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Accessibility className="h-4 w-4 text-[#FF9900]" aria-hidden="true" />
                  <h2 className="text-sm font-bold text-foreground">Accessibility</h2>
                  {active && (
                    <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-[#FF9900] text-[9px] font-bold text-white leading-none">
                      {activeCount}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 ml-6">
                  Adjust display to your needs
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9900]"
                aria-label="Close accessibility panel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="h-px bg-border/60 mx-4" />

            {/* Display section */}
            <div className="px-3 pt-3 pb-2 space-y-1.5">
              <SectionLabel icon={<Contrast className="h-3 w-3" />}>Display</SectionLabel>

              <ToggleRow
                label="Large Text"
                desc="Increase font size by 12%"
                icon={<ZoomIn className="h-4 w-4" />}
                checked={settings.largeText}
                onChange={v => patch({ largeText: v })}
              />
              <ToggleRow
                label="High Contrast"
                desc="Stronger text and border contrast"
                icon={<Contrast className="h-4 w-4" />}
                checked={settings.highContrast}
                onChange={v => patch({ highContrast: v })}
              />
              <ToggleRow
                label={settings.darkMode ? "Dark Mode" : "Light Mode"}
                desc="Toggle dark or light theme"
                icon={settings.darkMode
                  ? <Moon className="h-4 w-4" />
                  : <Sun className="h-4 w-4" />}
                checked={settings.darkMode}
                onChange={v => patch({ darkMode: v })}
              />
              <ToggleRow
                label="Reduce Motion"
                desc="Disable animations and transitions"
                icon={<Zap className="h-4 w-4" />}
                checked={settings.reduceMotion}
                onChange={v => patch({ reduceMotion: v })}
              />
            </div>

            <div className="h-px bg-border/60 mx-4 my-1" />

            {/* Colour vision section */}
            <div className="px-3 pt-2.5 pb-3 space-y-1.5">
              <SectionLabel icon={<Eye className="h-3 w-3" />}>Colour Vision</SectionLabel>

              {CB_OPTIONS.map(opt => (
                <VisionCard
                  key={opt.value}
                  {...opt}
                  checked={settings.colorBlind === opt.value}
                  onSelect={() => patch({ colorBlind: opt.value })}
                />
              ))}
            </div>

            {/* Footer */}
            {active && (
              <>
                <div className="h-px bg-border/60 mx-4" />
                <div className="px-3 py-2.5">
                  <button
                    onClick={() => setSettings(DEFAULT)}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9900]"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    Reset all settings
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Trigger FAB ───────────────────────────────────────────────────── */}
        <div className="relative">
          <button
            ref={triggerRef}
            onClick={() => setOpen(prev => !prev)}
            aria-label="Accessibility options"
            aria-expanded={open}
            aria-haspopup="dialog"
            title="Accessibility options"
            className={[
              "group relative h-14 w-14 rounded-full flex items-center justify-center",
              "shadow-lg transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9900] focus-visible:ring-offset-2",
              open
                ? "bg-[#37475A] scale-95"
                : "bg-[#232F3E] hover:bg-[#2d3d50] hover:scale-105 hover:shadow-xl active:scale-95",
            ].join(" ")}
          >
            {/* Rotating icon on open */}
            <Accessibility
              className={[
                "h-5 w-5 text-[#FF9900] transition-transform duration-300",
                open ? "rotate-12 scale-90" : "",
              ].join(" ")}
              aria-hidden="true"
            />

            {/* Subtle ring on hover */}
            <span
              className="absolute inset-0 rounded-full ring-0 ring-[#FF9900]/20 group-hover:ring-4 transition-all duration-200"
              aria-hidden="true"
            />
          </button>

          {/* Active badge */}
          {active && !open && (
            <span
              aria-label={`${activeCount} accessibility setting${activeCount !== 1 ? "s" : ""} active`}
              className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#FF9900] text-[9px] font-bold text-white shadow-md border-2 border-[#F7F8FA] pointer-events-none"
            >
              {activeCount}
            </span>
          )}
        </div>
      </div>
    </>
  )
}
