import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useRef, useState } from "react"
import { scoreCart } from "../lib/api"
import type { CartScoreResponse } from "../lib/api"
import { extractCartItems } from "../lib/extract"

export const config: PlasmoCSConfig = {
  matches: [
    "https://*.amazon.com/cart*",
    "https://*.amazon.com/gp/cart/*",
    "https://*.amazon.com/gp/buy/spc/*",  // checkout confirm page
  ]
}

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = `
    * { box-sizing: border-box; }
    @keyframes cart-slide-in {
      from { transform: translateX(115%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    @keyframes cart-fade-up {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0);   }
    }
    @keyframes cart-fade-in {
      from { opacity: 0; } to { opacity: 1; }
    }
    @keyframes cart-spin {
      from { transform: rotate(0deg); } to { transform: rotate(360deg); }
    }
    @keyframes cart-score-pop {
      0%   { transform: scale(0.5); opacity: 0; }
      65%  { transform: scale(1.08); }
      100% { transform: scale(1);   opacity: 1; }
    }
    @keyframes cart-sweep {
      0%   { transform: translateX(-100%); }
      100% { transform: translateX(500%);  }
    }
    @keyframes cart-breathe {
      0%, 100% { transform: scale(1); }
      50%       { transform: scale(1.15); }
    }
  `
  return style
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function cartScoreColor(s: number) {
  if (s >= 70) return "#16A34A"
  if (s >= 50) return "#D97706"
  return "#DC2626"
}

function co2Equiv(kg: number) {
  const km  = Math.round(kg / 0.12)
  const trees = Math.round(kg / 22 * 12) // tree-months
  return { km, trees }
}

// ── Score ring (same pattern as ScoreCard) ──────────────────────────────────

function CartRing({ score, size = 72 }: { score: number; size?: number }) {
  const r    = size * 0.38
  const circ = 2 * Math.PI * r
  const sw   = size * 0.09
  const color = cartScoreColor(score)
  const [offset,  setOffset]  = useState(circ)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const t0 = performance.now(), dur = 1200
    let raf: number
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(score * e))
      setOffset(circ * (1 - (score / 100) * e))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [score])

  return (
    <div style={{
      position: "relative", width: size, height: size, flexShrink: 0,
      animation: "cart-score-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.2s both"
    }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.26, fontWeight: 800, color, lineHeight: 1, letterSpacing: "-1px" }}>{display}</span>
        <span style={{ fontSize: size * 0.1, color: "#9CA3AF", fontWeight: 500 }}>/100</span>
      </div>
    </div>
  )
}

// ── Main CartScanner ─────────────────────────────────────────────────────────

