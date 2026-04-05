import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useRef, useState } from "react"
import type { ScoreResponse, ProductPayload } from "../lib/api"
import { extractProductData } from "../lib/extract"
import { ScoreCard } from "../components/ScoreCard"

export const config: PlasmoCSConfig = {
  matches: [
    "https://*.amazon.com/dp/*",
    "https://*.amazon.com/*/dp/*",
    "https://*.amazon.com/gp/product/*"
  ],
  all_frames: false
}

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = `
    * { box-sizing: border-box; }

    @keyframes ecolens-slide-in {
      from { transform: translateX(100%); }
      to   { transform: translateX(0);    }
    }
    @keyframes ecolens-fade-up {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0);   }
    }
    @keyframes ecolens-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes ecolens-spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    @keyframes ecolens-pulse-ring {
      0%   { box-shadow: 0 0 0 0   rgba(255,153,0,0.45); }
      70%  { box-shadow: 0 0 0 9px rgba(255,153,0,0);    }
      100% { box-shadow: 0 0 0 0   rgba(255,153,0,0);    }
    }
    @keyframes ecolens-pulse-green {
      0%   { box-shadow: 0 0 0 0   rgba(45,106,79,0.45); }
      70%  { box-shadow: 0 0 0 9px rgba(45,106,79,0);    }
      100% { box-shadow: 0 0 0 0   rgba(45,106,79,0);    }
    }
    @keyframes ecolens-score-pop {
      0%   { transform: scale(0.4); opacity: 0; }
      65%  { transform: scale(1.1); }
      100% { transform: scale(1);   opacity: 1; }
    }
    @keyframes ecolens-sweep {
      0%   { transform: translateX(-100%); }
      100% { transform: translateX(500%); }
    }
    @keyframes ecolens-breathe {
      0%, 100% { transform: scale(1);    opacity: 0.9; }
      50%       { transform: scale(1.18); opacity: 1;   }
    }
  `
  return style
}

// ── Timing constants ─────────────────────────────────────────────────────────
//
// Steps 1–3 animate at 1 500 ms/sub-step (9 sub-steps = ~13.5 s).
// Step 4 PAUSES until the API signals ready, then advances at 600 ms/sub-step.
// This ensures the last step never hangs — it starts only once the score exists.
//
//   Steps 1–3  →  9 sub-steps × 1 500 ms  =  13 500 ms
//   Step 4     →  waits for apiReady, then 3 × 600 ms  =  1 800 ms
//
const EARLY_SUB_STEP_MS   = 1_500   // steps 1–3
const LAST_STEP_SUB_MS    =   600   // step 4 — runs only after API ready

// ── Dynamic step generation ──────────────────────────────────────────────────

interface AnalysisStep {
  label: string
  subSteps: string[]
}

