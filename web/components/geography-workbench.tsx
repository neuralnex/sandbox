"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import { api, Data360AreaValue, Data360Comparison, Data360Indicator, Data360Observation, Data360SearchResponse, jsonBody, Scenario } from "@/lib/api";

const MARKETS = [
  { code: "NGA", name: "Nigeria", center: [8, 9] },
  { code: "GHA", name: "Ghana", center: [-1.2, 7.9] },
  { code: "KEN", name: "Kenya", center: [37.9, 0.2] },
  { code: "ZAF", name: "South Africa", center: [24, -29] },
  { code: "USA", name: "United States", center: [-98, 39] },
  { code: "GBR", name: "United Kingdom", center: [-3, 55] },
  { code: "IND", name: "India", center: [79, 22] },
  { code: "BRA", name: "Brazil", center: [-52, -10] },
  { code: "IDN", name: "Indonesia", center: [118, -2] },
  { code: "EGY", name: "Egypt", center: [30, 26] },
  { code: "CAN", name: "Canada", center: [-106, 57] },
  { code: "DEU", name: "Germany", center: [10, 51] },
] as const;

type Props = {
  scenario: Scenario | null;
  baselineScenario: Scenario | null;
  engine: string;
  theme: "light" | "dark";
  baselineConfig: Record<string, number>;
  token: () => Promise<string>;
  onSaveContext: (context: Record<string, unknown>) => Promise<void>;
  onCreateScenario: (name: string, overrides: Record<string, number>, context: Record<string, unknown>) => Promise<void>;
};

type DataFeature = { type: "Feature"; properties: Record<string, unknown>; geometry: unknown };
type CountriesGeoJson = { type: "FeatureCollection"; features: DataFeature[] };

function info(indicator: Data360Indicator) {
  return indicator.series_description || {};
}

function latestValue(area: Data360AreaValue | undefined) {
  const rows = [...(area?.observations || [])].sort((a, b) => String(b.TIME_PERIOD || "").localeCompare(String(a.TIME_PERIOD || "")));
  const row = rows.find((item) => Number.isFinite(Number(item.OBS_VALUE)));
  return row ? { row, value: Number(row.OBS_VALUE) } : null;
}

function geographyOf(scenario: Scenario | null) {
  const context = scenario?.context || {};
  const geography = context.geography;
  return geography && typeof geography === "object" ? geography as Record<string, unknown> : {};
}

