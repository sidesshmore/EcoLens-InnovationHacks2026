/**
 * amazon-search.tsx — EcoLens content script for Amazon search results pages.
 *
 * Injects colored eco-score badges next to product cards on /s? pages.
 * Uses cached scores where available (instant). Uncached products get a subtle
 * "Eco score loading…" indicator that resolves asynchronously.
 */

import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useRef } from "react"

export const config: PlasmoCSConfig = {
  matches: [
    "https://*.amazon.com/s*",
    "https://*.amazon.com/s?*",
  ],
  all_frames: false,
}

// ── Types ────────────────────────────────────────────────────────────────────

interface CachedScore {
  score: number
  leaf_rating: number
  climate_pledge_friendly: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): { bg: string; text: string; border: string } {
  if (score >= 75) return { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" }
  if (score >= 50) return { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" }
  return { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" }
}

function leafEmoji(rating: number): string {
  return "🍃".repeat(Math.max(1, Math.min(5, rating)))
}

function injectBadge(container: Element, score: number, leafRating: number, cpf: boolean) {
  if (container.querySelector("[data-ecolens-badge]")) return

  const colors = scoreColor(score)
  const badge = document.createElement("div")
  badge.setAttribute("data-ecolens-badge", "true")
  badge.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 20px;
    background: ${colors.bg};
    border: 1px solid ${colors.border};
    font-size: 11px;
    font-weight: 700;
    color: ${colors.text};
    font-family: -apple-system, 'Segoe UI', system-ui, sans-serif;
    cursor: default;
    user-select: none;
    margin-top: 4px;
    white-space: nowrap;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  `
  badge.title = `EcoLens score: ${score}/100${cpf ? " · Amazon Climate Pledge Friendly" : ""}`
  badge.innerHTML = `
    <span style="font-size:12px">${leafEmoji(leafRating)}</span>
    <span>${score}</span>
    ${cpf ? `<span title="Climate Pledge Friendly" style="font-size:10px">🏅</span>` : ""}
  `
  container.appendChild(badge)
}

function injectPending(container: Element, asin: string) {
  if (container.querySelector("[data-ecolens-badge]")) return

  const badge = document.createElement("div")
  badge.setAttribute("data-ecolens-badge", "true")
  badge.setAttribute("data-ecolens-asin", asin)
  badge.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 20px;
    background: #F9FAFB;
    border: 1px dashed #D1D5DB;
    font-size: 10px;
    font-weight: 500;
    color: #9CA3AF;
    font-family: -apple-system, 'Segoe UI', system-ui, sans-serif;
    cursor: default;
    user-select: none;
    margin-top: 4px;
    white-space: nowrap;
  `
  badge.innerHTML = `<span style="font-size:11px">🍃</span><span>Scoring…</span>`
  container.appendChild(badge)
}

function updateBadge(asin: string, score: number, leafRating: number, cpf: boolean) {
  const badges = document.querySelectorAll<HTMLElement>(`[data-ecolens-asin="${asin}"]`)
  const colors = scoreColor(score)
  badges.forEach(badge => {
    badge.removeAttribute("data-ecolens-asin")
    badge.style.background = colors.bg
    badge.style.border = `1px solid ${colors.border}`
    badge.style.color = colors.text
    badge.style.fontSize = "11px"
    badge.style.fontWeight = "700"
    badge.style.borderStyle = "solid"
    badge.innerHTML = `
      <span style="font-size:12px">${leafEmoji(leafRating)}</span>
      <span>${score}</span>
      ${cpf ? `<span title="Climate Pledge Friendly" style="font-size:10px">🏅</span>` : ""}
    `
  })
}

// ── Main logic ───────────────────────────────────────────────────────────────

const API_URL = process.env.PLASMO_PUBLIC_API_URL || "http://localhost:8000"

// In-memory cache for this page session
const sessionCache = new Map<string, CachedScore>()
// ASINs currently being fetched (avoid duplicate requests)
const inflight = new Set<string>()

async function fetchScore(asin: string, title: string, token?: string): Promise<CachedScore | null> {
  if (inflight.has(asin)) return null
  inflight.add(asin)
  try {
    const res = await fetch(`${API_URL}/api/score`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ asin, title, brand: "", category: "", climate_pledge_friendly: false }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const cached: CachedScore = {
      score: data.score,
      leaf_rating: data.leaf_rating,
      climate_pledge_friendly: data.climate_pledge_friendly,
    }
    sessionCache.set(asin, cached)
    return cached
  } catch {
    return null
  } finally {
    inflight.delete(asin)
  }
}

/**
 * Find all product cards in the search results and inject badges.
 * Only fetches scores for the first BATCH_SIZE uncached products to avoid
 * hammering the API.
 */
const BATCH_SIZE = 8

async function scanSearchResults() {
  const token: string | undefined = await chrome.storage.local
    .get("auth_token")
    .then(r => r.auth_token)

  // Amazon search result cards — each has [data-asin] attribute
  const cards = document.querySelectorAll<HTMLElement>(
    '[data-component-type="s-search-result"][data-asin]'
  )

  let fetchCount = 0

  for (const card of Array.from(cards)) {
    const asin = card.getAttribute("data-asin")
    if (!asin) continue

    // Find a good container for the badge: the price/rating row or title row
    const ratingRow = card.querySelector(".a-row.a-size-small")
    const priceRow = card.querySelector(".a-price")?.closest(".a-row")
    const badgeTarget = ratingRow || priceRow?.parentElement || card.querySelector("h2")?.closest(".a-row")
    if (!badgeTarget) continue

    if (sessionCache.has(asin)) {
      const s = sessionCache.get(asin)!
      injectBadge(badgeTarget, s.score, s.leaf_rating, s.climate_pledge_friendly)
      continue
    }

    if (fetchCount < BATCH_SIZE && !inflight.has(asin)) {
      fetchCount++
      const titleEl = card.querySelector("h2 span")
      const title = titleEl?.textContent?.trim() ?? asin

      // Show pending indicator immediately
      injectPending(badgeTarget, asin)

      // Fetch asynchronously
      fetchScore(asin, title, token).then(result => {
        if (result) updateBadge(asin, result.score, result.leaf_rating, result.climate_pledge_friendly)
        else {
          // Remove the pending badge if fetch failed
          badgeTarget.querySelector(`[data-ecolens-asin="${asin}"]`)?.remove()
        }
      })
    }
  }
}

// ── React root component (Plasmo requires a default export) ──────────────────

function AmazonSearchBadges() {
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Initial scan
    scanSearchResults()

    // Re-scan on DOM changes (pagination, infinite scroll, filters)
    const observer = new MutationObserver(() => {
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
      scanTimerRef.current = setTimeout(scanSearchResults, 600)
    })
    observer.observe(document.querySelector("#search") || document.body, {
      childList: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
    }
  }, [])

  // This component renders nothing into the shadow DOM —
  // all badge DOM manipulation happens directly on the Amazon page.
  return null
}

export default AmazonSearchBadges