function generateSteps(product: ProductPayload | null): AnalysisStep[] {
  const cat       = (product?.category  || "").toLowerCase()
  const title     = (product?.title     || "").toLowerCase()
  const brand     = product?.brand      || "this brand"
  const materials = (product?.materials || "").toLowerCase()
  const origin    = product?.origin

  const isFood         = /food|grocer|drink|beverage|snack|cereal|coffee|tea|sauce|spice/.test(cat + title)
  const isFashion      = /cloth|apparel|fashion|shoe|wear|shirt|dress|jean|jacket|hoodie|sock/.test(cat + title)
  const isElectronics  = /electron|computer|phone|laptop|camera|tv|tablet|speaker|headphone|battery/.test(cat + title)
  const isPersonalCare = /beauty|personal care|health|cosmetic|skin|shampoo|lotion|soap|hygiene/.test(cat + title)

  // Step 1: Database checks
  const dbSubs: string[] = []
  if      (isFood)         dbSubs.push("Searching Open Food Facts database")
  else if (isFashion)      dbSubs.push("Querying GoodOnYou brand ethics index")
  else if (isElectronics)  dbSubs.push("Checking Energy Star certification records")
  else if (isPersonalCare) dbSubs.push("Scanning EWG Skin Deep database")
  else                     dbSubs.push("Searching sustainability certification records")

  if (isFashion || isPersonalCare) dbSubs.push(`Looking up ${brand} in B Corp registry`)
  else                             dbSubs.push("Checking EPA compliance records")

  if (materials) dbSubs.push(`Retrieving lifecycle data for ${materials}`)
  else           dbSubs.push("Scanning Amazon listing for certifications")

  // Step 2: Gemini AI research
  const geminiSubs: string[] = []
  if      (origin)         geminiSubs.push(`Factoring manufacturing origin: ${origin}`)
  else                     geminiSubs.push(`Researching ${brand}'s supply chain practices`)

  if      (materials)      geminiSubs.push(`Analyzing ${materials} environmental impact`)
  else if (isElectronics)  geminiSubs.push("Assessing electronics manufacturing footprint")
  else if (isFashion)      geminiSubs.push("Reviewing textile production sustainability")
  else if (isFood)         geminiSubs.push("Evaluating agricultural supply chain")
  else                     geminiSubs.push("Cross-referencing sustainability knowledge base")

  geminiSubs.push(`Reading ${brand}'s sustainability reports and controversies`)

  // Step 3: Score calculation
  const scoreSubs: string[] = [
    "Weighting carbon footprint (30% of score)",
    "Evaluating brand ethics and certifications",
  ]
  if      (isElectronics) scoreSubs.push("Scoring repairability and product lifespan")
  else if (isFashion)     scoreSubs.push("Penalizing fast-fashion risk and packaging waste")
  else if (isFood)        scoreSubs.push("Factoring organic certifications and food miles")
  else                    scoreSubs.push("Calculating packaging and durability score")

  // Step 4: Alternatives
  const catLabel = isElectronics   ? "electronics"
                 : isFashion       ? "apparel"
                 : isFood          ? "groceries"
                 : isPersonalCare  ? "personal care"
                 : "products"

  const altSubs: string[] = [
    `Scanning certified ${catLabel} for greener options`,
    "Comparing eco-scores across similar products",
    "Ranking alternatives by sustainability and price",
  ]

  return [
    { label: "Checking sustainability databases", subSteps: dbSubs     },
    { label: "Researching with Gemini AI",        subSteps: geminiSubs  },
    { label: "Calculating eco score",             subSteps: scoreSubs   },
    { label: "Finding greener alternatives",      subSteps: altSubs     },
  ]
}

// ── LoadingCard ──────────────────────────────────────────────────────────────

