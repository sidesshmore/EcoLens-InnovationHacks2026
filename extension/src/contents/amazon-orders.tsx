/**
 * EcoLens — Order History CO₂ Audit
 * Injects an audit banner on Amazon order history pages and adds per-row score badges.
 * Shows lifetime CO₂ footprint, greenest/worst purchase, and potential savings.
 */
import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"

export const config: PlasmoCSConfig = {
  matches: [
    "https://*.amazon.com/gp/css/order-history*",
    "https://*.amazon.com/your-orders/*",
    "https://*.amazon.com/gp/your-account/order-history*",
  ],
  all_frames: false,
}

export const getStyle = () => {
  const s = document.createElement("style")
  s.textContent = `
    @keyframes el-slide-down {
      from { opacity: 0; transform: translateY(-12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes el-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes el-bar-grow {
      from { width: 0; }
    }
    .el-audit-banner { animation: el-slide-down .45s cubic-bezier(.22,1,.36,1) both; }
    .el-badge        { animation: el-fade-in .3s ease both; }
  `
  return s
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  asin:     string
  title:    string
  element?: Element   // the DOM row for badge injection
}

interface ScoreResult {
  asin:  string
  score: number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ASIN_RE = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|\?|$)/

function extractOrders(): OrderItem[] {
  const seen  = new Set<string>()
  const items: OrderItem[] = []

  // Strategy 1: look for product links containing /dp/ or /gp/product/
  document.querySelectorAll<HTMLAnchorElement>(
    'a[href*="/dp/"], a[href*="/gp/product/"]'
  ).forEach(a => {
    const m = a.href.match(ASIN_RE)
    if (!m) return
    const asin = m[1]
    if (seen.has(asin)) return
    seen.add(asin)

    // Walk up to find the order card context
    const card = a.closest('[data-order-id], .order-card, .shipment, .a-box-group') ?? a.parentElement

    // Best-effort title from nearby text nodes / spans
    const titleEl = card?.querySelector(
      '.yohtmlitem-view-your-item-main, .a-link-normal.a-text-bold, .a-size-base-plus.a-color-base.a-text-bold, .product-title'
    )
    const rawTitle = titleEl?.textContent?.trim()
      ?? a.textContent?.trim()
      ?? asin

    // Keep only meaningful titles (not generic nav links)
    if (rawTitle.length < 4 || /account|order|return|review/i.test(rawTitle)) return

    items.push({ asin, title: rawTitle.slice(0, 120), element: a.closest('li, .a-box, .order-card') ?? a.parentElement ?? undefined })
  })

  return items.slice(0, 15) // cap at 15 to avoid hammering API
}

async function getToken(): Promise<string | null> {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: "GET_TOKEN" }, res => resolve(res?.token ?? null))
  })
}

async function scoreAsin(asin: string, title: string, token: string | null): Promise<number | null> {
  return new Promise(resolve => {
    if (!chrome.runtime?.id) { resolve(null); return }
    chrome.runtime.sendMessage(
      { type: "SCORE_PRODUCT", payload: { asin, title, brand: "", category: "", description: "" }, token },
      res => {
        if (res?.ok && typeof res.data?.score === "number") resolve(res.data.score)
        else resolve(null)
      }
    )
  })
}

// ── Score badge injected directly into Amazon DOM rows ────────────────────────

function injectBadge(el: Element, score: number) {
  if (el.querySelector(".el-score-badge")) return // already injected
  const div = document.createElement("span")
  div.className = "el-score-badge el-badge"
  const color = score >= 65 ? "#166534" : score >= 40 ? "#854D0E" : "#991B1B"
  const bg    = score >= 65 ? "#DCFCE7" : score >= 40 ? "#FEF3C7" : "#FEE2E2"
  div.style.cssText = `
    display: inline-flex; align-items: center; gap: 3px;
    background: ${bg}; color: ${color};
    border: 1px solid ${color}30;
    border-radius: 4px; padding: 2px 6px;
    font-size: 10px; font-weight: 700;
    font-family: -apple-system, Arial, sans-serif;
    margin-left: 6px; vertical-align: middle;
    white-space: nowrap; animation-delay: .2s;
  `
  div.innerHTML = `<svg width="9" height="9" viewBox="0 0 24 24" fill="${color}">
    <path d="M17 8C8 10 5.9 16.17 3.82 19.82L5.71 21l.95-1.71c.43.21.88.42 1.34.59 0 0 1.7-7.88 9-12Z"/>
    <path d="M3 21c4-4 8-8 17-10" stroke="${color}" stroke-width="2" stroke-linecap="round" fill="none"/>
  </svg> ${score}`
  el.appendChild(div)
}

