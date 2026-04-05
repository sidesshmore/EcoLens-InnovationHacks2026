import { createClient } from "@supabase/supabase-js"
import { createHash } from "crypto"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

// Server-side queries use the service role key to bypass RLS.
// This module is only imported by server components — the key is never sent to the browser.
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, serviceRoleKey)

// Mirror of backend's _sub_to_uuid() — must match exactly.
// Python: str(uuid.uuid5(uuid.NAMESPACE_URL, sub))
// NAMESPACE_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
const NAMESPACE_URL_HEX = "6ba7b8119dad11d180b400c04fd430c8"

export function subToUuid(sub: string): string {
  const nsBytes   = Buffer.from(NAMESPACE_URL_HEX, "hex")
  const nameBytes = Buffer.from(sub, "utf8")
  const hash      = createHash("sha1")
    .update(Buffer.concat([nsBytes, nameBytes]))
    .digest()

  hash[6] = (hash[6] & 0x0f) | 0x50  // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80  // RFC 4122 variant

  const h = hash.slice(0, 16).toString("hex")
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`
}

export interface UserStats {
  total_co2_saved_kg: number
  scan_streak:        number
  scan_count:         number
}

export interface ScanHistoryItem {
  id:            string
  asin:          string
  scanned_at:    string
  co2_saved_kg:  number
  score:         number | null
  product_title: string | null
}

export async function getUserStats(rawSub: string): Promise<UserStats | null> {
  const uid = subToUuid(rawSub)

  const [userRes, countRes] = await Promise.all([
    supabase
      .from("users")
      .select("total_co2_saved_kg, scan_streak")
      .eq("id", uid)
      .single(),
    supabase
      .from("scans")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid),
  ])

  if (userRes.error || !userRes.data) return null

  return {
    total_co2_saved_kg: userRes.data.total_co2_saved_kg ?? 0,
    scan_streak:        userRes.data.scan_streak        ?? 0,
    scan_count:         countRes.count                  ?? 0,
  }
}

export interface DecisionItem {
  asin:           string
  decision:       "skip" | "buy"
  co2_avoided_kg: number
  created_at:     string
}

export interface DecisionStats {
  skipCount:    number
  buyCount:     number
  totalCo2:     number
  skipRate:     number   // 0–100
  items:        DecisionItem[]
}

export async function getDecisionStats(rawSub: string): Promise<DecisionStats> {
  const uid = subToUuid(rawSub)
  try {
    const { data, error } = await supabase
      .from("decisions")
      .select("asin, decision, co2_avoided_kg, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50)
    if (error || !data) return { skipCount: 0, buyCount: 0, totalCo2: 0, skipRate: 0, items: [] }
    const items = data as DecisionItem[]
    const skipCount = items.filter(d => d.decision === "skip").length
    const buyCount  = items.filter(d => d.decision === "buy").length
    const totalCo2  = items.reduce((s, d) => s + (d.co2_avoided_kg ?? 0), 0)
    const total     = skipCount + buyCount
    return {
      skipCount,
      buyCount,
      totalCo2: Math.round(totalCo2 * 100) / 100,
      skipRate: total > 0 ? Math.round((skipCount / total) * 100) : 0,
      items,
    }
  } catch {
    return { skipCount: 0, buyCount: 0, totalCo2: 0, skipRate: 0, items: [] }
  }
}

// ── Trend data (14-day daily buckets) ────────────────────────────────────────

export interface TrendPoint {
  date:  string   // ISO "YYYY-MM-DD"
  label: string   // "Apr 5"
  co2:   number   // kg saved that day
  scans: number
}

export async function getScanTrend(rawSub: string, days = 14): Promise<TrendPoint[]> {
  const uid  = subToUuid(rawSub)
  const from = new Date(Date.now() - days * 86_400_000).toISOString()

  const { data } = await supabase
    .from("scans")
    .select("scanned_at, co2_saved_kg")
    .eq("user_id", uid)
    .gte("scanned_at", from)
    .order("scanned_at", { ascending: true })

  // Build daily buckets from oldest → newest
  const buckets = new Map<string, { co2: number; scans: number }>()
  for (let i = days - 1; i >= 0; i--) {
    const d   = new Date(Date.now() - i * 86_400_000)
    const key = d.toISOString().slice(0, 10)
    buckets.set(key, { co2: 0, scans: 0 })
  }
  for (const row of data ?? []) {
    const key = (row.scanned_at as string).slice(0, 10)
    const b   = buckets.get(key)
    if (b) { b.co2 += Number(row.co2_saved_kg ?? 0); b.scans++ }
  }

  return Array.from(buckets.entries()).map(([date, b]) => ({
    date,
    label: new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    co2:   Math.round(b.co2 * 100) / 100,
    scans: b.scans,
  }))
}

// ── Community aggregate ───────────────────────────────────────────────────────

export interface CommunityStats {
  totalUsers:  number
  totalCo2Kg:  number
  totalScans:  number
}

export async function getCommunityStats(): Promise<CommunityStats> {
  try {
    const [usersRes, scansRes] = await Promise.all([
      supabase.from("users").select("total_co2_saved_kg"),
      supabase.from("scans").select("id", { count: "exact", head: true }),
    ])
    const users      = usersRes.data ?? []
    const totalUsers = users.length
    const totalCo2   = users.reduce((s, u) => s + Number(u.total_co2_saved_kg ?? 0), 0)
    return {
      totalUsers,
      totalCo2Kg: Math.round(totalCo2 * 10) / 10,
      totalScans:  scansRes.count ?? 0,
    }
  } catch {
    return { totalUsers: 0, totalCo2Kg: 0, totalScans: 0 }
  }
}

// ── Scan history ──────────────────────────────────────────────────────────────

export async function getScanHistory(
  rawSub: string,
  limit = 20
): Promise<ScanHistoryItem[]> {
  const uid = subToUuid(rawSub)

  // product_title and score are stored directly on scans (see schema)
  const { data, error } = await supabase
    .from("scans")
    .select("id, asin, scanned_at, co2_saved_kg, score, product_title")
    .eq("user_id", uid)
    .order("scanned_at", { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map((row: any) => ({
    id:            row.id,
    asin:          row.asin,
    scanned_at:    row.scanned_at,
    co2_saved_kg:  row.co2_saved_kg ?? 0,
    score:         row.score        ?? null,
    product_title: row.product_title ?? row.asin,
  }))
}

// ── Rich scan history (with scores_cache join) ────────────────────────────────

export interface Dimensions {
  carbon:         number
  packaging:      number
  brand_ethics:   number
  certifications: number
  durability:     number
}

export interface Alternative {
  asin:        string
  title:       string
  score:       number
  price_delta: number | null
  reason:      string
  image_url:   string | null
}

export interface RichScanItem {
  id:                      string
  asin:                    string
  scanned_at:              string
  co2_saved_kg:            number
  product_title:           string | null
  score:                   number
  leaf_rating:             number
  dimensions:              Dimensions
  climate_pledge_friendly: boolean
  explanation:             string | null
  confidence:              "High" | "Medium" | "Low"
  data_sources:            string[]
  alternatives:            Alternative[]
  voice_audio_url:         string | null
  decision?:               "skip" | "buy" | null  // user's decision on this product
}

export async function getRichScanHistory(rawSub: string, limit = 50): Promise<RichScanItem[]> {
  const uid = subToUuid(rawSub)

  const [scansRes, decisionsRes] = await Promise.all([
    supabase
      .from("scans")
      .select(`id, asin, scanned_at, co2_saved_kg, product_title, score, scores_cache(leaf_rating, dimensions, climate_pledge_friendly, explanation, confidence, data_sources, alternatives, voice_audio_url)`)
      .eq("user_id", uid)
      .order("scanned_at", { ascending: false })
      .limit(limit),
    supabase
      .from("decisions")
      .select("asin, decision")
      .eq("user_id", uid)
  ])

  const decisionMap = new Map<string, "skip" | "buy">()
  for (const d of decisionsRes.data ?? []) {
    decisionMap.set(d.asin, d.decision as "skip" | "buy")
  }

  if (scansRes.error || !scansRes.data) return []

  return scansRes.data.map((row: any) => {
    const cache = Array.isArray(row.scores_cache) ? row.scores_cache[0] : row.scores_cache ?? {}
    return {
      id:                      row.id,
      asin:                    row.asin,
      scanned_at:              row.scanned_at,
      co2_saved_kg:            row.co2_saved_kg ?? 0,
      product_title:           row.product_title ?? row.asin,
      score:                   row.score ?? 0,
      leaf_rating:             cache.leaf_rating            ?? 0,
      dimensions:              cache.dimensions             ?? { carbon: 0, packaging: 0, brand_ethics: 0, certifications: 0, durability: 0 },
      climate_pledge_friendly: cache.climate_pledge_friendly ?? false,
      explanation:             cache.explanation            ?? null,
      confidence:              cache.confidence             ?? "Low",
      data_sources:            cache.data_sources           ?? [],
      alternatives:            cache.alternatives           ?? [],
      voice_audio_url:         cache.voice_audio_url        ?? null,
      decision:                decisionMap.get(row.asin) ?? null,
    }
  })
}
