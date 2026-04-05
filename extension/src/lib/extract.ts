import type { ProductPayload } from "./api"

export function extractProductData(): ProductPayload | null {
  try {
    // ASIN from URL
    const asinMatch = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/)
    const asin = asinMatch?.[1]
    if (!asin) return null

    // Title
    const title =
      document.getElementById("productTitle")?.textContent?.trim() ||
      document.querySelector("h1.a-size-large")?.textContent?.trim() ||
      ""
    if (!title) return null

    // Brand
    const brand =
      document.getElementById("bylineInfo")?.textContent?.trim() ||
      document.querySelector("#brand")?.textContent?.trim() ||
      document.querySelector(".po-brand .a-span9")?.textContent?.trim() ||
      "Unknown Brand"

    // Category (breadcrumb)
    const breadcrumbs = Array.from(
      document.querySelectorAll("#wayfinding-breadcrumbs_feature_div li")
    )
    const category = breadcrumbs.map((el) => el.textContent?.trim()).filter(Boolean).join(" > ") || "General"

    // Product details table
    const detailsRows = Array.from(document.querySelectorAll("#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr, .a-expander-content .a-list-item"))
    const detailsText = detailsRows.map((r) => r.textContent?.trim()).join(" ")

    // Origin
    const originMatch = detailsText.match(/country of origin[:\s]+([^\n,]+)/i)
    const origin = originMatch?.[1]?.trim()

    // Materials
    const materialMatch = detailsText.match(/material[:\s]+([^\n,]+)/i) || detailsText.match(/fabric[:\s]+([^\n,]+)/i)
    const materials = materialMatch?.[1]?.trim()

    // Product image
    const image_url =
      (document.getElementById("landingImage") as HTMLImageElement)?.src ||
      (document.querySelector("#imgTagWrapperId img") as HTMLImageElement)?.src ||
      undefined

    // Climate Pledge Friendly — check DOM for badge
    const climate_pledge_friendly = !!(
      document.querySelector('[data-feature-name="cpfBadge"]') ||
      document.querySelector(".cpf-badge") ||
      document.querySelector('[aria-label*="Climate Pledge Friendly"]') ||
      document.body.innerHTML.includes("Climate Pledge Friendly")
    )

    // Description for cert detection
    const description = [
      document.getElementById("feature-bullets")?.textContent,
      document.getElementById("productDescription")?.textContent,
      detailsText
    ]
      .filter(Boolean)
      .join(" ")
      .slice(0, 2000)

    return {
      asin,
      title,
      brand: brand.replace(/^(visit the |by |brand: )/i, "").trim(),
      category,
      materials,
      origin,
      image_url,
      climate_pledge_friendly,
      description
    }
  } catch {
    return null
  }
}

export function extractCartItems(): ProductPayload[] {
  const items: ProductPayload[] = []
  const rows = document.querySelectorAll('[data-asin]')

  rows.forEach((el) => {
    const asin = el.getAttribute("data-asin")
    if (!asin || asin.length !== 10) return

    const title =
      el.querySelector(".sc-product-title")?.textContent?.trim() ||
      el.querySelector("[class*='product-title']")?.textContent?.trim() ||
      el.querySelector("span.a-truncate-cut")?.textContent?.trim() ||
      ""

    if (!title) return

    items.push({
      asin,
      title,
      brand: "Unknown",
      category: "General",
      climate_pledge_friendly: false
    })
  })

  return items
}
