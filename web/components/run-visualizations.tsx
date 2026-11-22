type Datum = Record<string, unknown>;

function number(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function money(value: unknown) {
  return typeof value === "number" ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value) : "—";
}

function TrendChart({ series, fields }: { series: Datum[]; fields: { key: string; label: string; color: string }[] }) {
  const rows = series.slice(0, 60);
  if (!rows.length) return <p className="p-5 text-sm text-muted-foreground">No time-series data was returned for this run.</p>;
  const values = fields.flatMap((field) => rows.map((row) => number(row[field.key])));
  const max = Math.max(1, ...values);
  const points = (key: string) => rows.map((row, index) => `${30 + index * (540 / Math.max(rows.length - 1, 1))},${160 - number(row[key]) / max * 135}`).join(" ");
  return <div className="p-4">
    <div className="mb-3 flex flex-wrap gap-4">{fields.map((field) => <span key={field.key} className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2 rounded-full" style={{ background: field.color }} />{field.label}</span>)}</div>
    <svg viewBox="0 0 600 190" role="img" aria-label="Model output trend chart" className="h-48 w-full overflow-visible">
      {[25, 65, 105, 145].map((y) => <line key={y} x1="30" x2="570" y1={y} y2={y} stroke="currentColor" opacity=".12" />)}
      {fields.map((field) => <polyline key={field.key} points={points(field.key)} fill="none" stroke={field.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />)}
      <text x="30" y="182" fill="currentColor" opacity=".55" fontSize="10">Period 1</text><text x="570" y="182" textAnchor="end" fill="currentColor" opacity=".55" fontSize="10">Period {rows.length}</text>
    </svg>
  </div>;
}

function SystemFlow({ engine, metrics }: { engine: string; metrics: Datum }) {
  const queue = engine === "queueing";
  const labels = queue ? ["Arrivals", "Waiting", "Servers", "Completed"] : ["Demand", "Inventory", "Fulfilled", "Unmet"];
  const values = queue
    ? [metrics.customers_arrived, metrics.customers_unfinished_at_horizon, "Parallel", metrics.customers_served]
    : [metrics.total_demand, metrics.ending_inventory, metrics.units_fulfilled, metrics.units_stocked_out];
  return <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4" aria-label="Conceptual model flow">
    {labels.map((label, index) => <div key={label} className="relative border border-border bg-background p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-2 font-mono text-lg font-bold">{typeof values[index] === "number" ? Number(values[index]).toLocaleString() : String(values[index] ?? "—")}</p>
      {index < labels.length - 1 && <span className="absolute -right-2 top-1/2 z-10 hidden size-4 -translate-y-1/2 place-items-center bg-card text-muted-foreground sm:grid" aria-hidden="true">›</span>}
    </div>)}
  </div>;
}

function MonteCarloChart({ histogram }: { histogram: Datum[] }) {
  const rows = histogram.slice(0, 20);
  const max = Math.max(1, ...rows.map((row) => number(row.count)));
  return <div className="flex h-48 items-end gap-1 border-b border-border px-3 pb-1 pt-5" role="img" aria-label="Monte Carlo profit outcome distribution">
    {rows.map((row, index) => <div key={index} className="group relative flex h-full flex-1 items-end" title={`${row.low} to ${row.high}: ${row.count} runs`}><div className="w-full bg-secondary" style={{ height: `${Math.max(2, number(row.count) / max * 100)}%` }} /></div>)}
  </div>;
}

export function RunVisualizations({ engine, metrics: source }: { engine: string; metrics: Record<string, unknown> }) {
  const metrics = source as Datum;
  const series = Array.isArray(metrics.series) ? metrics.series as Datum[] : [];
  const histogram = Array.isArray(metrics.histogram) ? metrics.histogram as Datum[] : [];
  let summary = "The run completed using the saved configuration. Review the chart and assumptions before applying the result.";
  if (engine === "queueing") {
    const wait = number(metrics.mean_wait_minutes);
    const utilization = number(metrics.server_utilization) * 100;
    summary = `${number(metrics.customers_served).toLocaleString()} of ${number(metrics.customers_arrived).toLocaleString()} arrivals completed during the modeled window. Average wait was ${wait.toFixed(1)} minutes and server utilization was ${utilization.toFixed(1)}%.`;
  } else if (engine === "inventory") {
    summary = `${(number(metrics.fill_rate) * 100).toFixed(1)}% of demand was fulfilled. ${number(metrics.units_stocked_out).toLocaleString()} units were unavailable; the modeled net operating result was ${money(metrics.net_operating_result)} in the entered value units.`;
  } else if (engine === "monte_carlo") {
    summary = `${(number(metrics.probability_positive_profit) * 100).toFixed(1)}% of configured trials ended above zero. Median modeled profit was ${money(metrics.median_profit)}, with a 10th–90th percentile range of ${money(metrics.p10_profit)} to ${money(metrics.p90_profit)} in the entered value units.`;
  }
  return <section className="border border-border bg-card" aria-label="Run visualization and summary">
    <div className="border-b border-border p-4"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Model visualization</p><h3 className="mt-1 font-extrabold">{engine === "monte_carlo" ? "Outcome distribution" : "System flow & trend"}</h3></div>
    {engine === "monte_carlo" ? <MonteCarloChart histogram={histogram} /> : <><SystemFlow engine={engine} metrics={metrics} /><TrendChart series={series} fields={engine === "inventory" ? [{ key: "demand", label: "Demand", color: "#7c3aed" }, { key: "fulfilled", label: "Fulfilled", color: "#0f766e" }, { key: "inventory", label: "Inventory", color: "#ea580c" }] : [{ key: "arrivals", label: "Arrivals", color: "#7c3aed" }, { key: "completed", label: "Completed", color: "#0f766e" }]} /></>}
    {engine === "monte_carlo" && <div className="grid grid-cols-3 gap-2 px-4 pb-4 text-center"><div className="border border-border p-2"><p className="text-[10px] uppercase text-muted-foreground">P10</p><p className="font-mono text-sm font-bold">{money(metrics.p10_profit)}</p></div><div className="border border-border p-2"><p className="text-[10px] uppercase text-muted-foreground">Median</p><p className="font-mono text-sm font-bold">{money(metrics.median_profit)}</p></div><div className="border border-border p-2"><p className="text-[10px] uppercase text-muted-foreground">P90</p><p className="font-mono text-sm font-bold">{money(metrics.p90_profit)}</p></div></div>}
    <div className="border-t border-border bg-accent/40 p-4"><p className="text-xs font-bold uppercase tracking-widest">Run summary</p><p className="mt-2 text-sm leading-6">{summary}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Illustrative model output based on the saved assumptions. The 2D flow is conceptual; it is not a geographic map, calibrated digital twin, or forecast.</p></div>
  </section>;
}
