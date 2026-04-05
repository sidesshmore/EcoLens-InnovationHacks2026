// Background service worker — handles auth token storage and message passing

const API_URL = process.env.PLASMO_PUBLIC_API_URL || "http://localhost:8000"

// ── Weekly eco report alarm ──────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("weekly-eco-report", { periodInMinutes: 7 * 24 * 60 })
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "weekly-eco-report") return

  const stored = await chrome.storage.local.get([
    "weekly_scan_count", "weekly_co2_avoided", "weekly_co2_spent",
    "last_week_avg_score", "weekly_scores"
  ])

  const scanCount   = stored.weekly_scan_count  ?? 0
  const co2Avoided  = stored.weekly_co2_avoided ?? 0
  const co2Spent    = stored.weekly_co2_spent   ?? 0
  const scores: number[] = stored.weekly_scores ?? []
  const avgScore    = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
  const lastAvg     = stored.last_week_avg_score ?? 0
  const trend       = avgScore > lastAvg ? "↑" : avgScore < lastAvg ? "↓" : "→"

  if (scanCount === 0) return // nothing to report

  chrome.notifications.create("weekly-report", {
    type: "basic",
    iconUrl: "assets/icon.png",
    title: `🌿 Your weekly eco report`,
    message: `Scanned ${scanCount} products · Avg score ${avgScore}/100 ${trend} · Avoided ${co2Avoided.toFixed(1)} kg CO₂`,
  })

  // Archive week data and reset counters
  await chrome.storage.local.set({
    last_week_avg_score: avgScore,
    last_week_scan_count: scanCount,
    weekly_scan_count: 0,
    weekly_co2_avoided: 0,
    weekly_co2_spent: 0,
    weekly_scores: [],
  })
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Proxy API calls through background to avoid mixed-content blocks on HTTPS pages
  if (message.type === "SCORE_PRODUCT") {
    const { payload, token } = message
    fetch(`${API_URL}/api/score`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    })
      .then(async (r) => {
        const text = await r.text()
        let data: unknown
        try { data = JSON.parse(text) } catch { data = null }

        if (r.ok && data !== null) {
          // Respond immediately — never block on storage writes
          sendResponse({ ok: true, data })
          // If we had a token and it worked, keep it. Nothing to do here.
          // Fire-and-forget: accumulate weekly stats + carbon budget
          const score: number = (data as { score?: number }).score ?? 0
          const co2Footprint = parseFloat((2 + (100 - score) * 0.12).toFixed(2))
          chrome.storage.local.get(
            ["co2_spent_kg", "weekly_scan_count", "weekly_co2_spent", "weekly_scores"]
          ).then(stored => {
            const weeklyScores: number[] = stored.weekly_scores ?? []
            weeklyScores.push(score)
            chrome.storage.local.set({
              last_score: score,
              co2_spent_kg: ((stored.co2_spent_kg ?? 0) + co2Footprint),
              weekly_scan_count: (stored.weekly_scan_count ?? 0) + 1,
              weekly_co2_spent: (stored.weekly_co2_spent ?? 0) + co2Footprint,
              weekly_scores: weeklyScores.slice(-100),
            })
          }).catch(() => {})
        } else {
          // Backend returned an error — send a proper JSON error message
          const errDetail = data !== null
            ? `API ${r.status}: ${JSON.stringify((data as { detail?: string }).detail ?? data)}`
            : `API ${r.status}: ${text.slice(0, 200)}`

          // Auto-clear a stale/expired token so the next request goes as guest
          if (r.status === 401 && token) {
            chrome.storage.local.remove("auth_token").catch(() => {})
          }

          sendResponse({ ok: false, error: errDetail })
        }
      })
      .catch((err) => sendResponse({ ok: false, error: String(err?.message ?? err) }))
    return true
  }
  if (message.type === "GET_TOKEN") {
    chrome.storage.local.get("auth_token").then((result) => {
      sendResponse({ token: result.auth_token || null })
    })
    return true // keep channel open for async response
  }

  if (message.type === "SET_TOKEN") {
    chrome.storage.local.set({ auth_token: message.token }).then(() => {
      sendResponse({ ok: true })
    })
    return true
  }

  if (message.type === "CLEAR_TOKEN") {
    chrome.storage.local.remove("auth_token").then(() => {
      sendResponse({ ok: true })
    })
    return true
  }

  if (message.type === "RECORD_DECISION") {
    const { payload, token } = message
    // Accumulate CO₂ avoided locally for carbon budget + weekly report
    if (payload.decision === "skip" && payload.co2_kg > 0) {
      chrome.storage.local.get(["co2_avoided_kg", "weekly_co2_avoided"]).then(stored => {
        chrome.storage.local.set({
          co2_avoided_kg: (stored.co2_avoided_kg ?? 0) + payload.co2_kg,
          weekly_co2_avoided: (stored.weekly_co2_avoided ?? 0) + payload.co2_kg,
        })
      })
    }
    fetch(`${API_URL}/api/decision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }))
    return true
  }
})
