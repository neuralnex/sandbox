"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight, Database, LoaderCircle, Search } from "lucide-react";
import { api, Data360DataResponse, Data360Indicator, Data360Observation, Data360SearchResponse, Dataset, jsonBody } from "@/lib/api";

type Props = {
  environmentId: string;
  token: () => Promise<string>;
  onSaved: (dataset: Dataset) => void;
};

function indicatorInfo(indicator: Data360Indicator) {
  return indicator.series_description || {};
}

function Trend({ observations }: { observations: Data360Observation[] }) {
  const points = observations.flatMap((row) => {
    const value = Number(row.OBS_VALUE);
    return Number.isFinite(value) ? [{ year: String(row.TIME_PERIOD || ""), value }] : [];
  });
  if (points.length < 2) return <p className="text-xs text-muted-foreground">The source returned fewer than two numeric observations, so no trend line is shown.</p>;
  const min = Math.min(...points.map((point) => point.value));
  const max = Math.max(...points.map((point) => point.value));
  const span = max - min || 1;
  const coords = points.map((point, index) => `${12 + (index / (points.length - 1)) * 276},${88 - ((point.value - min) / span) * 72}`).join(" ");
  return <div className="border border-border bg-card p-3">
    <svg viewBox="0 0 300 104" className="h-28 w-full" role="img" aria-label={`Trend from ${points[0].year} to ${points.at(-1)?.year}`}>
      <line x1="12" y1="88" x2="288" y2="88" stroke="currentColor" strokeOpacity=".22" />
      <polyline points={coords} fill="none" stroke="var(--secondary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, index) => <circle key={`${point.year}-${index}`} cx={12 + (index / (points.length - 1)) * 276} cy={88 - ((point.value - min) / span) * 72} r="2.5" fill="var(--secondary)" />)}
    </svg>
    <div className="flex justify-between text-xs text-muted-foreground"><span>{points[0].year}</span><span>{points.at(-1)?.year}</span></div>
  </div>;
}

