import { getCotRecords, type CotRecord } from "../sources/cftc.js";

export interface CotMarketDefinition {
  code: string;
  label: string;
  /**
   * Extra filter tokens matched exactly (not as substrings), for markets whose
   * common ticker is absent from the label — "aud" is nowhere in
   * "Australian Dollar (CME)". Exact matching keeps "usd" off the Aussie.
   */
  aliases?: string[];
}

// Contract codes verified against publicreporting.cftc.gov on 2026-07-05;
// Australian Dollar (232741) verified 2026-08-13;
// Swiss Franc (092741) verified 2026-08-25.
export const COT_MARKETS: CotMarketDefinition[] = [
  { code: "088691", label: "Gold (COMEX)" },
  { code: "099741", label: "Euro FX (CME)" },
  { code: "097741", label: "Japanese Yen (CME)" },
  { code: "098662", label: "USD Index (ICE)" },
  { code: "232741", label: "Australian Dollar (CME)", aliases: ["aud", "audusd", "aussie"] },
  { code: "092741", label: "Swiss Franc (CME)", aliases: ["chf", "usdchf", "swissie"] },
  { code: "13874A", label: "E-mini S&P 500 (CME)" },
  { code: "209742", label: "Nasdaq-100 Mini (CME)" },
];

/**
 * Resolve a comma-separated filter to tracked markets. A token matches a market
 * if it appears in the label, or equals one of the market's aliases. Empty or
 * whitespace-only input selects everything. Fetch-free so it is unit-testable.
 */
export function selectCotMarkets(markets?: string): CotMarketDefinition[] {
  const tokens = (markets ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.length === 0) return COT_MARKETS;

  return COT_MARKETS.filter((m) =>
    tokens.some(
      (t) => m.label.toLowerCase().includes(t) || (m.aliases?.includes(t) ?? false)
    )
  );
}

export interface CotSummary {
  label: string;
  reportDate: string | null;
  net: number | null;
  weeklyChange: number | null;
  pctOfOpenInterest: number | null;
  percentile52w: number | null;
}

const MIN_HISTORY_FOR_PERCENTILE = 12;

interface ParsedCot {
  date: string;
  net: number;
  openInterest: number | null;
}

function parseRecord(record: CotRecord): ParsedCot | null {
  const long = Number(record.noncomm_positions_long_all);
  const short = Number(record.noncomm_positions_short_all);
  if (!Number.isFinite(long) || !Number.isFinite(short) || !record.report_date_as_yyyy_mm_dd) {
    return null;
  }

  const oi = Number(record.open_interest_all);
  return {
    date: record.report_date_as_yyyy_mm_dd.slice(0, 10),
    net: long - short,
    openInterest: Number.isFinite(oi) && oi > 0 ? oi : null,
  };
}

/**
 * Pure summary over raw COT records (any order). Percentile = share of the
 * trailing 52 weekly nets strictly below the latest (0 = most net-short in a
 * year, 100 = most net-long). Fetch-free so it is unit-testable with fixtures.
 */
export function summarizeCot(label: string, records: CotRecord[]): CotSummary {
  const parsed = records
    .map(parseRecord)
    .filter((r): r is ParsedCot => r !== null)
    .sort((a, b) => b.date.localeCompare(a.date));

  const latest = parsed[0] ?? null;
  if (!latest) {
    return {
      label,
      reportDate: null,
      net: null,
      weeklyChange: null,
      pctOfOpenInterest: null,
      percentile52w: null,
    };
  }

  const previous = parsed[1] ?? null;
  const window = parsed.slice(0, 52).map((r) => r.net);

  let percentile52w: number | null = null;
  if (window.length >= MIN_HISTORY_FOR_PERCENTILE) {
    const below = window.filter((n) => n < latest.net).length;
    percentile52w = (below / (window.length - 1)) * 100;
  }

  return {
    label,
    reportDate: latest.date,
    net: latest.net,
    weeklyChange: previous ? latest.net - previous.net : null,
    pctOfOpenInterest: latest.openInterest !== null
      ? (latest.net / latest.openInterest) * 100
      : null,
    percentile52w,
  };
}

function formatInt(value: number | null): string {
  if (value === null) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value).toLocaleString("en-US")}`;
}

function formatPct(value: number | null, digits = 1): string {
  if (value === null) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

function crowdedness(percentile: number | null): string {
  if (percentile === null) return "n/a";
  if (percentile >= 90) return `${percentile.toFixed(0)} — AT 1Y LONG EXTREME`;
  if (percentile <= 10) return `${percentile.toFixed(0)} — AT 1Y SHORT EXTREME`;
  return percentile.toFixed(0);
}

export function formatCotSummaries(summaries: CotSummary[]): string {
  let output = `## CFTC COT — Non-Commercial Positioning (Legacy Futures-Only)\n\n`;
  output += `| Market | Report Date | Net Non-Comm | Weekly Δ | % of OI | 52w Percentile |\n`;
  output += `|--------|-------------|--------------|----------|---------|----------------|\n`;

  for (const s of summaries) {
    output += `| ${s.label} | ${s.reportDate ?? "n/a"} | ${formatInt(s.net)} | ${formatInt(s.weeklyChange)} | ${formatPct(s.pctOfOpenInterest)} | ${crowdedness(s.percentile52w)} |\n`;
  }

  output += `\nData as-of Tuesday, published Friday ~15:30 ET. Source: publicreporting.cftc.gov (no key).\n`;
  output += `52w percentile: 100 = most net-long of the past year, 0 = most net-short (relative to the year, `;
  output += `NOT the sign of the net). >= 90 or <= 10 = positioning at a yearly extreme — contrarian risk.\n`;
  return output;
}

export async function getCotPositioning(markets?: string): Promise<string> {
  const wanted = selectCotMarkets(markets);

  if (wanted.length === 0) {
    const names = COT_MARKETS.map((m) => m.label).join(", ");
    return `No COT market matches "${markets}". Available: ${names}.`;
  }

  const results = await Promise.allSettled(
    wanted.map(async (market) => summarizeCot(market.label, await getCotRecords(market.code)))
  );

  const summaries: CotSummary[] = results.map((result, i) =>
    result.status === "fulfilled"
      ? result.value
      : {
          label: `${wanted[i].label} (fetch failed)`,
          reportDate: null,
          net: null,
          weeklyChange: null,
          pctOfOpenInterest: null,
          percentile52w: null,
        }
  );

  return formatCotSummaries(summaries);
}