function LoadingCard({ product, apiReady, onAllDone }: {
  product: ProductPayload | null
  apiReady: boolean
  onAllDone: () => void
}) {
  const steps = generateSteps(product)

  const allPositions: Array<[number, number]> = steps.flatMap((s, si) =>
    s.subSteps.map((_, ssi) => [si, ssi] as [number, number])
  )

  const [pos, setPos] = useState(0)
  const doneFiredRef  = useRef(false)
  const onAllDoneRef  = useRef(onAllDone)
  useEffect(() => { onAllDoneRef.current = onAllDone })

  const [currentStep, currentSubStep] = allPositions[Math.min(pos, allPositions.length - 1)]
  const isLastStep = currentStep === steps.length - 1

  useEffect(() => {
    // All sub-steps done — fire the "ready to reveal" callback once
    if (pos >= allPositions.length - 1) {
      if (!doneFiredRef.current) {
        doneFiredRef.current = true
        onAllDoneRef.current()
      }
      return
    }
    // Pause at the start of step 4 until the API has responded
    if (isLastStep && !apiReady) return
    const delay = isLastStep ? LAST_STEP_SUB_MS : EARLY_SUB_STEP_MS
    const id = setTimeout(() => setPos(p => p + 1), delay)
    return () => clearTimeout(id)
  }, [pos, allPositions.length, isLastStep, apiReady])

  const pct = Math.round(((currentStep * 3 + currentSubStep + 1) / (steps.length * 3)) * 100)

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0,
      width: 380, zIndex: 2147483647,
      background: "#FFFFFF",
      boxShadow: "-6px 0 40px rgba(0,0,0,0.16), -1px 0 0 rgba(0,0,0,0.06)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column", overflow: "hidden",
      animation: "ecolens-slide-in 0.38s cubic-bezier(0.22,1,0.36,1) forwards"
    }}>

      {/* Header */}
      <div style={{
        background: "#1C2B3A", height: 52, flexShrink: 0,
        padding: "0 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.06)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 14C4 14 14 12 14 2C14 2 6 2 4 8C3.2 10 2.8 12 2 14Z" fill="#4ADE80" opacity="0.9"/>
            <path d="M2 14C4 10 6 7 10 5" stroke="#16A34A" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span style={{ color: "#FF9900", fontWeight: 800, fontSize: 14 }}>EcoLens</span>
          {product?.brand && (
            <span style={{ fontSize: 12, color: "#5A6878", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              · {product.brand}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%", background: "#4ADE80",
            boxShadow: "0 0 0 3px rgba(74,222,128,0.2)",
            animation: "ecolens-breathe 1.6s ease-in-out infinite"
          }} />
          <span style={{ fontSize: 12, color: "#7A95A8", fontWeight: 500 }}>Analyzing…</span>
        </div>
      </div>

      {/* Progress bar — under header */}
      <div style={{ height: 3, background: "#F0F4F8", flexShrink: 0 }}>
        <div style={{
          height: "100%", background: "#16A34A", borderRadius: "0 2px 2px 0",
          width: `${pct}%`, transition: "width 0.6s ease", position: "relative", overflow: "hidden"
        }}>
          <div style={{
            position: "absolute", top: 0, left: 0, width: "40%", height: "100%",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
            animation: "ecolens-sweep 1.6s ease-in-out infinite"
          }}/>
        </div>
      </div>

      {/* Step list — scrollable */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 8px" }}>
        {steps.map((step, si) => {
          const isDone    = si < currentStep
          const isActive  = si === currentStep
          const isPending = si > currentStep

          return (
            <div key={si} style={{
              marginBottom: si < steps.length - 1 ? 20 : 0,
              opacity: isPending ? 0.28 : 1,
              transition: "opacity 0.4s ease"
            }}>
              {/* Step row */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* Circle */}
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isDone ? "#DCFCE7" : isActive ? "#FFF7ED" : "#F3F4F6",
                  border: `2px solid ${isDone ? "#16A34A" : isActive ? "#FF9900" : "#E5E7EB"}`,
                  transition: "all 0.3s ease",
                  ...(isActive ? { animation: "ecolens-pulse-ring 2s ease-in-out infinite" } : {})
                }}>
                  {isDone ? (
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M2 5.5L4.5 8L9 3" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? "#FF9900" : "#C4C9D4" }}>{si + 1}</span>
                  )}
                </div>
                {/* Label */}
                <span style={{
                  fontSize: 14, flex: 1,
                  fontWeight: isActive ? 700 : isDone ? 500 : 400,
                  color: isDone ? "#9CA3AF" : isActive ? "#0F1923" : "#9CA3AF",
                }}>
                  {step.label}
                </span>
                {/* Badge */}
                {isDone && (
                  <span style={{ fontSize: 11, color: "#16A34A", fontWeight: 700, background: "#F0FDF4", padding: "3px 9px", borderRadius: 20, border: "1px solid #BBF7D0" }}>Done</span>
                )}
                {isActive && (
                  <span style={{ fontSize: 11, color: "#B45309", fontWeight: 700, background: "#FFFBEB", padding: "3px 9px", borderRadius: 20, border: "1px solid #FDE68A" }}>Running</span>
                )}
              </div>

              {/* Sub-steps */}
              {(isDone || isActive) && (
                <div style={{
                  marginTop: 10, marginLeft: 40,
                  borderLeft: `2px solid ${isDone ? "#BBF7D0" : "#FDE68A"}`,
                  paddingLeft: 14
                }}>
                  {step.subSteps.map((sub, ssi) => {
                    if (isActive && ssi > currentSubStep) return null
                    const subDone   = isDone || (isActive && ssi < currentSubStep)
                    const subActive = isActive && ssi === currentSubStep
                    return (
                      <div key={ssi} style={{
                        display: "flex", alignItems: "flex-start", gap: 9,
                        marginBottom: ssi < step.subSteps.length - 1 ? 8 : 0,
                        opacity: 0, animation: "ecolens-fade-up 0.22s ease both"
                      }}>
                        {/* Dot */}
                        <div style={{
                          width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: subDone ? "#DCFCE7" : "#FFF7ED",
                          border: `1.5px solid ${subDone ? "#86EFAC" : "#FCD34D"}`
                        }}>
                          {subDone ? (
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                              <path d="M1.5 4L3.2 5.7L6.5 2.5" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : (
                            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#F59E0B", animation: "ecolens-breathe 1s ease-in-out infinite" }} />
                          )}
                        </div>
                        {/* Text */}
                        <span style={{
                          fontSize: 13, color: subDone ? "#9CA3AF" : "#374151",
                          fontWeight: subActive ? 600 : 400, lineHeight: 1.5, flex: 1
                        }}>
                          {sub}
                          {subActive && (
                            <span style={{
                              display: "inline-block", width: 2, height: 13,
                              background: "#6B7280", marginLeft: 2,
                              verticalAlign: "text-bottom", borderRadius: 1,
                              animation: "ecolens-breathe 0.8s steps(2) infinite"
                            }}/>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{
        flexShrink: 0, padding: "12px 20px 16px",
        borderTop: "1px solid #EEF2F6",
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <span style={{ fontSize: 12, color: "#9CA3AF" }}>
          Step {currentStep + 1} of {steps.length}
        </span>
        <span style={{ fontSize: 12, color: "#9CA3AF" }}>AI-powered analysis</span>
      </div>
    </div>
  )
}

// ── Error card ──────────────────────────────────────────────────────────────

function ErrorCard({ onDismiss, onRetry }: { onDismiss: () => void; onRetry: () => void }) {
  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0,
      width: 380, zIndex: 2147483647,
      background: "#FFFFFF",
      boxShadow: "-6px 0 40px rgba(0,0,0,0.16), -1px 0 0 rgba(0,0,0,0.06)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column", overflow: "hidden",
      animation: "ecolens-slide-in 0.38s cubic-bezier(0.22,1,0.36,1) forwards"
    }}>
      {/* Header */}
      <div style={{
        background: "#1C2B3A", height: 52, flexShrink: 0,
        padding: "0 18px", display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 14C4 14 14 12 14 2C14 2 6 2 4 8C3.2 10 2.8 12 2 14Z" fill="#4ADE80" opacity="0.9"/>
            <path d="M2 14C4 10 6 7 10 5" stroke="#16A34A" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span style={{ color: "#FF9900", fontWeight: 800, fontSize: 14 }}>EcoLens</span>
        </div>
        <button onClick={onDismiss} style={{
          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8, color: "rgba(255,255,255,0.6)", cursor: "pointer",
          fontSize: 12, padding: "6px 10px", fontFamily: "inherit"
        }}>
          ✕ Close
        </button>
      </div>
      {/* Body */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 18 }}>😔</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#0F1923", marginBottom: 8 }}>
          Couldn't score this product
        </div>
        <div style={{ fontSize: 13, color: "#5A6B7A", lineHeight: 1.65, maxWidth: 260 }}>
          Check your connection and try again, or navigate to a different Amazon product page.
        </div>
        <button onClick={onRetry} style={{
          marginTop: 28, padding: "11px 28px",
          background: "#16A34A", border: "none", borderRadius: 10,
          fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer",
          fontFamily: "inherit"
        }}>
          Try again
        </button>
        <button onClick={onDismiss} style={{
          marginTop: 10, padding: "9px 28px",
          background: "transparent", border: "1px solid #E8EDF2", borderRadius: 10,
          fontSize: 13, fontWeight: 500, color: "#5A6B7A", cursor: "pointer",
          fontFamily: "inherit"
        }}>
          Dismiss
        </button>
      </div>
    </div>
  )
}

// ── Add-to-cart intercept overlay ───────────────────────────────────────────

interface InterceptCardProps {
  score: ScoreResponse
  onAddAnyway: () => void
  onDismiss: () => void
}

function InterceptCard({ score, onAddAnyway, onDismiss }: InterceptCardProps) {
  const co2 = score.score < 50 ? (2 + (100 - score.score) * 0.12).toFixed(1) : "0"
  const worst = Object.entries(score.dimensions).sort(([,a],[,b]) => a - b)[0]
  const dimLabels: Record<string, string> = {
    carbon: "Carbon footprint", packaging: "Packaging", brand_ethics: "Brand ethics",
    certifications: "Certifications", durability: "Durability"
  }
  const alt = score.alternatives?.[0]

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2147483647,
      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "ecolens-fade-in 0.25s ease both",
      fontFamily: "-apple-system, 'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{
        width: 340, background: "#fff", borderRadius: 20,
        boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
        overflow: "hidden",
        animation: "ecolens-score-pop 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #1a2533 0%, #232F3E 100%)",
          padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 14 }}>🍃</span>
            <span style={{ color: "#FF9900", fontWeight: 700, fontSize: 13 }}>EcoLens</span>
            <span style={{ fontSize: 10, color: "#6B7A8D", marginLeft: 4 }}>Slow Cart</span>
          </div>
          <button onClick={onDismiss} style={{
            background: "rgba(255,255,255,0.1)", border: "none", color: "#9CA3AF",
            cursor: "pointer", fontSize: 11, padding: "3px 8px", borderRadius: 5
          }}>✕</button>
        </div>

        {/* Warning banner */}
        <div style={{
          background: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
          padding: "16px 18px 12px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 36, lineHeight: 1 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#92400E" }}>Hold on a moment</div>
              <div style={{ fontSize: 12, color: "#B45309", marginTop: 2 }}>
                This product has a low eco-score ({score.score}/100)
              </div>
            </div>
          </div>
          <div style={{
            marginTop: 10, background: "rgba(255,255,255,0.6)", borderRadius: 10,
            padding: "8px 12px", display: "flex", gap: 16, justifyContent: "center"
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#DC2626" }}>~{co2} kg</div>
              <div style={{ fontSize: 9, color: "#6B7280", fontWeight: 600, textTransform: "uppercase" }}>CO₂ estimated</div>
            </div>
            <div style={{ width: 1, background: "#D1D5DB" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#B45309" }}>
                ⚠️ {dimLabels[worst?.[0]] ?? worst?.[0]}
              </div>
              <div style={{ fontSize: 9, color: "#6B7280", fontWeight: 600, textTransform: "uppercase" }}>Main concern</div>
            </div>
          </div>
        </div>

        {/* Greener swap */}
        {alt && (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #F3F4F6" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
              🌱 Greener alternative
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                background: "linear-gradient(135deg, #D1FAE5, #A7F3D0)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20
              }}>🌿</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", lineHeight: 1.3,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {alt.title}
                </div>
                <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>{alt.reason}</div>
              </div>
              <a
                href={`https://www.amazon.com/dp/${alt.asin}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  flexShrink: 0, background: "#16A34A", color: "#fff",
                  fontWeight: 700, fontSize: 10, padding: "5px 10px",
                  borderRadius: 8, textDecoration: "none", cursor: "pointer"
                }}
              >View</a>
            </div>
          </div>
        )}

        {/* CTAs */}
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={onDismiss}
            style={{
              width: "100%", padding: "11px", borderRadius: 11, border: "none",
              background: "linear-gradient(135deg, #16A34A, #15803D)",
              color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer",
            }}
          >
            🌱 Choose greener option
          </button>
          <button
            onClick={onAddAnyway}
            style={{
              width: "100%", padding: "9px", borderRadius: 11,
              background: "transparent", border: "1px solid #E5E7EB",
              color: "#9CA3AF", fontWeight: 500, fontSize: 11, cursor: "pointer",
            }}
          >
            Add anyway
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main overlay ────────────────────────────────────────────────────────────

function AmazonProductOverlay() {
  const [score,          setScore]          = useState<ScoreResponse | null>(null)
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState(false)
  const [dismissed,      setDismissed]      = useState(false)
  const [intercepting,   setIntercepting]   = useState(false)
  const [currentProduct, setCurrentProduct] = useState<ProductPayload | null>(null)
  const [apiReady,       setApiReady]       = useState(false)
  // Increment to remount LoadingCard fresh on each new analysis
  const [analysisKey, setAnalysisKey] = useState(0)
  // Increment to force a retry of the current ASIN
  const [retryKey, setRetryKey] = useState(0)

  const lastAsinRef       = useRef<string | null>(null)
  const pendingScore      = useRef<ScoreResponse | null>(null)
  const sessionRef        = useRef(0)   // incremented per analysis; guards stale responses
  const interceptedClick  = useRef<(() => void) | null>(null)
  const cartBtnCleanupRef = useRef<(() => void) | null>(null)

  function reveal() {
    if (pendingScore.current) {
      setScore(pendingScore.current)
      setLoading(false)
    }
  }

  function handleRetry() {
    lastAsinRef.current = null
    setError(false)
    setRetryKey(k => k + 1)
  }

  // Wire add-to-cart interception whenever we have a low-score result
  useEffect(() => {
    if (!score) return
    if (score.score >= 50) return  // only intercept low-score products

    // Clean up previous listener if any
    if (cartBtnCleanupRef.current) cartBtnCleanupRef.current()

    const btn = document.querySelector<HTMLElement>("#add-to-cart-button, #submit\\.add-to-cart")
    if (!btn) return

    const handler = (e: Event) => {
      e.preventDefault()
      e.stopImmediatePropagation()
      interceptedClick.current = () => {
        // Proceed with the real click after user confirms
        btn.removeEventListener("click", handler, true)
        btn.click()
      }
      setIntercepting(true)
    }

    btn.addEventListener("click", handler, true)
    cartBtnCleanupRef.current = () => btn.removeEventListener("click", handler, true)
    return () => { if (cartBtnCleanupRef.current) cartBtnCleanupRef.current() }
  }, [score])

  useEffect(() => {
    async function run() {
      await waitForElement("#productTitle")
      const product = extractProductData()
      if (!product) return
      if (product.asin === lastAsinRef.current) return

      lastAsinRef.current = product.asin
      // Capture session ID so stale API responses are ignored
      sessionRef.current++
      const session = sessionRef.current

      setScore(null)
      setError(false)
      setDismissed(false)
      setApiReady(false)
      setLoading(true)
      setCurrentProduct(product)
      // New key → LoadingCard unmounts and remounts with fresh internal state
      setAnalysisKey(k => k + 1)
      pendingScore.current = null

      // ── API call — starts immediately alongside the loading animation ────
      try {
        const token = await chrome.storage.local.get("auth_token").then(r => r.auth_token)
        if (session !== sessionRef.current) return
        const response = await sendMessageWithRetry({ type: "SCORE_PRODUCT", payload: product, token })
        if (session !== sessionRef.current) return  // navigated away mid-flight
        if (response?.ok) {
          pendingScore.current = response.data
          // Signal LoadingCard to resume step 4 and then reveal the score
          setApiReady(true)
        } else {
          throw new Error(response?.error || "Unknown error")
        }
      } catch (err) {
        if (session !== sessionRef.current) return
        console.error("[EcoLens] Score error:", err)
        setLoading(false)
        setError(true)
      }
    }

    run()

    const observer = new MutationObserver(() => {
      if (!chrome.runtime?.id) { observer.disconnect(); return }
      run()
    })
    observer.observe(document.querySelector("title") || document.head, {
      subtree: true, childList: true
    })
    return () => { observer.disconnect() }
  }, [retryKey])

  if (dismissed && !intercepting) return null
  if (!loading && !score && !error && !intercepting) return null

  return (
    <div>
      {loading && !score && (
        <LoadingCard key={analysisKey} product={currentProduct} apiReady={apiReady} onAllDone={reveal} />
      )}
      {error   && !dismissed && <ErrorCard onDismiss={() => setDismissed(true)} onRetry={handleRetry} />}
      {score   && !dismissed && !intercepting && <ScoreCard score={score} onDismiss={() => setDismissed(true)} />}
      {intercepting && score && (
        <InterceptCard
          score={score}
          onDismiss={() => setIntercepting(false)}
          onAddAnyway={() => {
            setIntercepting(false)
            interceptedClick.current?.()
          }}
        />
      )}
    </div>
  )
}

// Retry chrome.runtime.sendMessage on transient connection errors (e.g. extension
// just reloaded and the background service worker hasn't registered yet).
async function sendMessageWithRetry(msg: object, maxAttempts = 4): Promise<any> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await chrome.runtime.sendMessage(msg)
    } catch (err) {
      const text = String((err as Error)?.message ?? err)
      const isConnErr = text.includes("Receiving end does not exist") ||
                        text.includes("Extension context") ||
                        text.includes("Could not establish connection")
      if (!isConnErr || attempt === maxAttempts - 1) throw err
      // Exponential back-off: 300 ms, 600 ms, 1 200 ms
      await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt)))
    }
  }
}

function waitForElement(selector: string, timeout = 8000): Promise<Element | null> {
  const el = document.querySelector(selector)
  if (el) return Promise.resolve(el)
  return new Promise((resolve) => {
    const timer = setTimeout(() => { observer.disconnect(); resolve(null) }, timeout)
    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector)
      if (found) { clearTimeout(timer); observer.disconnect(); resolve(found) }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })
}

export default AmazonProductOverlay