// ── Audit Banner React Component ───────────────────────────────────────────────

interface AuditBannerProps {
  items:   OrderItem[]
  scores:  Record<string, number | null>
  loading: boolean
}

function ScorePill({ score }: { score: number | null }) {
  if (score === null) return (
    <span style={{
      display: "inline-block", width: 32, height: 22, borderRadius: 4,
      background: "#F3F4F6", verticalAlign: "middle"
    }} />
  )
  const color = score >= 65 ? "#166534" : score >= 40 ? "#854D0E" : "#991B1B"
  const bg    = score >= 65 ? "#DCFCE7" : score >= 40 ? "#FEF3C7" : "#FEE2E2"
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 32, height: 22, borderRadius: 4,
      background: bg, color, fontSize: 11, fontWeight: 800, flexShrink: 0
    }}>
      {score}
    </span>
  )
}

function AuditBanner({ items, scores, loading }: AuditBannerProps) {
  const scored   = items.filter(i => scores[i.asin] !== null && scores[i.asin] !== undefined)
  const total    = scored.length

  // Compute aggregate CO₂ (sum of per-product estimates)
  const totalCo2 = scored.reduce((s, i) => {
    const sc = scores[i.asin] ?? 50
    return s + (2 + (100 - sc) * 0.12)
  }, 0)

  // Potential savings: what if they had chosen score=70 products instead
  const potentialSavings = scored.reduce((s, i) => {
    const sc = scores[i.asin] ?? 50
    if (sc < 60) return s + ((2 + (100 - sc) * 0.12) - (2 + (100 - 70) * 0.12))
    return s
  }, 0)

  const bestItem  = scored.reduce<OrderItem | null>((b, i) => !b || (scores[i.asin]??0) > (scores[b.asin]??0) ? i : b, null)
  const worstItem = scored.reduce<OrderItem | null>((b, i) => !b || (scores[i.asin]??100) < (scores[b.asin]??100) ? i : b, null)

  const kmEquiv = Math.round(totalCo2 / 0.12)

  const C = {
    bg:     "#0F1923",
    card:   "#162232",
    border: "#1E3040",
    green:  "#34D399",
    amber:  "#FBBF24",
    red:    "#F87171",
    text:   "#D4E4F0",
    muted:  "#4A6A80",
    dim:    "#1E3040",
    orange: "#FF9900",
  }

  return (
    <div
      className="el-audit-banner"
      style={{
        fontFamily: "-apple-system, 'Segoe UI', Arial, sans-serif",
        background: C.bg, borderRadius: 12,
        border: `1px solid ${C.border}`,
        marginBottom: 20, overflow: "hidden",
        boxShadow: "0 4px 24px rgba(0,0,0,0.18)"
      }}
    >
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #0E1D2D 0%, #0F1923 100%)",
        padding: "14px 18px",
        borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "linear-gradient(135deg, #0D3D28, #1A5C40)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 10px ${C.green}30`
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M17 8C8 10 5.9 16.17 3.82 19.82L5.71 21l.95-1.71c.43.21.88.42 1.34.59 0 0 1.7-7.88 9-12Z" fill={C.green}/>
              <path d="M3 21c4-4 8-8 17-10" stroke={C.green} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 14, lineHeight: 1, letterSpacing: "-0.2px" }}>
              EcoLens Order History Audit
            </div>
            <div style={{ color: C.muted, fontSize: 9, marginTop: 2 }}>
              AI-powered CO₂ footprint analysis of your recent orders
            </div>
          </div>
        </div>
        {loading && (
          <div style={{
            fontSize: 9, color: C.muted,
            display: "flex", alignItems: "center", gap: 5
          }}>
            <div style={{
              width: 10, height: 10, border: `2px solid ${C.dim}`,
              borderTopColor: C.green, borderRadius: "50%",
              animation: "el-spin .8s linear infinite"
            }} />
            Scoring {items.length} products…
          </div>
        )}
      </div>

      <div style={{ padding: "16px 18px" }}>
        {/* Hero stats row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>

          {/* Total CO₂ — hero */}
          <div style={{
            flex: 1.4, background: C.card, borderRadius: 10,
            padding: "13px 14px", border: `1px solid ${C.border}`
          }}>
            <div style={{ fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6, fontWeight: 700 }}>
              Estimated CO₂ footprint
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: total > 0 ? C.amber : C.muted, letterSpacing: "-1px", lineHeight: 1 }}>
                {total > 0 ? totalCo2.toFixed(1) : "—"}
              </span>
              {total > 0 && <span style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>kg CO₂</span>}
            </div>
            {kmEquiv > 0 && (
              <div style={{ fontSize: 9, color: C.dim }}>≈ driving {kmEquiv} km</div>
            )}
            {loading && total === 0 && (
              <div style={{ fontSize: 9, color: C.dim }}>Calculating…</div>
            )}
          </div>

          {/* Products scored */}
          <div style={{
            flex: 1, background: C.card, borderRadius: 10,
            padding: "13px 14px", border: `1px solid ${C.border}`
          }}>
            <div style={{ fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6, fontWeight: 700 }}>
              Products scored
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: "-1px", lineHeight: 1, marginBottom: 4 }}>
              {loading ? `${total}…` : total}
            </div>
            <div style={{ fontSize: 9, color: C.dim }}>
              of {items.length} in this page
            </div>
          </div>

          {/* Potential savings */}
          {potentialSavings > 0.1 && (
            <div style={{
              flex: 1, background: "linear-gradient(135deg, #0A1E14, #0D2218)", borderRadius: 10,
              padding: "13px 14px", border: "1px solid #1A3A2A"
            }}>
              <div style={{ fontSize: 8, color: "#2A5040", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6, fontWeight: 700 }}>
                Could have saved
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: C.green, letterSpacing: "-0.5px", lineHeight: 1 }}>
                  {potentialSavings.toFixed(1)}
                </span>
                <span style={{ fontSize: 10, color: "#2A5040", fontWeight: 600 }}>kg CO₂</span>
              </div>
              <div style={{ fontSize: 9, color: "#1E3A2A" }}>with greener choices</div>
            </div>
          )}
        </div>

        {/* Best / Worst row */}
        {(bestItem || worstItem) && (
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            {bestItem && scores[bestItem.asin] !== null && (scores[bestItem.asin] ?? 0) >= 55 && (
              <div style={{
                flex: 1, background: C.card, borderRadius: 10,
                padding: "11px 13px", border: `1px solid ${C.border}`,
                borderLeft: `3px solid ${C.green}`
              }}>
                <div style={{ fontSize: 8, color: C.green, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, marginBottom: 5 }}>
                  Greenest purchase
                </div>
                <div style={{
                  fontSize: 11, color: C.text, fontWeight: 600, lineHeight: 1.4,
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                  marginBottom: 5
                }}>
                  {bestItem.title}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, color: "#166534",
                    background: "#DCFCE7", borderRadius: 4, padding: "1px 6px"
                  }}>
                    Score {scores[bestItem.asin]}
                  </span>
                  <span style={{ fontSize: 9, color: C.muted }}>Eco-friendly</span>
                </div>
              </div>
            )}
            {worstItem && scores[worstItem.asin] !== null && (scores[worstItem.asin] ?? 100) < 55 && (
              <div style={{
                flex: 1, background: C.card, borderRadius: 10,
                padding: "11px 13px", border: `1px solid ${C.border}`,
                borderLeft: `3px solid ${C.amber}`
              }}>
                <div style={{ fontSize: 8, color: C.amber, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, marginBottom: 5 }}>
                  Swap opportunity
                </div>
                <div style={{
                  fontSize: 11, color: C.text, fontWeight: 600, lineHeight: 1.4,
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                  marginBottom: 5
                }}>
                  {worstItem.title}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, color: "#991B1B",
                    background: "#FEE2E2", borderRadius: 4, padding: "1px 6px"
                  }}>
                    Score {scores[worstItem.asin]}
                  </span>
                  <a
                    href={`https://www.amazon.com/dp/${worstItem.asin}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 9, color: C.orange, textDecoration: "none", fontWeight: 600 }}
                  >
                    Find greener alternatives →
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* All products scored list (compact) */}
        {scored.length > 0 && (
          <div style={{
            background: C.card, borderRadius: 10,
            border: `1px solid ${C.border}`, overflow: "hidden"
          }}>
            <div style={{
              padding: "8px 13px", borderBottom: `1px solid ${C.border}`,
              fontSize: 8, color: C.muted, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.6px"
            }}>
              Scored products — {scored.length} of {items.length}
            </div>
            {items.map((item, idx) => {
              const sc = scores[item.asin]
              const color = sc === null ? C.dim
                : sc >= 65 ? C.green : sc >= 40 ? C.amber : C.red
              return (
                <div key={item.asin} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "7px 13px",
                  borderBottom: idx < items.length - 1 ? `1px solid ${C.border}` : "none",
                }}>
                  <ScorePill score={sc ?? null} />
                  <div style={{
                    flex: 1, fontSize: 11, color: C.text,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                  }}>
                    {item.title}
                  </div>
                  {sc !== null && (
                    <div style={{
                      fontSize: 9, color,
                      background: `${color}15`, borderRadius: 4, padding: "1px 6px",
                      fontWeight: 600, flexShrink: 0
                    }}>
                      {sc >= 65 ? "Eco-friendly" : sc >= 40 ? "Mixed" : "High impact"}
                    </div>
                  )}
                  {sc === null && (
                    <div style={{
                      fontSize: 9, color: C.dim, flexShrink: 0, width: 60, textAlign: "right"
                    }}>
                      Scoring…
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ fontSize: 8.5, color: C.dim }}>
            Powered by EcoLens · AI-powered sustainability scoring
          </div>
          <button
            onClick={() => {
              const text = `I analyzed my Amazon order history with EcoLens. My estimated CO₂ footprint: ${totalCo2.toFixed(1)} kg — and I could have saved ${potentialSavings.toFixed(1)} kg more with greener choices. #EcoLens #SustainableShopping`
              navigator.clipboard.writeText(text).catch(() => {})
            }}
            style={{
              background: C.orange, color: "#1A0A00", border: "none",
              borderRadius: 7, padding: "6px 12px", fontSize: 10,
              fontWeight: 800, cursor: "pointer", letterSpacing: "0.1px"
            }}
          >
            Share my impact
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Orchestrator — mounts banner + injects badges ─────────────────────────────

