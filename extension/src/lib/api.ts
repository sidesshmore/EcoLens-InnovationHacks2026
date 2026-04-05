const API_URL = process.env.PLASMO_PUBLIC_API_URL || "http://localhost:8000"

export interface Dimensions {
  carbon: number
  packaging: number
  brand_ethics: number
  certifications: number
  durability: number
}

export interface Alternative {
  asin: string
  title: string
  score: number
  price_delta: number | null
  reason: string
  image_url: string | null
}

export interface ScoreResponse {
  asin: string
  score: number
  leaf_rating: number
  dimensions: Dimensions
  climate_pledge_friendly: boolean
  explanation: string
  confidence: "High" | "Medium" | "Low"
  data_sources: string[]
  alternatives: Alternative[]
  voice_audio_url: string | null
  cached: boolean
}

export interface CartScoreResponse {
  total_co2_kg: number
  aggregate_score: number
  item_scores: ScoreResponse[]
  worst_offender_asin: string
  swap_suggestions: Alternative[]
}

export interface ProductPayload {
  asin: string
  title: string
  brand: string
  category: string
  materials?: string
  origin?: string
  image_url?: string
  climate_pledge_friendly: boolean
  description?: string
}

export async function scoreProduct(
  payload: ProductPayload,
  token?: string
): Promise<ScoreResponse> {
  const res = await fetch(`${API_URL}/api/score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(`Score API error: ${res.status}`)
  return res.json()
}

export async function scoreCart(
  items: ProductPayload[],
  token?: string
): Promise<CartScoreResponse> {
  const res = await fetch(`${API_URL}/api/score/cart`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ items })
  })
  if (!res.ok) throw new Error(`Cart API error: ${res.status}`)
  return res.json()
}

export async function getVoiceUrl(asin: string, token?: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/voice/${asin}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  if (!res.ok) throw new Error("Voice unavailable")
  const data = await res.json()
  return data.audio_url
}