function CartScanner() {
  const [result,    setResult]    = useState<CartScoreResponse | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showSwaps, setShowSwaps] = useState(false)
  const hasRun = useRef(false)

  // Auto-scan once on mount after a short delay (let cart page settle)
  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true
    const t = setTimeout(autoScan, 1800)
    return () => clearTimeout(t)
  }, [])

  async function autoScan() {
    const items = extractCartItems()
    if (!items.length) return   // no items found — don't show anything
    setLoading(true)
    try {
      const token = await chrome.storage.local.get("auth_token").then(r => r.auth_token)
      const res = await scoreCart(items, token)
      setResult(res)
    } catch {
      // silent — don't show error card for cart
    } finally {
      setLoading(false)
    }
  }

  if (dismissed) return null
  if (!loading && !result) return null

  const score  = result?.aggregate_score ?? 0
  const co2    = result?.total_co2_kg ?? 0
  const equiv  = co2Equiv(co2)
  const color  = cartScoreColor(score)
  const hasSwaps = (result?.swap_suggestions?.length ?? 0) > 0
  const worstItem = result?.item_scores?.find(s => s.asin === result?.worst_offender_asin)

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 2147483647,
      width: 330, background: "#fff", borderRadius: 18,
      boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.07)",
      fontFamily: "-apple-system, 'Segoe UI', system-ui, sans-serif",
      overflow: "hidden",
      animation: "cart-slide-in 0.45s cubic-bezier(0.34,1.35,0.64,1) forwards"
    }}>

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1a2533 0%, #232F3E 100%)",
        padding: "9px 13px", display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 14 }}>🍃</span>
          <span style={{ color: "#FF9900", fontWeight: 700, fontSize: 13, letterSpacing: "0.3px" }}>EcoLens</span>
          <span style={{ fontSize: 9, color: "#6B7A8D", background: "#ffffff14", padding: "2px 6px", borderRadius: 4 }}>
            Cart Check
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "#8899AA", cursor: "pointer", fontSize: 11, padding: "4px 8px", borderRadius: 5, lineHeight: 1 }}>
          ✕
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ padding: "22px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 10, animation: "cart-breathe 2s ease-in-out infinite" }}>🛒</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 3 }}>Scanning your cart…</div>
          <div style={{ fontSize: 9.5, color: "#9CA3AF", marginBottom: 14 }}>Calculating total environmental footprint</div>
          <div style={{ height: 3, background: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              width: "25%", height: "100%", borderRadius: 4,
              background: "linear-gradient(90deg, transparent, #2D6A4F, transparent)",
              animation: "cart-sweep 1.8s ease-in-out infinite"
            }} />
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Score hero */}
          <div style={{
            padding: "14px 14px 12px",
            background: score >= 70
              ? "linear-gradient(135deg, #F0FDF4, #DCFCE7)"
              : score >= 50
              ? "linear-gradient(135deg, #FFFBEB, #FEF3C7)"
              : "linear-gradient(135deg, #FFF5F5, #FEE2E2)",
            borderBottom: "1px solid #F3F4F6",
            display: "flex", alignItems: "center", gap: 13,
            opacity: 0, animation: "cart-fade-in 0.35s ease 0.05s both"
          }}>
            <CartRing score={score} size={72} />
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: score >= 70 ? 15 : 14, fontWeight: 800,
                color: color, lineHeight: 1.2, marginBottom: 5
              }}>
                {score >= 70 ? "Eco-friendly cart! 🌿" :
                 score >= 50 ? "Room for improvement" :
                 "High-impact cart ⚠️"}
              </div>
              {/* CO₂ row */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <div style={{
                  background: "rgba(255,255,255,0.7)", borderRadius: 7,
                  padding: "3px 8px", display: "flex", alignItems: "center", gap: 4
                }}>
                  <span style={{ fontSize: 10 }}>🌿</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "#111827" }}>~{co2.toFixed(1)} kg CO₂</span>
                </div>
                <div style={{
                  background: "rgba(255,255,255,0.7)", borderRadius: 7,
                  padding: "3px 8px", fontSize: 9.5, color: "#6B7280"
                }}>
                  ≈ {equiv.km} km driving
                </div>
              </div>
            </div>
          </div>

          {/* Worst offender + swap suggestion */}
          {score < 70 && hasSwaps && (
            <div style={{ padding: "11px 13px 0" }}>
              {worstItem && (
                <div style={{
                  background: "#FFF5F5", border: "1px solid #FECACA",
                  borderRadius: 10, padding: "8px 10px", marginBottom: 9,
                  opacity: 0, animation: "cart-fade-up 0.3s ease 0.15s both"
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }}>
                    Worst offender
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10.5, color: "#111827", fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
                      {worstItem.asin}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: "#fff",
                      background: "#DC2626", padding: "2px 7px", borderRadius: 20
                    }}>{worstItem.score}</span>
                  </div>
                </div>
              )}

              {!showSwaps ? (
                <button
                  onClick={() => setShowSwaps(true)}
                  style={{
                    width: "100%", padding: "9px 0",
                    background: "#16A34A", color: "#fff",
                    border: "none", borderRadius: 9,
                    fontWeight: 700, fontSize: 11, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    fontFamily: "inherit", marginBottom: 11,
                    opacity: 0, animation: "cart-fade-up 0.3s ease 0.2s both"
                  }}>
                  🌿 See greener swaps — save ~{(co2 * 0.25).toFixed(1)} kg CO₂
                </button>
              ) : (
                <div style={{ marginBottom: 11 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 7 }}>
                    Greener alternatives
                  </div>
                  {result.swap_suggestions.slice(0, 2).map((alt, i) => (
                    <a
                      key={alt.asin}
                      href={`https://www.amazon.com/dp/${alt.asin}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "flex", gap: 9, alignItems: "center",
                        padding: "9px 10px",
                        background: "#F0FDF4", border: "1.5px solid #86EFAC",
                        borderRadius: 10, marginBottom: 6, textDecoration: "none",
                        opacity: 0, animation: `cart-fade-up 0.3s ease ${0.05 + i * 0.07}s both`
                      }}>
                      {alt.image_url && (
                        <img src={alt.image_url} alt="" style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 6, background: "#fff", flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10.5, color: "#111827", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }}>
                          {alt.title}
                        </div>
                        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                          <span style={{ fontSize: 10, background: "#16A34A", color: "#fff", padding: "1px 6px", borderRadius: 20, fontWeight: 700 }}>{alt.score}</span>
                          <span style={{ fontSize: 9, color: "#16A34A", fontWeight: 600 }}>+{alt.score - score} vs your cart avg</span>
                        </div>
                      </div>
                      <span style={{ color: "#16A34A", fontSize: 15, fontWeight: 700 }}>→</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Good cart — positive reinforcement */}
          {score >= 70 && (
            <div style={{ padding: "10px 13px 0", opacity: 0, animation: "cart-fade-up 0.3s ease 0.15s both" }}>
              <div style={{
                background: "#F0FDF4", border: "1px solid #BBF7D0",
                borderRadius: 10, padding: "10px 12px",
                display: "flex", alignItems: "center", gap: 9
              }}>
                <span style={{ fontSize: 22 }}>🌍</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#166534" }}>Mindful shopping!</div>
                  <div style={{ fontSize: 9.5, color: "#4B7C5E", marginTop: 1 }}>
                    Your cart is greener than 70% of similar Amazon carts
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ padding: "10px 13px 12px", display: "flex", gap: 7, marginTop: 2 }}>
            <a
              href="https://ecolens.app/dashboard"
              target="_blank"
              rel="noreferrer"
              style={{
                flex: 1, padding: "9px 0",
                background: "#F9FAFB", color: "#374151",
                border: "1px solid #E5E7EB", borderRadius: 9,
                fontWeight: 700, fontSize: 10.5, textDecoration: "none",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4
              }}>
              📊 My Impact
            </a>
            <button
              onClick={() => setDismissed(true)}
              style={{
                flex: 1, padding: "9px 0",
                background: "#111827", color: "#fff",
                border: "none", borderRadius: 9,
                fontWeight: 700, fontSize: 10.5, cursor: "pointer",
                fontFamily: "inherit"
              }}>
              Continue checkout →
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default CartScanner