function OrdersAuditOrchestrator() {
  const [items,   setItems]   = useState<OrderItem[]>([])
  const [scores,  setScores]  = useState<Record<string, number | null>>({})
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (!chrome.runtime?.id) return

    // Wait for Amazon's order list to render (it lazy-loads)
    const tryMount = async () => {
      const container = document.querySelector(
        "#ordersContainer, .your-orders-content, [data-component='orders-list'], .a-section.a-spacing-none"
      ) ?? document.querySelector("ul.a-unordered-list") ?? document.querySelector("main")

      if (!container) {
        // Retry after 1 second
        setTimeout(tryMount, 1000)
        return
      }

      const orderItems = extractOrders()
      if (orderItems.length === 0) {
        setTimeout(tryMount, 1500)
        return
      }

      setItems(orderItems)
      setLoading(true)

      // Inject the banner div before the container
      const bannerDiv = document.createElement("div")
      bannerDiv.id = "ecolens-orders-banner"
      bannerDiv.style.cssText = "margin-bottom: 16px;"
      container.insertAdjacentElement("beforebegin", bannerDiv)
      setMounted(true)

      // Get token
      const token = await getToken()

      // Score sequentially (max 15 items, cache makes this fast)
      const initialScores: Record<string, number | null> = {}
      orderItems.forEach(i => { initialScores[i.asin] = undefined as any })
      setScores({ ...initialScores })

      for (const item of orderItems) {
        if (!chrome.runtime?.id) break
        const score = await scoreAsin(item.asin, item.title, token)
        setScores(prev => ({ ...prev, [item.asin]: score }))

        // Inject badge into the Amazon DOM row
        if (score !== null && item.element) {
          // Find the product title element within the row for badge placement
          const titleEl = item.element.querySelector(
            '.a-link-normal.a-text-bold, .a-size-base-plus.a-color-base, .yohtmlitem-view-your-item-main, a[href*="/dp/"]'
          )
          if (titleEl) injectBadge(titleEl, score)
        }

        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 150))
      }

      setLoading(false)
    }

    setTimeout(tryMount, 800)
  }, [])

  if (!mounted) return null

  const bannerDiv = document.getElementById("ecolens-orders-banner")
  if (!bannerDiv) return null

  // Portal render into the injected div
  const { createPortal } = require("react-dom")
  return createPortal(
    <AuditBanner items={items} scores={scores} loading={loading} />,
    bannerDiv
  )
}

export default function AmazonOrdersAudit() {
  return <OrdersAuditOrchestrator />
}
