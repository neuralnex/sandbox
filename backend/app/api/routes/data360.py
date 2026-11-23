import asyncio

import httpx
from fastapi import APIRouter, HTTPException, Query

from backend.app.api.deps import CurrentUser

router = APIRouter(prefix="/data-sources/data360", tags=["data sources"])
DATA360_BASE_URL = "https://data360api.worldbank.org/data360"


async def _request_json(method: str, endpoint: str, **kwargs: object) -> dict:
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=5.0)) as client:
            response = await client.request(method, f"{DATA360_BASE_URL}/{endpoint}", **kwargs)
            response.raise_for_status()
            payload = response.json()
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="World Bank Data360 took too long to respond") from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail="World Bank Data360 could not complete the request") from exc
    except (httpx.RequestError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="World Bank Data360 is temporarily unavailable") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=502, detail="World Bank Data360 returned an unexpected response")
    return payload


@router.get("/search")
async def search_indicators(
    _: CurrentUser,
    q: str = Query(min_length=2, max_length=120),
    top: int = Query(default=10, ge=1, le=20),
) -> dict:
    return await _request_json(
        "POST",
        "searchv2",
        json={
            "count": True,
            "select": "series_description/idno, series_description/name, series_description/database_id",
            "search": q.strip(),
            "top": top,
        },
    )


@router.get("/data")
async def get_indicator_data(
    _: CurrentUser,
    database_id: str = Query(min_length=2, max_length=80, pattern=r"^[A-Za-z0-9_-]+$", alias="DATABASE_ID"),
    indicator: str = Query(min_length=2, max_length=120, pattern=r"^[A-Za-z0-9_.-]+$", alias="INDICATOR"),
    ref_area: str = Query(min_length=2, max_length=20, pattern=r"^[A-Za-z0-9_-]+$", alias="REF_AREA"),
    time_period_from: str | None = Query(default=None, max_length=20, alias="timePeriodFrom"),
    time_period_to: str | None = Query(default=None, max_length=20, alias="timePeriodTo"),
) -> dict:
    params: dict[str, str] = {
        "DATABASE_ID": database_id,
        "INDICATOR": indicator,
        "REF_AREA": ref_area,
    }
    if time_period_from:
        params["timePeriodFrom"] = time_period_from
    if time_period_to:
        params["timePeriodTo"] = time_period_to
    params["skip"] = "0"
    return await _request_json("GET", "data", params=params)


@router.get("/compare")
async def compare_indicator_areas(
    _: CurrentUser,
    database_id: str = Query(min_length=2, max_length=80, pattern=r"^[A-Za-z0-9_-]+$", alias="DATABASE_ID"),
    indicator: str = Query(min_length=2, max_length=120, pattern=r"^[A-Za-z0-9_.-]+$", alias="INDICATOR"),
    ref_areas: list[str] = Query(min_length=1, max_length=16, alias="REF_AREA"),
    time_period_from: str | None = Query(default="2015", max_length=20, alias="timePeriodFrom"),
    time_period_to: str | None = Query(default="2025", max_length=20, alias="timePeriodTo"),
) -> dict:
    areas = list(dict.fromkeys(area.strip().upper() for area in ref_areas))
    if any(not area or len(area) > 20 or not area.replace("_", "").isalnum() for area in areas):
        raise HTTPException(status_code=422, detail="Reference area codes may contain letters, numbers, and underscores")

    semaphore = asyncio.Semaphore(4)

    async def load_area(area: str) -> dict:
        params = {"DATABASE_ID": database_id, "INDICATOR": indicator, "REF_AREA": area, "skip": "0"}
        if time_period_from:
            params["timePeriodFrom"] = time_period_from
        if time_period_to:
            params["timePeriodTo"] = time_period_to
        async with semaphore:
            try:
                payload = await _request_json("GET", "data", params=params)
                observations = payload.get("value", [])
                return {"reference_area": area, "observations": observations if isinstance(observations, list) else []}
            except HTTPException as exc:
                return {"reference_area": area, "observations": [], "error": exc.detail}

    return {
        "database_id": database_id,
        "indicator": indicator,
        "value": await asyncio.gather(*(load_area(area) for area in areas)),
    }
