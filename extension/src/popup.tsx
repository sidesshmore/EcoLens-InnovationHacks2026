import { useEffect, useRef, useState } from "react"

const API_URL       = process.env.PLASMO_PUBLIC_API_URL       || "http://localhost:8000"
const DASHBOARD_URL = process.env.PLASMO_PUBLIC_DASHBOARD_URL || "http://localhost:3000"
const AUTH0_DOMAIN    = process.env.PLASMO_PUBLIC_AUTH0_DOMAIN    || ""
const AUTH0_CLIENT_ID = process.env.PLASMO_PUBLIC_AUTH0_CLIENT_ID || ""
const AUTH0_AUDIENCE  = process.env.PLASMO_PUBLIC_AUTH0_AUDIENCE  || "https://api.ecolens.app"

// ── Tokens ──────────────────────────────────────────────────────────────────

const C = {
  bg:       "#0B1622",
  card:     "#0F1C2A",
  card2:    "#111E2C",
  border:   "#162330",
  green:    "#34D399",
  greenDim: "#1A4A35",
  amber:    "#FBBF24",
  red:      "#F87171",
  blue:     "#60A5FA",
  purple:   "#A78BFA",
  text:     "#D4E4F0",
  muted:    "#3A5A70",
  dim:      "#1E3040",
  orange:   "#FF9900",
}

function scoreColor(s: number) {
  return s >= 65 ? C.green : s >= 40 ? C.amber : C.red
}

function getGrade(avg: number | null): { letter: string; color: string } {
  if (avg === null) return { letter: "–", color: C.muted }
  if (avg >= 80)   return { letter: "A",  color: "#34D399" }
  if (avg >= 70)   return { letter: "B+", color: "#6EE7B7" }
  if (avg >= 65)   return { letter: "B",  color: "#A7F3D0" }
  if (avg >= 55)   return { letter: "C+", color: "#FCD34D" }
  if (avg >= 45)   return { letter: "C",  color: C.amber }
  if (avg >= 35)   return { letter: "D",  color: "#FB923C" }
  return { letter: "F", color: C.red }
}

function co2Equiv(kg: number): string {
  if (kg < 0.05) return `${Math.round(kg * 1000 / 0.018)} phone charges`
  if (kg < 1)    return `${Math.round(kg / 0.12)} km less driving`
  if (kg < 100)  return `${Math.round(kg / 0.12)} km of car emissions`
  return `${(kg / 255).toFixed(1)} transatlantic flights`
}

// ── Global styles ────────────────────────────────────────────────────────────

const STYLES = `
  @keyframes rise  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes spin  { to   { transform:rotate(360deg); } }
  @keyframes glow  { 0%,100% { opacity:.7; } 50% { opacity:1; } }
  .r1 { animation: rise .4s cubic-bezier(.22,1,.36,1) .06s both; }
  .r2 { animation: rise .4s cubic-bezier(.22,1,.36,1) .14s both; }
  .r3 { animation: rise .4s cubic-bezier(.22,1,.36,1) .22s both; }
  .r4 { animation: rise .4s cubic-bezier(.22,1,.36,1) .30s both; }
  .r5 { animation: rise .4s cubic-bezier(.22,1,.36,1) .38s both; }
  button:hover { opacity:.88; }
`

// ── Hooks ────────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200) {
  const [v, setV] = useState(0)
  const raf = useRef<number>()
  useEffect(() => {
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      const e = 1 - Math.pow(1 - p, 3)
      setV(+(target * e).toFixed(2))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target])
  return v
}

// ── Grade ring ────────────────────────────────────────────────────────────────
// Circular arc that fills based on avg score (0–100), shows letter grade inside.

function GradeRing({ avgScore, grade, color }: {
  avgScore: number | null; grade: string; color: string
}) {
  const [filled, setFilled] = useState(0)
  const r = 26, sw = 5
  const circ = 2 * Math.PI * r
  useEffect(() => {
    const t = setTimeout(() => setFilled(avgScore !== null ? (avgScore / 100) * circ : 0), 200)
    return () => clearTimeout(t)
  }, [avgScore])

  return (
    <div style={{ position: "relative", width: 66, height: 66, flexShrink: 0 }}>
      <svg width="66" height="66" viewBox="0 0 66 66" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="33" cy="33" r={r} fill="none" stroke={C.dim} strokeWidth={sw} />
        <circle cx="33" cy="33" r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          style={{ transition: "stroke-dasharray 1.4s cubic-bezier(.22,1,.36,1)", filter: `drop-shadow(0 0 4px ${color}60)` }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"
      }}>
        <span style={{ fontSize: grade.length > 1 ? 16 : 20, fontWeight: 900, color, lineHeight: 1, letterSpacing: "-0.5px" }}>
          {grade}
        </span>
        {avgScore !== null && (
          <span style={{ fontSize: 8, color: C.muted, marginTop: 1, fontWeight: 600 }}>
            {avgScore}/100
          </span>
        )}
      </div>
    </div>
  )
}