export function Data360Explorer({ environmentId, token, onSaved }: Props) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("NGA");
  const [from, setFrom] = useState("2015");
  const [to, setTo] = useState("2025");
  const [results, setResults] = useState<Data360Indicator[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<{ indicator: Data360Indicator; rows: Data360Observation[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setSelected(null); setSearched(true);
    try {
      const response = await api<Data360SearchResponse>(`/data-sources/data360/search?q=${encodeURIComponent(query.trim())}&top=10`, token);
      setResults(response.value || []);
    } catch (cause) { setResults([]); setError(cause instanceof Error ? cause.message : "Could not search Data360."); }
    finally { setLoading(false); }
  }

  async function load(indicator: Data360Indicator) {
    const info = indicatorInfo(indicator);
    if (!info.idno || !info.database_id) { setError("This result is missing the indicator identifiers needed to load its data."); return; }
    setLoading(true); setError(""); setSelected(null);
    try {
      const params = new URLSearchParams({ DATABASE_ID: info.database_id, INDICATOR: info.idno, REF_AREA: area.trim().toUpperCase() });
      if (from.trim()) params.set("timePeriodFrom", from.trim());
      if (to.trim()) params.set("timePeriodTo", to.trim());
      const response = await api<Data360DataResponse>(`/data-sources/data360/data?${params}`, token);
      const rows = [...(response.value || [])].sort((a, b) => String(a.TIME_PERIOD || "").localeCompare(String(b.TIME_PERIOD || "")));
      if (!rows.length) { setError("No observations found. Check the area code and date range."); return; }
      setSelected({ indicator, rows });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load this series."); }
    finally { setLoading(false); }
  }

  async function save() {
    if (!selected) return;
    const info = indicatorInfo(selected.indicator);
    if (!info.idno || !info.database_id) return;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ DATABASE_ID: info.database_id, INDICATOR: info.idno, REF_AREA: area.trim().toUpperCase() });
      if (from.trim()) params.set("timePeriodFrom", from.trim());
      if (to.trim()) params.set("timePeriodTo", to.trim());
      const saved = await api<Dataset>(`/environments/${environmentId}/datasets`, token, jsonBody({
        name: info.name || info.idno,
        source_url: `https://data360api.worldbank.org/data360/data?${params.toString()}`,
        license: "CC BY 4.0; verify indicator-specific terms",
        observed_at: new Date().toISOString(),
        metadata: {
          provider: "World Bank Group Data360", database_id: info.database_id,
          indicator_id: info.idno, indicator_name: info.name || info.idno,
          reference_area: area.trim().toUpperCase(), period_from: from.trim() || null,
          period_to: to.trim() || null, attribution: "World Bank Group Data360",
          licensing_note: "Data360 defaults to CC BY 4.0, but some third-party indicators have separate terms. Verify the indicator terms before redistribution.",
          use_note: "Context series only; it did not calibrate or modify simulation parameters.",
          observations: selected.rows,
        },
      }));
      onSaved(saved);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this source."); }
    finally { setLoading(false); }
  }

  return <section className="mt-5 border border-border bg-background" aria-labelledby="data360-heading">
    <div className="flex items-start gap-3 border-b border-border p-4">
      <span className="grid size-10 shrink-0 place-items-center border border-border bg-secondary text-secondary-foreground"><Database size={17} aria-hidden="true" /></span>
      <div className="min-w-0"><h3 id="data360-heading" className="font-extrabold">World Bank Data360</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Search public indicators, preview a time series, and keep its source with this environment.</p></div>
      <a className="ml-auto grid size-10 shrink-0 place-items-center text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" href="https://data360.worldbank.org/en/api" target="_blank" rel="noreferrer" aria-label="Open Data360 API documentation"><ArrowUpRight size={16} aria-hidden="true" /></a>
    </div>
    <form onSubmit={search} className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2 xl:col-span-4"><label htmlFor="data360-query" className="text-sm font-semibold">Find an indicator</label><div className="flex gap-2"><input id="data360-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} required minLength={2} maxLength={120} placeholder="e.g. population, food prices, electricity access" className="h-11 min-w-0 flex-1 border border-border bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring" /><button type="submit" disabled={loading || query.trim().length < 2} aria-busy={loading} className="flex min-h-11 min-w-24 items-center justify-center gap-2 border border-foreground bg-primary px-3 text-sm font-extrabold text-primary-foreground disabled:opacity-50">{loading ? <LoaderCircle size={16} className="motion-safe:animate-spin" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}<span>Search</span></button></div></div>
      <div className="space-y-1.5"><label htmlFor="data360-area" className="text-sm font-semibold">Reference area</label><input id="data360-area" value={area} onChange={(event) => setArea(event.target.value)} required maxLength={20} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="NGA" className="h-11 w-full border border-border bg-card px-3 text-sm uppercase focus-visible:ring-2 focus-visible:ring-ring" /><p className="text-xs text-muted-foreground">Use a Data360 area code, such as NGA.</p></div>
      <div className="space-y-1.5"><label htmlFor="data360-from" className="text-sm font-semibold">From year</label><input id="data360-from" type="text" inputMode="numeric" pattern="[0-9]{4}" value={from} onChange={(event) => setFrom(event.target.value)} className="h-11 w-full border border-border bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring" /></div>
      <div className="space-y-1.5"><label htmlFor="data360-to" className="text-sm font-semibold">To year</label><input id="data360-to" type="text" inputMode="numeric" pattern="[0-9]{4}" value={to} onChange={(event) => setTo(event.target.value)} className="h-11 w-full border border-border bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring" /></div>
      {error && <p role="alert" className="border border-destructive bg-destructive/5 p-3 text-sm sm:col-span-2 xl:col-span-4">{error}</p>}
      {results.length > 0 && <div className="space-y-2 sm:col-span-2 xl:col-span-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Choose a result</p><div className="grid gap-2 md:grid-cols-2">{results.map((item, index) => { const info = indicatorInfo(item); return <button key={`${info.database_id}-${info.idno}-${index}`} type="button" disabled={loading} onClick={() => void load(item)} className="min-h-16 border border-border bg-card p-3 text-left transition-colors duration-100 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"><span className="block text-sm font-bold">{info.name || "Untitled indicator"}</span><span className="mt-1 block break-all font-mono text-xs text-muted-foreground">{info.database_id} · {info.idno}</span></button>; })}</div></div>}
      {selected && <div className="space-y-3 border-t border-border pt-4 sm:col-span-2 xl:col-span-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-extrabold">{indicatorInfo(selected.indicator).name}</p><p className="mt-1 text-xs text-muted-foreground">{area.toUpperCase()} · {selected.rows.length} observations · {from}–{to}</p></div><button type="button" disabled={loading} onClick={() => void save()} className="min-h-11 border border-foreground bg-secondary px-4 text-sm font-bold text-secondary-foreground hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">{loading ? "Saving…" : "Save context series"}</button></div><Trend observations={selected.rows} /><div className="overflow-x-auto border border-border"><table className="w-full min-w-72 text-left text-xs"><thead className="bg-muted"><tr><th className="px-3 py-2 font-bold">Period</th><th className="px-3 py-2 font-bold">Observation</th><th className="px-3 py-2 font-bold">Unit</th></tr></thead><tbody className="divide-y divide-border">{selected.rows.slice(-5).reverse().map((row, index) => <tr key={`${row.TIME_PERIOD}-${index}`}><td className="px-3 py-2 font-mono">{row.TIME_PERIOD || "—"}</td><td className="px-3 py-2 font-mono tabular-nums">{row.OBS_VALUE ?? "—"}</td><td className="px-3 py-2">{row.UNIT_MEASURE || "—"}</td></tr>)}</tbody></table></div><p className="text-xs leading-5 text-muted-foreground">World Bank Group Data360 · CC BY 4.0 unless an indicator specifies different terms. Attribution is retained with this source. This series provides context only; Sandbox does not apply it to simulation inputs.</p></div>}
      {!error && !results.length && <p className="text-xs leading-5 text-muted-foreground sm:col-span-2 xl:col-span-4">{searched ? "No indicators found. Try another keyword." : "Search returns up to 10 indicators. No records are added until you preview and save one."}</p>}
    </form>
  </section>;
}
