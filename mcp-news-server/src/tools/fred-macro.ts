import { getFredObservations, type FredObservation } from "../sources/fred.js";

export type FredMacroCategory =
  | "Liquidity"
  | "Rates & Credit"
  | "Growth & Inflation"
  | "Markets & Financial Conditions";

export type FredFrequency = "daily" | "weekly" | "monthly" | "quarterly";

export interface FredSeriesDefinition {
  seriesId: string;
  label: string;
  category: FredMacroCategory;
  unit: string;
  scale?: number;
  frequency: FredFrequency;
}

export type RateOfChange = "accelerating" | "decelerating" | "stable";

export interface FredSeriesSummary {
  seriesId: string;
  label: string;
  category: FredMacroCategory;
  unit: string;
  latest: { date: string; value: number } | null;
  previous: { date: string; value: number } | null;
  change: number | null;
  percentChange: number | null;
  change3m: number | null;
  pct3m: number | null;
  change1y: number | null;
  yoyPct: number | null;
  rateOfChange: RateOfChange | null;
}

// Fetch enough history per frequency to cover ~14 months, so 3M/6M/12M
// date-based lookups (and the 3M-vs-6M second derivative) always resolve.
const FREQUENCY_FETCH_LIMIT: Record<FredFrequency, number> = {
  daily: 300,
  weekly: 60,
  monthly: 15,
  quarterly: 6,
};

const FRED_SERIES: FredSeriesDefinition[] = [
  { seriesId: "WALCL", label: "Fed Balance Sheet", category: "Liquidity", unit: "$T", scale: 1_000_000, frequency: "weekly" },
  { seriesId: "M2SL", label: "M2 Money Supply", category: "Liquidity", unit: "$T", scale: 1_000, frequency: "monthly" },
  { seriesId: "TOTRESNS", label: "Bank Reserves", category: "Liquidity", unit: "$T", scale: 1_000, frequency: "monthly" },
  { seriesId: "RRPONTSYD", label: "Reverse Repo Facility", category: "Liquidity", unit: "$B", frequency: "daily" },
  { seriesId: "DGS2", label: "2Y Treasury Yield", category: "Rates & Credit", unit: "%", frequency: "daily" },
  { seriesId: "DGS10", label: "10Y Treasury Yield", category: "Rates & Credit", unit: "%", frequency: "daily" },
  { seriesId: "DGS30", label: "30Y Treasury Yield", category: "Rates & Credit", unit: "%", frequency: "daily" },
  { seriesId: "T10Y2Y", label: "10Y-2Y Treasury Spread", category: "Rates & Credit", unit: "%", frequency: "daily" },
  { seriesId: "T5YIE", label: "5Y Breakeven Inflation", category: "Rates & Credit", unit: "%", frequency: "daily" },
  { seriesId: "BAMLH0A0HYM2", label: "High Yield OAS", category: "Rates & Credit", unit: "%", frequency: "daily" },
  { seriesId: "A191RL1Q225SBEA", label: "Real GDP Growth (QoQ SAAR)", category: "Growth & Inflation", unit: "%", frequency: "quarterly" },
  { seriesId: "PAYEMS", label: "Total Nonfarm Payroll Employment", category: "Growth & Inflation", unit: "k", frequency: "monthly" },
  { seriesId: "CPILFESL", label: "Core CPI Price Index", category: "Growth & Inflation", unit: "index", frequency: "monthly" },
  { seriesId: "PCEPILFE", label: "Core PCE Price Index", category: "Growth & Inflation", unit: "index", frequency: "monthly" },
  { seriesId: "DTWEXBGS", label: "Broad USD Index", category: "Markets & Financial Conditions", unit: "index", frequency: "daily" },
  { seriesId: "VIXCLS", label: "VIX", category: "Markets & Financial Conditions", unit: "index", frequency: "daily" },
  { seriesId: "DFII10", label: "10Y Real Yield (TIPS)", category: "Markets & Financial Conditions", unit: "%", frequency: "daily" },
  { seriesId: "T10Y3M", label: "10Y-3M Treasury Spread", category: "Markets & Financial Conditions", unit: "%", frequency: "daily" },
  { seriesId: "BAMLC0A0CM", label: "IG Corporate OAS", category: "Markets & Financial Conditions", unit: "%", frequency: "daily" },
  { seriesId: "NFCI", label: "Chicago Fed NFCI", category: "Markets & Financial Conditions", unit: "index", frequency: "weekly" },
];

function parseObservation(obs: FredObservation, scale = 1): { date: string; value: number } | null {
  if (obs.value === ".") return null;

  const raw = Number(obs.value);
  if (!Number.isFinite(raw)) return null;

  return {
    date: obs.date,
    value: raw / scale,
  };
}