// ── Mini sparkline ─────────────────────────────────────────────────────────
// Shows last N scores as colored dots connected by a line.

function Sparkline({ scores }: { scores: number[] }) {
  const pts = scores.slice(-7)
  if (pts.length < 2) return null
  const W = 90, H = 28
  const points = pts.map((s, i) => ({
    x: Math.round((i / (pts.length - 1)) * W),
    y: Math.round(H - (s / 100) * (H - 4) - 2),
    s
  }))
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <path d={path} fill="none" stroke={C.dim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 3.5 : 2.5}
          fill={scoreColor(p.s)}
          opacity={i === points.length - 1 ? 1 : 0.55}
          style={i === points.length - 1 ? { filter: `drop-shadow(0 0 3px ${scoreColor(p.s)})` } : undefined}
        />
      ))}
    </svg>
  )
}

// ── Budget bar ──────────────────────────────────────────────────────────────

function BudgetBar({ pct, color }: { pct: number; color: string }) {
  const [w, setW] = useState(0)
  useEffect(() => { const t = setTimeout(() => setW(Math.min(100, pct)), 400); return () => clearTimeout(t) }, [pct])
  return (
    <div style={{ background: C.dim, borderRadius: 99, height: 5, overflow: "hidden" }}>
      <div style={{
        width: `${w}%`, height: "100%", borderRadius: 99,
        background: `linear-gradient(90deg, ${color}88, ${color})`,
        transition: "width 1.3s cubic-bezier(.22,1,.36,1)"
      }} />
    </div>
  )
}

// ── Skeleton shimmer ─────────────────────────────────────────────────────────

function Skel({ h = 12, w = "100%" }: { h?: number; w?: string | number }) {
  return (
    <div style={{
      height: h, borderRadius: 6, width: w,
      background: `linear-gradient(90deg, ${C.card} 25%, ${C.card2} 50%, ${C.card} 75%)`,
      backgroundSize: "400% 100%",
      animation: "glow 1.6s ease-in-out infinite"
    }} />
  )
}

// ── SVG icons ────────────────────────────────────────────────────────────────

const IcoLeaf = ({ size = 16, color = C.green }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M17 8C8 10 5.9 16.17 3.82 19.82L5.71 21l.95-1.71c.43.21.88.42 1.34.59 0 0 1.7-7.88 9-12Z" fill={color}/>
    <path d="M3 21c4-4 8-8 17-10" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const IcoGlobe = ({ size = 13, color = C.purple }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5"/>
    <path d="M12 3c-2.5 3-4 6-4 9s1.5 6 4 9M12 3c2.5 3 4 6 4 9s-1.5 6-4 9M3 12h18" stroke={color} strokeWidth="1.2"/>
  </svg>
)

const IcoChart = ({ size = 14, color = "#1A0A00" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M3 3v18h18" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <path d="M7 16l4-4 4 4 4-6" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const IcoWallet = ({ size = 12, color = C.muted }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="2" y="6" width="20" height="13" rx="2" stroke={color} strokeWidth="1.5"/>
    <path d="M2 10h20" stroke={color} strokeWidth="1.5"/>
    <circle cx="17" cy="15" r="1" fill={color}/>
  </svg>
)

const IcoFlame = ({ size = 12, color = C.amber }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2C9.5 5 8 8 10 11c-1.5-.5-2.5-2-2.5-2C6 12 6 14 8 16c-1 0-2-.5-2-.5C6 19 8.5 22 12 22s6-3 6-6.5c0-2-1-3.5-2-4.5 0 0-.5 2-2 2.5C15 11 14 7 12 2Z"/>
  </svg>
)

const IcoEdit = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M11 4H4a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-7" stroke={C.muted} strokeWidth="2" strokeLinecap="round"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" stroke={C.muted} strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

// ── Pill badge ────────────────────────────────────────────────────────────────

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      fontSize: 8.5, fontWeight: 700, color,
      background: `${color}18`, border: `1px solid ${color}35`,
      borderRadius: 99, padding: "2px 7px", whiteSpace: "nowrap"
    }}>
      {text}
    </span>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 8, fontWeight: 700, color: C.dim,
      textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8
    }}>
      {children}
    </div>
  )
}

