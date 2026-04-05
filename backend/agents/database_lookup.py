import httpx
from agents.product_parser import ParsedProduct


class DatabaseLookupResult:
    def __init__(self):
        self.matched = False
        self.brand_ethics_score: float | None = None
        self.certifications_score: float | None = None
        self.data_sources: list[str] = []


async def lookup(product: ParsedProduct) -> DatabaseLookupResult:
    result = DatabaseLookupResult()

    async with httpx.AsyncClient(timeout=5) as client:
        # Open Food Facts — food/beverage category
        if product.category == "food":
            await _query_open_food_facts(client, product, result)

        # GoodOnYou — fashion/apparel
        if product.category == "apparel":
            await _query_goodonyou(client, product, result)

    return result


async def _query_open_food_facts(
    client: httpx.AsyncClient, product: ParsedProduct, result: DatabaseLookupResult
) -> None:
    try:
        resp = await client.get(
            "https://world.openfoodfacts.org/cgi/search.pl",
            params={
                "search_terms": product.brand,
                "search_simple": 1,
                "action": "process",
                "json": 1,
                "page_size": 1,
            },
        )
        data = resp.json()
        products = data.get("products", [])
        if products:
            p = products[0]
            ecoscore = p.get("ecoscore_score")
            if ecoscore is not None:
                result.matched = True
                result.certifications_score = float(ecoscore)
                result.data_sources.append("Open Food Facts")
    except Exception:
        pass  # fail gracefully


async def _query_goodonyou(
    client: httpx.AsyncClient, product: ParsedProduct, result: DatabaseLookupResult
) -> None:
    # GoodOnYou doesn't have a public API; query their search page
    try:
        resp = await client.get(
            "https://goodonyou.eco/api/brands/search/",
            params={"q": product.brand},
            headers={"Accept": "application/json"},
        )
        if resp.status_code == 200:
            data = resp.json()
            brands = data.get("results", [])
            if brands:
                rating = brands[0].get("rating")  # 1–5 scale
                if rating:
                    result.matched = True
                    result.brand_ethics_score = (rating / 5) * 100
                    result.data_sources.append("Good On You")
    except Exception:
        pass  # fail gracefully