function toUtcMs(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

function subtractMonths(date: string, months: number): number {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.getTime();
}

const DAY_MS = 86_400_000;

/**
 * Date-based lookback: pick the valid observation closest to (latest.date - months),
 * rejecting matches further away than toleranceDays. Index arithmetic would break
 * across mixed frequencies and missing-value gaps.
 */
function findLagged(
  values: { date: string; value: number }[],
  latestDate: string,
  months: number,
  toleranceDays: number
): { date: string; value: number } | null {
  const target = subtractMonths(latestDate, months);
  let best: { date: string; value: number } | null = null;
  let bestGap = Infinity;

  for (const v of values) {
    const gap = Math.abs(toUtcMs(v.date) - target);
    if (gap < bestGap) {
      bestGap = gap;
      best = v;
    }
  }

  if (!best || bestGap > toleranceDays * DAY_MS) return null;
  return best;
}

function classifyRateOfChange(
  latest: { value: number },
  v3m: { value: number } | null,
  v6m: { value: number } | null,
  unit: string
): RateOfChange | null {
  if (!v3m || !v6m) return null;

  const rocNow = latest.value - v3m.value;
  const rocPrior = v3m.value - v6m.value;
  const diff = rocNow - rocPrior;

  const epsilonAbs = unit === "%" ? 0.02 : Math.abs(latest.value) * 0.005;
  const threshold = Math.max(Math.abs(rocPrior) * 0.05, epsilonAbs);

  if (Math.abs(diff) <= threshold) return "stable";
  return diff > 0 ? "accelerating" : "decelerating";
}

function pctOf(
  change: number | null,
  base: { value: number } | null,
  unit: string
): number | null {
  if (change === null || !base || base.value === 0) return null;
  // Percentage-point series (spreads/yields) with a base under 0.1pp produce
  // meaningless multi-thousand-% readings (e.g. T10Y3M 0.01 → 0.76 = +7700%).
  if (unit === "%" && Math.abs(base.value) < 0.1) return null;
  return (change / Math.abs(base.value)) * 100;
}

/**
 * Pure summary computation over raw FRED observations (any order; "." values skipped).
 * Kept fetch-free so it is unit-testable with synthetic data.
 */
export function summarizeSeries(
  definition: FredSeriesDefinition,
  observations: FredObservation[]
): FredSeriesSummary {
  const values = observations
    .map((obs) => parseObservation(obs, definition.scale))
    .filter((obs): obs is { date: string; value: number } => obs !== null)
    .sort((a, b) => toUtcMs(b.date) - toUtcMs(a.date));

  const latest = values[0] ?? null;
  const previous = values[1] ?? null;
  const change = latest && previous ? latest.value - previous.value : null;
  const percentChange = pctOf(change, previous, definition.unit);

  let change3m: number | null = null;
  let pct3m: number | null = null;
  let change1y: number | null = null;
  let yoyPct: number | null = null;
  let rateOfChange: RateOfChange | null = null;

  if (latest) {
    const lagged = values.slice(1);
    const v3m = findLagged(lagged, latest.date, 3, 45);
    const v6m = findLagged(lagged, latest.date, 6, 45);
    const v1y = findLagged(lagged, latest.date, 12, 90);

    change3m = v3m ? latest.value - v3m.value : null;
    pct3m = pctOf(change3m, v3m, definition.unit);
    change1y = v1y ? latest.value - v1y.value : null;
    yoyPct = pctOf(change1y, v1y, definition.unit);
    rateOfChange = classifyRateOfChange(latest, v3m, v6m, definition.unit);
  }

  return {
    seriesId: definition.seriesId,
    label: definition.label,
    category: definition.category,
    unit: definition.unit,
    latest,
    previous,
    change,
    percentChange,
    change3m,
    pct3m,
    change1y,
    yoyPct,
    rateOfChange,
  };
}

function formatValue(value: number | null, unit: string): string {
  if (value === null) return "n/a";
  if (unit === "%") return `${value.toFixed(2)}%`;
  if (unit === "$T") return `$${value.toFixed(2)}T`;
  if (unit === "$B") return `$${value.toFixed(1)}B`;
  if (unit === "k") return `${value.toFixed(0)}k`;
  return value.toFixed(2);
}

function formatNumber(value: number | null, digits = 2): string {
  if (value === null) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

function formatPercent(value: number | null): string {
  if (value === null) return "n/a";
  return `${formatNumber(value)}%`;
}

function formatChangeWithPct(change: number | null, pct: number | null): string {
  if (change === null) return "n/a";
  const base = formatNumber(change);
  return pct === null ? base : `${base} (${formatPercent(pct)})`;
}

function formatRateOfChange(
  change3m: number | null,
  rateOfChange: RateOfChange | null
): string {
  if (change3m === null || rateOfChange === null) return "n/a";
  if (rateOfChange === "stable") return "stable";

  if (change3m > 0) {
    return rateOfChange === "accelerating" ? "rising faster" : "rising slower";
  }
  if (change3m < 0) {
    return rateOfChange === "accelerating" ? "falling slower" : "falling faster";
  }
  return rateOfChange === "accelerating" ? "turning up" : "turning down";
}

export function getFredSeriesDefinitions(
  category: string,
  seriesIds?: string
): FredSeriesDefinition[] {
  if (seriesIds) {
    const byId = new Map(FRED_SERIES.map((s) => [s.seriesId, s]));
    return seriesIds
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .map((seriesId) => byId.get(seriesId) ?? {
        seriesId,
        label: seriesId,
        category: "Growth & Inflation" as const,
        unit: "value",
        frequency: "daily" as const,
      });
  }

  if (category === "all") return FRED_SERIES;

  const categoryName: FredMacroCategory = category === "liquidity"
    ? "Liquidity"
    : category === "rates_credit"
      ? "Rates & Credit"
      : category === "markets"
        ? "Markets & Financial Conditions"
        : "Growth & Inflation";

  return FRED_SERIES.filter((s) => s.category === categoryName);
}

async function getFredSeriesSummary(
  definition: FredSeriesDefinition,
  limit?: number,
  observationStart?: string,
  observationEnd?: string
): Promise<FredSeriesSummary> {
  const observations = await getFredObservations(definition.seriesId, {
    limit: limit ?? FREQUENCY_FETCH_LIMIT[definition.frequency],
    observationStart,
    observationEnd,
    sortOrder: "desc",
  });

  return summarizeSeries(definition, observations);
}

export function formatFredSeriesSummaries(summaries: FredSeriesSummary[]): string {
  let output = `## FRED Macro Data — ${new Date().toISOString().slice(0, 10)}\n\n`;
  output += `| Series | Latest | Date | Δ Prev | Δ 3M | Δ 1Y | YoY % | RoC |\n`;
  output += `|--------|--------|------|--------|------|------|-------|-----|\n`;

  for (const s of summaries) {
    const latestValue = formatValue(s.latest?.value ?? null, s.unit);
    output += `| ${s.label} (${s.seriesId}) | ${latestValue} | ${s.latest?.date ?? "n/a"} | ${formatNumber(s.change)} | ${formatChangeWithPct(s.change3m, s.pct3m)} | ${formatNumber(s.change1y)} | ${formatPercent(s.yoyPct)} | ${formatRateOfChange(s.change3m, s.rateOfChange)} |\n`;
  }

  output += `\nSource: FRED series observations. Missing FRED values marked "." are skipped.\n`;
  output += `RoC = direction-aware second derivative of the 3M change (Δ over last 3M vs Δ over prior 3M): `;
  output += `rising/falling faster or slower, stable, or a turn.\n`;
  return output;
}

/**
 * Map settled fetches back onto table rows. A rejected series becomes an
 * all-n/a row labelled "(fetch failed)" rather than discarding its siblings —
 * one bad series_id (a typo, a retired series) must not empty the whole
 * response. Fetch-free so it is unit-testable.
 */
export function settleSeriesSummaries(
  definitions: FredSeriesDefinition[],
  results: PromiseSettledResult<FredSeriesSummary>[]
): FredSeriesSummary[] {
  return results.map((result, i) => {
    if (result.status === "fulfilled") return result.value;

    const definition = definitions[i];
    return {
      seriesId: definition.seriesId,
      label: `${definition.label} (fetch failed)`,
      category: definition.category,
      unit: definition.unit,
      latest: null,
      previous: null,
      change: null,
      percentChange: null,
      change3m: null,
      pct3m: null,
      change1y: null,
      yoyPct: null,
      rateOfChange: null,
    };
  });
}

export async function getFredMacroData(
  category: string = "all",
  seriesIds?: string,
  limit?: number,
  observationStart?: string,
  observationEnd?: string
): Promise<string> {
  const definitions = getFredSeriesDefinitions(category, seriesIds);
  const results = await Promise.allSettled(
    definitions.map((definition) => getFredSeriesSummary(
      definition,
      limit,
      observationStart,
      observationEnd
    ))
  );

  return formatFredSeriesSummaries(settleSeriesSummaries(definitions, results));
}