// ── Main popup ────────────────────────────────────────────────────────────────

export default function Popup() {
  const [token,     setToken]     = useState<string | null>(null)
  const [email,     setEmail]     = useState<string | null>(null)
  const [stats,     setStats]     = useState<{
    total_co2_saved_kg: number; scan_streak: number; scan_count: number
  } | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [globalImpact, setGlobalImpact] = useState<{
    total_co2_kg: number; total_users: number
  } | null>(null)
  const [localAvoided,    setLocalAvoided]    = useState(0)
  const [co2Spent,        setCo2Spent]        = useState(0)
  const [budget,          setBudget]          = useState(20)
  const [editingBudget,   setEditingBudget]   = useState(false)
  const [budgetInput,     setBudgetInput]     = useState("20")
  const [weeklyScores,    setWeeklyScores]    = useState<number[]>([])
  const [lastWeekAvg,     setLastWeekAvg]     = useState<number | null>(null)
  const [weeklyScans,     setWeeklyScans]     = useState(0)
  const [signingIn,       setSigningIn]       = useState(false)
  const [signInError,     setSignInError]     = useState<string | null>(null)
  const [showRedirectHint, setShowRedirectHint] = useState(false)
  const [redirectUrl,     setRedirectUrl]     = useState("")

  // Inject styles
  useEffect(() => {
    const el = document.head, s = document.createElement("style")
    s.textContent = STYLES; el.appendChild(s)
    return () => { el.removeChild(s) }
  }, [])

  // Load from storage + API
  useEffect(() => {
    chrome.storage.local.get([
      "auth_token", "user_email",
      "co2_avoided_kg", "co2_spent_kg", "co2_budget",
      "weekly_scores", "last_week_avg_score", "weekly_scan_count"
    ]).then(r => {
      setToken(r.auth_token || null)
      setEmail(r.user_email || null)
      setLocalAvoided(r.co2_avoided_kg ?? 0)
      setCo2Spent(r.co2_spent_kg ?? 0)
      setWeeklyScores(Array.isArray(r.weekly_scores) ? r.weekly_scores : [])
      setLastWeekAvg(typeof r.last_week_avg_score === "number" ? r.last_week_avg_score : null)
      setWeeklyScans(r.weekly_scan_count ?? 0)
      const b = r.co2_budget ?? 20
      setBudget(b); setBudgetInput(String(b))
      if (r.auth_token) { setLoadingStats(true); fetchStats(r.auth_token) }
    })
    fetchGlobal()
  }, [])

  async function fetchStats(t: string) {
    try {
      const r = await fetch(`${API_URL}/api/user/stats`, { headers: { Authorization: `Bearer ${t}` } })
      if (r.ok) setStats(await r.json())
    } catch {}
    setLoadingStats(false)
  }

  async function fetchGlobal() {
    try {
      const r = await fetch(`${API_URL}/api/impact/global`)
      if (r.ok) setGlobalImpact(await r.json())
    } catch {}
  }

  async function handleLogin() {
    setSigningIn(true); setSignInError(null)
    if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID) {
      setSigningIn(false)
      setSignInError("Auth0 not configured — set PLASMO_PUBLIC_AUTH0_DOMAIN + CLIENT_ID in .env")
      return
    }

    // ── PKCE helpers ──────────────────────────────────────────────────────────
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const verifier = btoa(String.fromCharCode(...array))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")

    const redirectUri = chrome.identity.getRedirectURL()
    setRedirectUrl(redirectUri)

    const authUrl = `https://${AUTH0_DOMAIN}/authorize`
      + `?response_type=code`
      + `&client_id=${AUTH0_CLIENT_ID}`
      + `&redirect_uri=${encodeURIComponent(redirectUri)}`
      + `&scope=${encodeURIComponent("openid profile email")}`
      + `&audience=${encodeURIComponent(AUTH0_AUDIENCE)}`
      + `&code_challenge=${challenge}`
      + `&code_challenge_method=S256`

    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async (responseUrl) => {
      setSigningIn(false)
      const err = chrome.runtime.lastError?.message ?? ""
      if (err || !responseUrl) {
        if (err.includes("canceled") || err.includes("closed")) return
        setShowRedirectHint(true)
        setSignInError(
          err.includes("not allowed") || err.includes("redirect")
            ? "Redirect URL not in Auth0. Add it under Application → Allowed Callback URLs."
            : err || "Sign-in failed — check Auth0 config."
        )
        return
      }
      try {
        const code = new URL(responseUrl).searchParams.get("code")
        if (!code) {
          // Possibly an error response
          const errParam = new URL(responseUrl).searchParams.get("error_description")
            || new URL(responseUrl).searchParams.get("error")
          setSignInError(errParam || "No auth code returned from Auth0.")
          return
        }

        // Exchange code → tokens (PKCE — no client_secret needed for native apps)
        const tokenRes = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "authorization_code",
            client_id: AUTH0_CLIENT_ID,
            code_verifier: verifier,
            code,
            redirect_uri: redirectUri,
          }),
        })
        const tokens = await tokenRes.json()
        const accessToken: string | undefined = tokens.access_token
        if (!accessToken) {
          setSignInError(tokens.error_description || tokens.error || "No access token in response.")
          return
        }

        let em = ""
        if (tokens.id_token) {
          try {
            const payload = tokens.id_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
            em = JSON.parse(atob(payload)).email ?? ""
          } catch {}
        }

        chrome.storage.local.set({ auth_token: accessToken, user_email: em })
        setToken(accessToken); if (em) setEmail(em)
        setLoadingStats(true); fetchStats(accessToken)
      } catch (e) { setSignInError(`Sign-in error: ${e}`) }
    })
  }

  function handleLogout() {
    chrome.storage.local.remove(["auth_token", "user_email"])
    setToken(null); setEmail(null); setStats(null)
  }

  function saveBudget() {
    const v = parseFloat(budgetInput)
    if (!isNaN(v) && v > 0) { setBudget(v); chrome.storage.local.set({ co2_budget: v }) }
    setEditingBudget(false)
  }

  // ── Derived values ──────────────────────────────────────────────────────────

  const co2Saved   = stats?.total_co2_saved_kg ?? localAvoided
  const co2CountUp = useCountUp(co2Saved)
  const weeklyAvg  = weeklyScores.length
    ? Math.round(weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length)
    : null
  const grade      = getGrade(weeklyAvg)
  const trendDiff  = (weeklyAvg !== null && lastWeekAvg !== null) ? weeklyAvg - lastWeekAvg : null
  const trendLabel = trendDiff === null ? null
    : trendDiff > 2  ? `↑ up ${trendDiff} pts vs last week`
    : trendDiff < -2 ? `↓ down ${Math.abs(trendDiff)} pts vs last week`
    : "→ steady vs last week"
  const trendColor = trendDiff === null ? C.muted : trendDiff > 2 ? C.green : trendDiff < -2 ? C.red : C.amber
  const budgetPct  = Math.min(100, (co2Spent / budget) * 100)
  const budgetLeft = Math.max(0, budget - co2Spent)
  const budgetColor = budgetPct >= 80 ? C.red : budgetPct >= 50 ? C.amber : C.green
  const streak     = stats?.scan_streak ?? 0
  const globalTonnes = globalImpact ? (globalImpact.total_co2_kg / 1000) : 0

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      width: 318, background: C.bg, color: C.text,
      fontFamily: "'Segoe UI', system-ui, sans-serif", minHeight: 280
    }}>

      {/* ── HEADER ── */}
      <div style={{
        padding: "12px 14px 11px",
        background: `linear-gradient(160deg, #0E1D2D 0%, ${C.bg} 100%)`,
        borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "linear-gradient(135deg, #0D3D28, #1A5C40)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 10px ${C.green}30`
          }}>
            <IcoLeaf size={17} color={C.green} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: "-0.2px", color: C.text, lineHeight: 1 }}>
              EcoLens
            </div>
            <div style={{ fontSize: 8, color: C.dim, marginTop: 1.5 }}>
              AI sustainability scores for Amazon
            </div>
          </div>
        </div>

        {token && (
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              background: "linear-gradient(135deg, #FF9900, #FFB84D)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9.5, fontWeight: 800, color: "#1A0A00", flexShrink: 0
            }}>
              {email ? email[0].toUpperCase() : "U"}
            </div>
            <button onClick={handleLogout} style={{
              background: "none", border: `1px solid ${C.border}`, color: C.muted,
              borderRadius: 6, fontSize: 8, padding: "3px 7px", cursor: "pointer"
            }}>
              Sign out
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: "13px 13px 15px" }}>
        {token ? (
          /* ════════════════════ AUTHENTICATED ════════════════════ */
          <>
            {/* ── IMPACT HERO: grade + co2 ── */}
            <div className="r1" style={{
              background: C.card, borderRadius: 14, padding: "14px",
              marginBottom: 8, border: `1px solid ${C.border}`
            }}>
              <SectionLabel>Your eco impact</SectionLabel>

              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {/* Grade ring */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <GradeRing avgScore={weeklyAvg} grade={grade.letter} color={grade.color} />
                  <span style={{ fontSize: 7.5, color: C.dim, letterSpacing: "0.3px" }}>
                    ECO GRADE
                  </span>
                </div>

                {/* CO₂ + trend */}
                <div style={{ flex: 1 }}>
                  {loadingStats ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <Skel h={28} w="70%" />
                      <Skel h={10} w="90%" />
                      <Skel h={10} w="55%" />
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 2 }}>
                        <span style={{
                          fontSize: 28, fontWeight: 900, color: C.green,
                          letterSpacing: "-1.5px", lineHeight: 1
                        }}>
                          {co2CountUp.toFixed(1)}
                        </span>
                        <span style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>
                          kg CO₂ avoided
                        </span>
                      </div>

                      {co2Saved > 0.02 && (
                        <div style={{ fontSize: 9, color: C.dim, marginBottom: 6 }}>
                          ≈ {co2Equiv(co2Saved)}
                        </div>
                      )}

                      {trendLabel && (
                        <Pill text={trendLabel} color={trendColor} />
                      )}

                      {co2Saved === 0 && (
                        <div style={{ fontSize: 9, color: C.dim, lineHeight: 1.5 }}>
                          Skip high-impact products to<br />earn CO₂ credits here.
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── THIS WEEK: sparkline + scans + streak ── */}
            {(weeklyScores.length > 0 || streak > 0) && (
              <div className="r2" style={{
                background: C.card, borderRadius: 14, padding: "12px 13px",
                marginBottom: 8, border: `1px solid ${C.border}`
              }}>
                <SectionLabel>This week</SectionLabel>

                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  {/* Sparkline */}
                  {weeklyScores.length >= 2 && (
                    <div style={{ flexShrink: 0 }}>
                      <Sparkline scores={weeklyScores} />
                      <div style={{ fontSize: 7.5, color: C.dim, marginTop: 4, textAlign: "center" }}>
                        score trend
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
                    {weeklyAvg !== null && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 9, color: C.muted }}>Avg score this week</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: scoreColor(weeklyAvg) }}>
                          {weeklyAvg}/100
                        </span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 9, color: C.muted }}>Products scanned</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{weeklyScans}</span>
                    </div>
                    {streak > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 9, color: C.muted, display: "flex", alignItems: "center", gap: 4 }}>
                          <IcoFlame size={10} color={streak >= 7 ? C.amber : C.muted} />
                          {streak >= 7 ? "Streak — on a roll!" : "Scan streak"}
                        </span>
                        <span style={{
                          fontSize: 12, fontWeight: 800,
                          color: streak >= 7 ? C.amber : C.text
                        }}>
                          {streak}d
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── CARBON BUDGET ── */}
            <div className="r3" style={{
              background: C.card, borderRadius: 14, padding: "11px 13px",
              marginBottom: 8, border: `1px solid ${C.border}`
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <IcoWallet size={11} color={budgetColor} />
                  <span style={{ fontSize: 8, fontWeight: 700, color: C.dim, textTransform: "uppercase", letterSpacing: "0.6px" }}>
                    Monthly carbon budget
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: budgetColor }}>
                    {co2Spent.toFixed(1)}
                    <span style={{ fontWeight: 500, color: C.muted }}>/{budget} kg</span>
                  </span>
                  <button
                    onClick={() => setEditingBudget(e => !e)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", opacity: .7 }}>
                    <IcoEdit size={10} />
                  </button>
                </div>
              </div>

              {editingBudget && (
                <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
                  <input
                    type="number" value={budgetInput} min="1" max="999"
                    onChange={e => setBudgetInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveBudget(); if (e.key === "Escape") setEditingBudget(false) }}
                    style={{
                      flex: 1, background: "#0A1520", border: `1px solid ${C.greenDim}`,
                      color: C.text, borderRadius: 7, padding: "5px 9px", fontSize: 11, outline: "none"
                    }}
                    autoFocus
                  />
                  <button onClick={saveBudget} style={{
                    background: C.greenDim, border: `1px solid ${C.green}40`, color: C.green,
                    borderRadius: 7, padding: "5px 10px", fontSize: 10, cursor: "pointer", fontWeight: 700
                  }}>
                    Save
                  </button>
                </div>
              )}

              <BudgetBar pct={budgetPct} color={budgetColor} />

              <div style={{
                display: "flex", justifyContent: "space-between",
                marginTop: 5, fontSize: 8, color: C.dim
              }}>
                <span>
                  {budgetPct >= 100
                    ? "Budget exceeded — consider eco swaps"
                    : `${budgetLeft.toFixed(1)} kg remaining`}
                </span>
                <span>{Math.round(budgetPct)}%</span>
              </div>
            </div>

            {/* ── COMMUNITY ── */}
            {globalImpact && (
              <div className="r4" style={{
                background: "linear-gradient(135deg, #0A1E14 0%, #0B1A20 100%)",
                borderRadius: 14, padding: "10px 13px",
                marginBottom: 10, border: `1px solid #1A3A2A`
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IcoGlobe size={28} color="#818CF8" />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                      <span style={{ fontSize: 18, fontWeight: 900, color: C.green, letterSpacing: "-0.5px", lineHeight: 1 }}>
                        {globalTonnes >= 1
                          ? `${globalTonnes.toFixed(1)}t`
                          : `${globalImpact.total_co2_kg.toFixed(1)} kg`}
                      </span>
                      <span style={{ fontSize: 9, color: "#2A5040" }}>CO₂ avoided collectively</span>
                    </div>
                    <div style={{ fontSize: 8, color: "#1E3A2A", marginTop: 3 }}>
                      by {globalImpact.total_users.toLocaleString()} EcoLens users worldwide
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── ONBOARDING NUDGE (no data yet) ── */}
            {!loadingStats && weeklyScores.length === 0 && co2Saved === 0 && (
              <div className="r4" style={{
                background: C.card, borderRadius: 12, padding: "11px 13px",
                marginBottom: 10, border: `1px solid ${C.border}`,
                textAlign: "center"
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${C.green}15`, border: `1px solid ${C.greenDim}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 8px"
                }}>
                  <IcoLeaf size={18} color={C.green} />
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                  Ready to start scoring
                </div>
                <div style={{ fontSize: 9, color: C.muted, lineHeight: 1.6 }}>
                  Visit any Amazon product page.<br />
                  EcoLens will appear automatically.
                </div>
              </div>
            )}

            {/* ── CTA ── */}
            <a href={DASHBOARD_URL} target="_blank" rel="noreferrer" className="r5"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                padding: "11px 0", background: C.orange, color: "#1A0A00",
                borderRadius: 11, fontWeight: 800, fontSize: 12,
                textDecoration: "none", boxShadow: `0 2px 14px ${C.orange}28`,
                letterSpacing: "0.1px"
              }}>
              <IcoChart size={13} color="#1A0A00" />
              View Full Dashboard
            </a>
          </>
        ) : (
          /* ════════════════════ UNAUTHENTICATED ════════════════════ */
          <>
            {/* Hero */}
            <div className="r1" style={{ textAlign: "center", marginBottom: 18, paddingTop: 6 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, margin: "0 auto 13px",
                background: "linear-gradient(135deg, #0D3D28, #1A5C40)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 28px ${C.green}28`
              }}>
                <IcoLeaf size={30} color={C.green} />
              </div>
              <div style={{
                fontSize: 15.5, fontWeight: 800, color: C.text, lineHeight: 1.3,
                marginBottom: 8, letterSpacing: "-0.4px"
              }}>
                Know the real cost<br />of what you buy
              </div>
              <div style={{ fontSize: 9.5, color: C.muted, lineHeight: 1.7 }}>
                AI-powered sustainability scores on every Amazon product —
                instant, honest, actionable.
              </div>
            </div>

            {/* 3 key value props */}
            <div className="r2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
              {[
                {
                  svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8Z" stroke={C.amber} strokeWidth="1.8" strokeLinejoin="round"/></svg>,
                  title: "Instant score",
                  sub: "Every product, in seconds",
                  accent: C.amber
                },
                {
                  svg: <IcoLeaf size={18} color={C.green} />,
                  title: "Eco swaps",
                  sub: "Always a greener option",
                  accent: C.green
                },
                {
                  svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 3v18h18" stroke={C.blue} strokeWidth="1.8" strokeLinecap="round"/><path d="M7 16l4-4 4 4 4-6" stroke={C.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                  title: "CO₂ tracker",
                  sub: "See your real impact",
                  accent: C.blue
                }
              ].map((f, i) => (
                <div key={i} style={{
                  background: C.card, borderRadius: 10, padding: "10px 8px",
                  textAlign: "center", border: `1px solid ${C.border}`
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9, margin: "0 auto 7px",
                    background: `${f.accent}12`,
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    {f.svg}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.text, marginBottom: 2 }}>
                    {f.title}
                  </div>
                  <div style={{ fontSize: 8, color: C.dim, lineHeight: 1.4 }}>
                    {f.sub}
                  </div>
                </div>
              ))}
            </div>

            {/* Community proof (real data) */}
            {globalImpact && globalImpact.total_co2_kg > 0 && (
              <div className="r3" style={{
                background: "linear-gradient(135deg, #0A1E14, #0B1A20)",
                borderRadius: 10, padding: "9px 12px", marginBottom: 13,
                border: "1px solid #1A3A2A",
                display: "flex", alignItems: "center", gap: 9
              }}>
                <IcoGlobe size={22} color="#818CF8" />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.green }}>
                    {globalImpact.total_co2_kg.toFixed(1)} kg CO₂ saved community-wide
                  </div>
                  <div style={{ fontSize: 8, color: "#2A5040", marginTop: 2 }}>
                    {globalImpact.total_users.toLocaleString()} users already making better choices
                  </div>
                </div>
              </div>
            )}

            {/* Sign-in error */}
            {signInError && (
              <div style={{
                background: "#1E0A0A", border: "1px solid #5A1A1A",
                borderRadius: 9, padding: "8px 10px", marginBottom: 10
              }}>
                <div style={{ fontSize: 9, color: "#FCA5A5", lineHeight: 1.5 }}>{signInError}</div>
                {showRedirectHint && redirectUrl && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 8, color: "#6B7280", marginBottom: 3 }}>
                      Add to Auth0 → Applications → Allowed Callback URLs:
                    </div>
                    <div
                      onClick={() => navigator.clipboard.writeText(redirectUrl).catch(() => {})}
                      title="Click to copy"
                      style={{
                        background: "#0A1020", borderRadius: 5, padding: "4px 7px",
                        fontFamily: "monospace", fontSize: 7.5, color: C.blue,
                        wordBreak: "break-all", cursor: "pointer", border: "1px solid #1A3A5A"
                      }}>
                      {redirectUrl}
                    </div>
                    <div style={{ fontSize: 7.5, color: C.dim, marginTop: 3 }}>
                      Click to copy · paste in Auth0 dashboard
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CTA button */}
            <button
              onClick={handleLogin}
              disabled={signingIn}
              className="r4"
              style={{
                width: "100%", padding: "12px 0",
                background: signingIn ? C.card2 : C.orange,
                color: signingIn ? C.muted : "#1A0A00",
                border: "none", borderRadius: 11, fontWeight: 800, fontSize: 13,
                cursor: signingIn ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: signingIn ? "none" : `0 2px 14px ${C.orange}28`,
                marginBottom: 9, letterSpacing: "0.1px"
              }}>
              {signingIn ? (
                <>
                  <div style={{
                    width: 13, height: 13, border: `2px solid ${C.border}`,
                    borderTopColor: C.muted, borderRadius: "50%",
                    animation: "spin .75s linear infinite"
                  }} />
                  Signing in…
                </>
              ) : (
                <>
                  <div style={{
                    width: 17, height: 17, background: "#fff", borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 900, color: "#4285F4"
                  }}>G</div>
                  Sign in with Google
                </>
              )}
            </button>

            <div style={{ textAlign: "center", fontSize: 8.5, color: C.dim, lineHeight: 1.5 }}>
              Guest mode available · 3 free scans / day
            </div>
          </>
        )}
      </div>
    </div>
  )
}
