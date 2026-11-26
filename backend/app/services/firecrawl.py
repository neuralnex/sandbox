import re
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

from backend.app.core.config import settings

FIRECRAWL_SEARCH_URL = "https://api.firecrawl.dev/v2/search"
COUNTRY_CODES = {
    "nigeria": "NG", "ghana": "GH", "kenya": "KE", "south africa": "ZA",
    "united states": "US", "usa": "US", "united kingdom": "GB",
    "uk": "GB", "india": "IN", "canada": "CA", "australia": "AU",
    "brazil": "BR", "germany": "DE", "france": "FR", "japan": "JP",
    "indonesia": "ID", "mexico": "MX", "egypt": "EG", "tanzania": "TZ",
    "uganda": "UG", "rwanda": "RW", "ethiopia": "ET", "senegal": "SN",
}
CITY_LOCATIONS = {
    "lagos": "Lagos,Nigeria", "abuja": "Abuja,Nigeria", "accra": "Accra,Ghana",
    "nairobi": "Nairobi,Kenya", "johannesburg": "Johannesburg,South Africa",
    "cape town": "Cape Town,South Africa", "london": "London,United Kingdom",
    "new york": "New York,United States", "san francisco": "San Francisco,United States",
    "mumbai": "Mumbai,India", "delhi": "Delhi,India", "toronto": "Toronto,Canada",
    "sydney": "Sydney,Australia", "berlin": "Berlin,Germany", "paris": "Paris,France",
}


def _web_results(payload: dict) -> list[dict]:
    """Accept Firecrawl's web-result response while dropping malformed URLs."""
    rows = payload.get("data")
    if isinstance(rows, dict):
        rows = rows.get("web", [])
    if not isinstance(rows, list):
        rows = payload.get("web", [])
    results: list[dict] = []
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        url = row.get("url")
        parsed = urlparse(url) if isinstance(url, str) else None
        if not parsed or parsed.scheme not in {"http", "https"} or not parsed.netloc:
            continue
        results.append(row)
    return results


async def search_idea(
    idea: str, *, geography: str | None = None, limit: int = 8, focus: str | None = None
) -> list[dict[str, str | None]]:
    """Search the live web through Firecrawl and return compact cited evidence."""
    if not settings.firecrawl_api_key or not settings.firecrawl_api_key.get_secret_value():
        raise HTTPException(status_code=503, detail="Set FIRECRAWL_API_KEY to enable live research")

    query = " ".join(idea.split())[:340]
    if geography and geography.strip().lower() not in {"not sure yet", "unknown", "online", "global"}:
        query += f" launch market {geography.strip()[:120]}"
    research_focus = focus or "market size buyer demand alternatives pricing and adoption evidence"
    body: dict = {
        "query": f"{query} {research_focus}",
        "limit": min(max(limit, 1), 10),
        "sources": [{"type": "web"}],
        "scrapeOptions": {"formats": [{"type": "markdown"}]},
        "timeout": 40000,
        "safe": True,
    }
    if geography and geography.strip().lower() not in {"not sure yet", "unknown", "online", "global"}:
        normalized = geography.strip().lower()
        city = next((name for name in CITY_LOCATIONS if name in normalized), None)
        country_match = next(
            (name for name in COUNTRY_CODES if re.search(rf"\b{re.escape(name)}\b", normalized)),
            None,
        )
        if city:
            body["location"] = CITY_LOCATIONS[city]
            city_country = CITY_LOCATIONS[city].split(",")[-1].lower()
            if city_country in COUNTRY_CODES:
                body["country"] = COUNTRY_CODES[city_country]
        elif country_match:
            body["location"] = country_match.title()
        if country_match:
            body["country"] = COUNTRY_CODES[country_match]
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(45, connect=8)) as client:
            response = await client.post(
                FIRECRAWL_SEARCH_URL,
                headers={
                    "Authorization": f"Bearer {settings.firecrawl_api_key.get_secret_value()}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
            response.raise_for_status()
            payload = response.json()
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="Firecrawl research timed out") from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail="Firecrawl could not complete the research request") from exc
    except (httpx.RequestError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Firecrawl research is temporarily unavailable") from exc

    sources: list[dict[str, str | None]] = []
    seen: set[str] = set()
    for row in _web_results(payload):
        url = row["url"]
        if url in seen:
            continue
        seen.add(url)
        hostname = urlparse(url).hostname or ""
        description = row.get("description") or row.get("content")
        highlights = row.get("highlights")
        if isinstance(highlights, list):
            highlights = " ".join(str(item) for item in highlights if item)
        else:
            highlights = ""
        markdown = row.get("markdown")
        excerpt = "\n\n".join(
            part for part in (highlights, str(description or ""), str(markdown or "")) if part
        )
        sources.append(
            {
                "title": str(row.get("title") or hostname or "Web source")[:300],
                "url": url,
                "publisher": hostname.removeprefix("www.") or None,
                "published_at": str(row.get("date") or row.get("publishedDate") or "") or None,
                "excerpt": excerpt[:2500] or None,
            }
        )
    return sources