export function GeographyWorkbench({ scenario, baselineScenario, engine, theme, baselineConfig, token, onSaveContext, onCreateScenario }: Props) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const countriesRef = useRef<CountriesGeoJson | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [mapAttempt, setMapAttempt] = useState(0);
  const [projection, setProjection] = useState<"mercator" | "globe">("globe");
  const [targetArea, setTargetArea] = useState("NGA");
  const [referenceArea, setReferenceArea] = useState("GHA");
  const [query, setQuery] = useState("");
  const [indicators, setIndicators] = useState<Data360Indicator[]>([]);
  const [selected, setSelected] = useState<Data360Indicator | null>(null);
  const [comparison, setComparison] = useState<Data360Comparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [scenarioName, setScenarioName] = useState("Geography what-if");
  const market = MARKETS.find((item) => item.code === targetArea) || MARKETS[0];
  const areaData = comparison?.value || [];
  const areaValues = useMemo(() => Object.fromEntries(areaData.map((item) => [item.reference_area, latestValue(item)])), [areaData]);
  const targetValue = areaValues[targetArea];
  const referenceValue = areaValues[referenceArea];
  const periodsMatch = targetValue?.row.TIME_PERIOD && targetValue.row.TIME_PERIOD === referenceValue?.row.TIME_PERIOD;
  const ratio = targetValue && referenceValue && periodsMatch && referenceValue.value !== 0 ? targetValue.value / referenceValue.value : null;
  const geography = geographyOf(scenario);
  const currentFactor = geography.indicator_name ? String(geography.indicator_name) : "No geographic factor saved";
  const factorTargets = engine === "queueing"
    ? [{ key: "arrival_rate_per_hour", label: "Requests arriving per hour" }]
    : engine === "inventory"
      ? [{ key: "average_daily_demand", label: "Average daily demand" }]
      : [{ key: "demand_min", label: "Low demand per period" }, { key: "demand_mode", label: "Likely demand per period" }, { key: "demand_max", label: "High demand per period" }];
  const targetKey = factorTargets[0]?.key;
  const sourceValue = targetKey ? Number(baselineConfig[targetKey]) : NaN;
  const scaled = ratio !== null && Number.isFinite(sourceValue) ? sourceValue * ratio : null;

  useEffect(() => {
    let disposed = false;
    async function createMap() {
      if (!mapContainer.current || mapRef.current) return;
      try {
        const [maplibre, response] = await Promise.all([
          import("maplibre-gl"),
          fetch("/world-countries.geojson", { cache: "force-cache" }),
        ]);
        if (!response.ok) throw new Error("Country boundaries could not be loaded.");
        const geojson = await response.json() as CountriesGeoJson;
        if (disposed || !mapContainer.current) return;
        countriesRef.current = geojson;
        const styles = getComputedStyle(document.documentElement);
        const primary = styles.getPropertyValue("--primary").trim() || "#ff90e8";
        const secondary = styles.getPropertyValue("--secondary").trim() || "#23a094";
        const foreground = styles.getPropertyValue("--foreground").trim() || "#242423";
        const background = styles.getPropertyValue("--background").trim() || "#f4f4f0";
        const muted = styles.getPropertyValue("--muted").trim() || "#e9e9e4";
        const map = new maplibre.Map({
          container: mapContainer.current,
          attributionControl: false,
          center: market.center as [number, number],
          zoom: 1.1,
          minZoom: 0.8,
          maxZoom: 5,
          style: {
            version: 8,
            sources: { countries: { type: "geojson", data: geojson as never } },
            layers: [
              { id: "earth", type: "background", paint: { "background-color": muted } },
              { id: "country-fill", type: "fill", source: "countries", paint: {
                "fill-color": ["case", ["has", "factor_norm"], ["interpolate", ["linear"], ["get", "factor_norm"], 0, secondary, 1, primary], background],
                "fill-opacity": 0.92,
              } },
              { id: "factor-extrusion", type: "fill-extrusion", source: "countries", filter: ["has", "factor_norm"], paint: {
                "fill-extrusion-color": ["interpolate", ["linear"], ["get", "factor_norm"], 0, secondary, 1, primary],
                "fill-extrusion-height": ["*", ["get", "factor_norm"], 180000],
                "fill-extrusion-base": 0,
                "fill-extrusion-opacity": 0.78,
              } },
              { id: "country-lines", type: "line", source: "countries", paint: { "line-color": foreground, "line-opacity": 0.5, "line-width": 0.65 } },
              { id: "target-outline", type: "line", source: "countries", filter: ["==", ["get", "ISO3166-1-Alpha-3"], targetArea], paint: { "line-color": foreground, "line-width": 2.2 } },
              { id: "country-labels", type: "symbol", source: "countries", layout: { "text-field": ["get", "name"], "text-size": 10, "text-allow-overlap": false }, paint: { "text-color": foreground, "text-halo-color": background, "text-halo-width": 1.2 } },
            ],
          },
        });
        map.setProjection({ type: projection });
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new maplibre.AttributionControl({ compact: true }), "bottom-right");
        map.on("click", "country-fill", (event) => {
          const feature = event.features?.[0];
          const code = feature?.properties?.["ISO3166-1-Alpha-3"];
          if (typeof code === "string" && MARKETS.some((item) => item.code === code)) {
            setTargetArea(code);
            setSaved(false);
            map.flyTo({ center: [event.lngLat.lng, event.lngLat.lat], zoom: 3, duration: 700 });
          }
        });
        map.on("mouseenter", "country-fill", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "country-fill", () => { map.getCanvas().style.cursor = ""; });
        map.on("load", () => { if (!disposed) setMapReady(true); });
        map.on("error", () => { if (!disposed) setMapError("The geographic view hit a rendering issue. You can still review the values below."); });
        mapRef.current = map;
      } catch (cause) {
        if (!disposed) setMapError(cause instanceof Error ? cause.message : "The map could not be loaded.");
      }
    }
    void createMap();
    return () => { disposed = true; mapRef.current?.remove(); mapRef.current = null; };
  // The map is initialized once; later location changes use flyTo below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapAttempt]);

  useEffect(() => {
    const savedGeography = geographyOf(scenario);
    if (typeof savedGeography.area_code === "string" && MARKETS.some((item) => item.code === savedGeography.area_code)) setTargetArea(savedGeography.area_code);
    if (typeof savedGeography.reference_area_code === "string" && MARKETS.some((item) => item.code === savedGeography.reference_area_code)) setReferenceArea(savedGeography.reference_area_code);
  }, [scenario?.id]);

  useEffect(() => {
    mapRef.current?.setFilter("target-outline", ["==", ["get", "ISO3166-1-Alpha-3"], targetArea]);
  }, [targetArea]);

  useEffect(() => {
    mapRef.current?.setProjection({ type: projection });
  }, [projection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const styles = getComputedStyle(document.documentElement);
    const primary = styles.getPropertyValue("--primary").trim() || "#ff90e8";
    const secondary = styles.getPropertyValue("--secondary").trim() || "#23a094";
    const foreground = styles.getPropertyValue("--foreground").trim() || "#242423";
    const background = styles.getPropertyValue("--background").trim() || "#f4f4f0";
    const muted = styles.getPropertyValue("--muted").trim() || "#e9e9e4";
    map.setPaintProperty("earth", "background-color", muted);
    map.setPaintProperty("country-fill", "fill-color", ["case", ["has", "factor_norm"], ["interpolate", ["linear"], ["get", "factor_norm"], 0, secondary, 1, primary], background]);
    map.setPaintProperty("factor-extrusion", "fill-extrusion-color", ["interpolate", ["linear"], ["get", "factor_norm"], 0, secondary, 1, primary]);
    map.setPaintProperty("country-lines", "line-color", foreground);
    map.setPaintProperty("target-outline", "line-color", foreground);
    map.setPaintProperty("country-labels", "text-color", foreground);
    map.setPaintProperty("country-labels", "text-halo-color", background);
  }, [theme, mapReady]);

  useEffect(() => {
    mapRef.current?.flyTo({ center: market.center as [number, number], zoom: 2.1, duration: 900 });
  }, [market]);

  useEffect(() => {
    const map = mapRef.current;
    const countries = countriesRef.current;
    if (!map || !countries || !mapReady) return;
    const numeric = Object.values(areaValues).flatMap((entry) => entry ? [entry.value] : []);
    const min = Math.min(...numeric);
    const max = Math.max(...numeric);
    const span = max - min || 1;
    const data: CountriesGeoJson = {
      ...countries,
      features: countries.features.map((feature) => {
        const code = String(feature.properties["ISO3166-1-Alpha-3"] || "");
        const value = areaValues[code]?.value;
        return { ...feature, properties: { ...feature.properties, ...(value === undefined ? {} : { factor_norm: (value - min) / span, factor_value: value }) } };
      }),
    };
    (map.getSource("countries") as GeoJSONSource | undefined)?.setData(data as never);
  }, [areaValues, mapReady]);

  async function searchIndicators(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setIndicators([]); setSelected(null); setComparison(null);
    try {
      const result = await api<Data360SearchResponse>(`/data-sources/data360/search?q=${encodeURIComponent(query.trim())}&top=10`, token);
      setIndicators(result.value || []);
      if (!result.value?.length) setError("No matching Data360 indicators. Try a broader phrase such as population or internet access.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not search Data360."); }
    finally { setLoading(false); }
  }

  async function loadFactor(indicator: Data360Indicator) {
    const indicatorInfo = info(indicator);
    if (!indicatorInfo.idno || !indicatorInfo.database_id) { setError("This result is missing its Data360 identifiers."); return; }
    setLoading(true); setError(""); setComparison(null); setSelected(indicator); setSaved(false);
    try {
      const params = new URLSearchParams({ DATABASE_ID: indicatorInfo.database_id, INDICATOR: indicatorInfo.idno });
      for (const item of MARKETS) params.append("REF_AREA", item.code);
      const result = await api<Data360Comparison>(`/data-sources/data360/compare?${params}`, token);
      setComparison(result);
      if (!result.value.some((item) => item.observations.length)) setError("Data360 returned no values for these markets. Try another indicator.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load country comparisons."); }
    finally { setLoading(false); }
  }

  function makeContext(applied: boolean, appliedRatio?: number, overrides?: Record<string, number>) {
    const selectedInfo = selected ? info(selected) : null;
    const targetRow = targetValue?.row;
    const referenceRow = referenceValue?.row;
    return {
      ...scenario?.context,
      geography: {
        area_code: targetArea,
        area_name: market.name,
        reference_area_code: referenceArea,
        reference_area_name: MARKETS.find((item) => item.code === referenceArea)?.name,
        data_provider: "World Bank Group Data360",
        source_url: selectedInfo?.idno && selectedInfo.database_id
          ? `https://data360api.worldbank.org/data360/data?DATABASE_ID=${encodeURIComponent(selectedInfo.database_id)}&INDICATOR=${encodeURIComponent(selectedInfo.idno)}&REF_AREA=${targetArea}`
          : "https://data360.worldbank.org/en/api",
        license_note: "Data360 defaults to CC BY 4.0; verify indicator-specific terms.",
        indicator_id: selectedInfo?.idno || null,
        database_id: selectedInfo?.database_id || null,
        indicator_name: selectedInfo?.name || null,
        target_observation: targetRow ? { value: targetValue?.value, period: targetRow.TIME_PERIOD, unit: targetRow.UNIT_MEASURE } : null,
        reference_observation: referenceRow ? { value: referenceValue?.value, period: referenceRow.TIME_PERIOD, unit: referenceRow.UNIT_MEASURE } : null,
        comparison_snapshot: areaData.map((area) => {
          const observation = latestValue(area);
          return observation ? { reference_area: area.reference_area, value: observation.value, period: observation.row.TIME_PERIOD, unit: observation.row.UNIT_MEASURE } : null;
        }).filter(Boolean),
        transformation: applied ? {
          status: "user-approved scenario assumption",
          formula: "new model input = baseline model input × target area indicator ÷ reference area indicator",
          ratio: appliedRatio,
          model_parameters: overrides,
          validated_causal_relationship: false,
        } : null,
        model_use: applied ? "explicit ratio scaling assumption; not a validated causal relationship" : "context only; does not change model inputs",
        boundary_data: "Natural Earth country outlines through the datasets/geo-countries distribution; country-level boundaries only.",
      },
    };
  }

  async function saveContext() {
    setLoading(true); setError("");
    try { await onSaveContext(makeContext(false)); setSaved(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this geographic context."); }
    finally { setLoading(false); }
  }

  async function createGeographyScenario() {
    if (!baselineScenario || ratio === null || ratio <= 0 || !Number.isFinite(sourceValue) || !targetKey) return;
    const overrides = Object.fromEntries(factorTargets.map((item) => [item.key, Number((baselineConfig[item.key] * ratio).toFixed(6))]));
    setLoading(true); setError("");
    try { await onCreateScenario(scenarioName.trim() || `${market.name} factor what-if`, overrides, makeContext(true, ratio, overrides)); setSaved(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create this scenario."); }
    finally { setLoading(false); }
  }

  return <section className="overflow-hidden rounded-3xl border border-border bg-card" aria-labelledby="geography-title">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5">
      <div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Geographic scenario lab</p><h2 id="geography-title" className="mt-1 text-lg font-extrabold">Explore market factors on the globe</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Compare public indicators across launch markets. Choose whether to keep them as context or use a visible ratio as a scenario assumption.</p></div>
      <div className="flex rounded-full border border-border p-1" aria-label="Map projection">
        <button type="button" onClick={() => setProjection("mercator")} aria-pressed={projection === "mercator"} className="min-h-10 rounded-full px-3 text-xs font-bold focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-foreground aria-pressed:text-background">Flat map</button>
        <button type="button" onClick={() => setProjection("globe")} aria-pressed={projection === "globe"} className="min-h-10 rounded-full px-3 text-xs font-bold focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-foreground aria-pressed:text-background">3D globe</button>
      </div>
    </div>
    <div className="grid min-w-0 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="relative min-h-[360px] border-b border-border bg-[#d9e9e7] xl:min-h-[540px] xl:border-b-0 xl:border-r">
        <div ref={mapContainer} className="absolute inset-0" aria-label="Interactive world country map" role="region" />
        {!mapReady && !mapError && <div className="absolute inset-0 grid place-items-center"><div className="space-y-3 text-center"><div className="mx-auto size-8 animate-pulse rounded-full bg-secondary/70" /><p className="text-sm font-semibold text-foreground">Loading country boundaries…</p></div></div>}
        {mapError && <div className="absolute inset-x-4 top-4 rounded-2xl border border-border bg-card/95 p-3 text-sm" role="status"><p>{mapError}</p><button type="button" onClick={() => { setMapReady(false); setMapError(""); setMapAttempt((attempt) => attempt + 1); }} className="mt-2 min-h-10 rounded-lg border border-border px-3 text-xs font-bold focus-visible:ring-2 focus-visible:ring-ring">Retry map</button></div>}
        <div className="absolute bottom-4 left-4 max-w-[min(90%,22rem)] rounded-2xl border border-border bg-card/95 p-3 shadow-lg"><p className="text-xs font-bold uppercase tracking-wider">{selected ? info(selected).name : "Geographic context"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{comparison ? "Country fill and extrusion show the selected indicator relative to this comparison set. Heights are normalized for display, not actual terrain." : "Select and load an indicator to color markets with available observations."}</p>{comparison && <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground"><span>Lower</span><span className="h-2 flex-1 rounded-full" style={{ background: "linear-gradient(90deg, var(--secondary), var(--primary))" }} /><span>Higher</span></div>}</div>
      </div>
      <div className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-semibold">Launch market<select value={targetArea} onChange={(event) => { setTargetArea(event.target.value); setSaved(false); }} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring">{MARKETS.map((item) => <option key={item.code} value={item.code}>{item.name} · {item.code}</option>)}</select></label>
          <label className="space-y-1.5 text-sm font-semibold">Reference market<select value={referenceArea} onChange={(event) => { setReferenceArea(event.target.value); setSaved(false); }} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring">{MARKETS.map((item) => <option key={item.code} value={item.code}>{item.name} · {item.code}</option>)}</select></label>
        </div>
        <form onSubmit={(event) => void searchIndicators(event)} className="space-y-3">
          <label htmlFor="geo-factor-search" className="block text-sm font-semibold">Find a World Bank factor</label>
          <div className="flex gap-2"><input id="geo-factor-search" value={query} onChange={(event) => setQuery(event.target.value)} minLength={2} required placeholder="Population, internet access, income…" className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring" /><button type="submit" disabled={loading || query.trim().length < 2} className="min-h-11 rounded-xl bg-secondary px-4 text-sm font-bold text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">Search</button></div>
        </form>
        {indicators.length > 0 && <div className="max-h-44 space-y-2 overflow-y-auto rounded-2xl border border-border p-2" aria-label="Indicator search results">{indicators.map((indicator, index) => { const item = info(indicator); return <button type="button" key={`${item.database_id}-${item.idno}-${index}`} onClick={() => void loadFactor(indicator)} disabled={loading} className={`min-h-12 w-full rounded-xl px-3 py-2 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${selected === indicator ? "bg-accent" : "hover:bg-muted"}`}><span className="block font-semibold">{item.name || item.idno}</span><span className="mt-1 block font-mono text-[11px] text-muted-foreground">{item.database_id} · {item.idno}</span></button>; })}</div>}
        {loading && <div className="h-10 animate-pulse rounded-xl bg-muted" role="status" aria-live="polite"> <span className="sr-only">Loading geographic data…</span></div>}
        {error && <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-3 text-sm" role="alert"><p>{error}</p><button type="button" onClick={() => selected ? void loadFactor(selected) : document.getElementById("geo-factor-search")?.closest("form")?.requestSubmit()} className="mt-2 min-h-10 rounded-lg border border-border px-3 text-xs font-bold focus-visible:ring-2 focus-visible:ring-ring">Retry</button></div>}
        {comparison && <div className="space-y-3 rounded-2xl bg-muted/70 p-4">
          <div><p className="text-sm font-extrabold">{info(selected!).name}</p><p className="mt-1 text-xs text-muted-foreground">Latest available observation per country · units may vary by indicator</p></div>
          <div className="max-h-36 space-y-2 overflow-y-auto">{MARKETS.map((item) => { const itemValue = areaValues[item.code]; const allValues = Object.values(areaValues).flatMap((entry) => entry ? [entry.value] : []); const max = Math.max(...allValues, 1); return <div key={item.code} className="grid grid-cols-[1fr_auto] items-center gap-3 text-xs"><span>{item.name} <span className="font-mono text-muted-foreground">{item.code}</span></span><span className="text-right font-mono tabular-nums">{itemValue ? `${itemValue.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} · ${itemValue.row.TIME_PERIOD || "date n/a"}` : "No data"}<span className="mt-1 block h-1.5 w-24 overflow-hidden rounded-full bg-background"><span className="block h-full rounded-full bg-secondary" style={{ width: `${itemValue ? Math.max(2, itemValue.value / max * 100) : 0}%` }} /></span></span></div>; })}</div>
          <div className="rounded-xl border border-border bg-card p-3 text-xs leading-5"><p className="font-bold">Context versus model input</p><p className="mt-1 text-muted-foreground">{MARKETS.find((item) => item.code === targetArea)?.name}: {targetValue ? `${targetValue.value.toLocaleString()} (${targetValue.row.TIME_PERIOD || "period unavailable"})` : "no observation"} · Reference: {referenceValue ? `${referenceValue.value.toLocaleString()} (${referenceValue.row.TIME_PERIOD || "period unavailable"})` : "no observation"}.</p><p className="mt-1 text-muted-foreground">A ratio is only a founder-approved sensitivity assumption. Data360 does not establish that this factor causes demand to change.{targetValue && referenceValue && !periodsMatch ? " These observations are from different periods, so Sandbox will not calculate a ratio from them." : ""}</p></div>
          {ratio !== null && ratio > 0 && targetKey && <div className="space-y-3 border-t border-border pt-3">
            <div className="space-y-1.5 text-sm font-semibold"><span className="block">Model input affected</span><p className="rounded-xl border border-border bg-background px-3 py-3 text-sm">{factorTargets.length > 1 ? "Low, likely, and high demand per period" : factorTargets[0].label}</p></div>
            <p className="rounded-xl bg-accent p-3 text-xs leading-5"><strong>Proposed formula:</strong> {factorTargets.length > 1 ? "Scale the low, likely, and high demand values by the same ratio" : `${factorTargets[0].label}: ${sourceValue.toLocaleString()} × ${ratio.toFixed(3)} = ${scaled?.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}<br /><span className="text-muted-foreground">This changes only the listed model input(s); all other baseline settings carry through.</span></p>
            <label className="block space-y-1.5 text-sm font-semibold">Scenario name<input value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} maxLength={160} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring" /></label>
            <button type="button" onClick={() => void createGeographyScenario()} disabled={loading || !baselineScenario || factorTargets.some((item) => !Number.isFinite(baselineConfig[item.key]))} className="min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">{baselineScenario ? "Create & run from baseline" : "Baseline scenario unavailable"}</button>
            <p className="text-xs leading-5 text-muted-foreground">Creates a separate scenario with the original baseline retained. The reviewed ratio is an assumption, not a calibrated geographic relationship.</p>
          </div>}
          <button type="button" onClick={() => void saveContext()} disabled={loading || !scenario} className="min-h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-bold focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">{saved ? "Context saved" : "Save as context on selected scenario"}</button>
        </div>}
        {!selected && <p className="rounded-2xl border border-dashed border-border p-4 text-sm leading-6 text-muted-foreground">Search, choose, then load a factor. The map compares country-level values where Data360 has observations. No factor is applied unless you review and create a scenario with the explicit ratio shown above.</p>}
        {scenario && typeof geography.area_name === "string" && <p className="text-xs leading-5 text-muted-foreground">Saved on {scenario.name}: {geography.area_name} · {currentFactor} · {String(geography.model_use || "context only")}</p>}
        <p className="border-t border-border pt-3 text-[11px] leading-5 text-muted-foreground">Sources: World Bank Group Data360 (indicator-specific terms may apply) and Natural Earth country boundaries. Country boundaries are not city maps. 3D height is a normalized display of the selected indicator, not terrain elevation. Data snapshots and formulas are kept with the scenario and run. <a href="/geo-countries-LICENSE.txt" target="_blank" rel="noreferrer" className="underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring">Boundary data attribution</a>.</p>
      </div>
    </div>
  </section>;
}
