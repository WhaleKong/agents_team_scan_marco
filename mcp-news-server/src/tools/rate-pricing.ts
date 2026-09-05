import { FOMC_DECISION_DATES } from "../config/fomc-schedule.js";
import {
  getKalshiCandlesticks,
  getKalshiEventMarkets,
  type KalshiCandlestick,
  type KalshiMarket,
} from "../sources/kalshi.js";

export const FED_DECISION_SERIES = "KXFEDDECISION";

const MONTH_CODES = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/**
 * The five mutually-exclusive outcome legs of one FOMC meeting, ordered
 * hawkish -> dovish. Matched on the market ticker suffix rather than the
 * yes_sub_title text, which is prose and can be reworded.
 */
export const OUTCOME_LEGS = [
  { suffix: "H26", label: "Hike >25" },
  { suffix: "H25", label: "Hike 25" },
  { suffix: "H0", label: "Hold" },
  { suffix: "C25", label: "Cut 25" },
  { suffix: "C26", label: "Cut >25" },
] as const;

/** The two legs that carry the decision; the tail legs sit near 0-2% regardless. */
export const DECISIVE_LEGS = ["H25", "H0"] as const;

// Quality thresholds, calibrated against measured Kalshi flow on 2026-09-04:
//   Sep 2026 meeting  vol24h 1,232,815 -> OK
//   Oct 2026 meeting  vol24h     4,990 -> THIN
//   Dec 2026 meeting  vol24h       451 -> STALE
//   Mar 2027 meeting  vol24h         0 -> STALE (spread also 6-8 pts)
// A tight spread alone does NOT mean the price is trustworthy: Oct and Dec
// both quote 1-pt spreads on almost no flow, i.e. an untested market-maker
// mark rather than a consensus.
const STALE_VOLUME_24H = 1_000;
const THIN_VOLUME_24H = 25_000;
const WIDE_SPREAD = 0.05;
const OVERROUND_NOTE_THRESHOLD = 0.05;

const PATH_DAYS = 14;
const DAY_SECONDS = 86_400;

const ET_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type PricingQuality = "OK" | "THIN" | "STALE" | "DEAD";

export interface OutcomeQuote {
  suffix: string;
  label: string;
  /** Probability 0..1, mid of yes bid/ask, falling back to last trade. */
  mid: number | null;
  last: number | null;
  spread: number | null;
  volume24h: number | null;
  openInterest: number | null;
}

export interface MeetingPricing {
  decisionDate: string;
  eventTicker: string;
  outcomes: OutcomeQuote[];
  hold: number | null;
  hike25: number | null;
  totalHike: number | null;
  totalCut: number | null;
  sumMids: number | null;
  maxVolume24h: number | null;
  quality: PricingQuality;
  fetchFailed: boolean;
  /** Move since the last completed ET session close; see applySessionBaseline. */
  hike25Delta: number | null;
  holdDelta: number | null;
  baselineSession: string | null;
}

export interface SessionBaseline {
  /** ET session whose close is the reference. */
  session: string;
  /** Outcome suffix -> that session's closing probability. */
  closes: Record<string, number | null>;
}

export interface PathPoint {
  session: string;
  close: number | null;
  delta: number | null;
  inProgress: boolean;
}

/** "2026-09-16" -> "KXFEDDECISION-26SEP" */
export function fomcDateToEventTicker(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  const monthIndex = Number(month) - 1;
  if (!year || monthIndex < 0 || monthIndex > 11) {
    throw new Error(`Unparseable FOMC date: ${isoDate}`);
  }
  return `${FED_DECISION_SERIES}-${year.slice(2)}${MONTH_CODES[monthIndex]}`;
}

/**
 * Next `count` scheduled FOMC decisions on or after `fromDate`.
 * `exhausted` is true when the hardcoded schedule ran out before `count` was
 * satisfied, which is the signal to refresh src/config/fomc-schedule.ts.
 */
export function selectMeetings(
  fromDate: string,
  count: number
): { dates: string[]; exhausted: boolean } {
  const upcoming = FOMC_DECISION_DATES.filter((d) => d >= fromDate);
  return {
    dates: upcoming.slice(0, count),
    exhausted: upcoming.length < count,
  };
}

/** Kalshi money/size fields arrive as decimal strings; "" and null mean absent. */
export function parseDollars(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function marketSuffix(ticker: string): string {
  const dash = ticker.lastIndexOf("-");
  return dash === -1 ? "" : ticker.slice(dash + 1);
}

function quoteFromMarket(
  leg: { suffix: string; label: string },
  market: KalshiMarket | undefined
): OutcomeQuote {
  const bid = parseDollars(market?.yes_bid_dollars);
  const ask = parseDollars(market?.yes_ask_dollars);
  const last = parseDollars(market?.last_price_dollars);

  // Mid is more robust than last trade in a light market; fall back to last
  // only when there is no two-sided quote at all.
  return {
    suffix: leg.suffix,
    label: leg.label,
    mid: bid !== null && ask !== null ? (bid + ask) / 2 : last,
    last,
    spread: bid !== null && ask !== null ? ask - bid : null,
    volume24h: parseDollars(market?.volume_24h_fp),
    openInterest: parseDollars(market?.open_interest_fp),
  };
}

function addOrNull(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a + b;
}

function classifyQuality(
  outcomes: OutcomeQuote[],
  maxVolume24h: number | null
): PricingQuality {
  if (outcomes.every((o) => o.mid === null)) return "DEAD";
  if (maxVolume24h === null || maxVolume24h < STALE_VOLUME_24H) return "STALE";

  const widest = outcomes
    .filter((o) => (DECISIVE_LEGS as readonly string[]).includes(o.suffix))
    .reduce<number | null>(
      (acc, o) => (o.spread === null ? acc : acc === null ? o.spread : Math.max(acc, o.spread)),
      null
    );

  if (maxVolume24h < THIN_VOLUME_24H) return "THIN";
  if (widest !== null && widest > WIDE_SPREAD) return "THIN";
  return "OK";
}

export function summarizeMeeting(
  decisionDate: string,
  markets: KalshiMarket[]
): MeetingPricing {
  const bySuffix = new Map<string, KalshiMarket>();
  for (const market of markets) {
    bySuffix.set(marketSuffix(market.ticker), market);
  }

  const outcomes = OUTCOME_LEGS.map((leg) => quoteFromMarket(leg, bySuffix.get(leg.suffix)));
  const mid = (suffix: string) => outcomes.find((o) => o.suffix === suffix)?.mid ?? null;

  const sumMids = outcomes.reduce<number | null>(
    (acc, o) => (acc === null || o.mid === null ? null : acc + o.mid),
    0
  );

  const maxVolume24h = outcomes.reduce<number | null>(
    (acc, o) => (o.volume24h === null ? acc : acc === null ? o.volume24h : Math.max(acc, o.volume24h)),
    null
  );

  return {
    decisionDate,
    eventTicker: fomcDateToEventTicker(decisionDate),
    outcomes,
    hold: mid("H0"),
    hike25: mid("H25"),
    totalHike: addOrNull(mid("H25"), mid("H26")),
    totalCut: addOrNull(mid("C25"), mid("C26")),
    sumMids,
    maxVolume24h,
    quality: classifyQuality(outcomes, maxVolume24h),
    fetchFailed: false,
    hike25Delta: null,
    holdDelta: null,
    baselineSession: null,
  };
}

/** A meeting whose fetch rejected still gets a row, so one failure is visible
 *  without emptying the table (same contract as settleSeriesSummaries). */
export function failedMeeting(decisionDate: string): MeetingPricing {
  return {
    decisionDate,
    eventTicker: fomcDateToEventTicker(decisionDate),
    outcomes: OUTCOME_LEGS.map((leg) => ({
      suffix: leg.suffix,
      label: leg.label,
      mid: null,
      last: null,
      spread: null,
      volume24h: null,
      openInterest: null,
    })),
    hold: null,
    hike25: null,
    totalHike: null,
    totalCut: null,
    sumMids: null,
    maxVolume24h: null,
    quality: "DEAD",
    fetchFailed: true,
    hike25Delta: null,
    holdDelta: null,
    baselineSession: null,
  };
}

/**
 * Kalshi daily candles close at 00:00 ET, so the candle whose end_period_ts is
 * midnight of day D covers ET session D-1. Verified 2026-09-05 against the NFP
 * print: the 12:30Z release lands in the hourly candle stamped 13:00Z and in
 * the daily candle stamped 2026-09-05T04:00Z, i.e. the 2026-09-04 session.
 */
export function etSessionDate(endPeriodTs: number): string {
  return ET_DATE_FORMAT.format(new Date((endPeriodTs - 1) * 1000));
}

/**
 * Closing price of the most recent COMPLETED daily session.
 *
 * This is the delta baseline instead of Kalshi's own previous_price_dollars,
 * which is a reference price that rolls on Kalshi's cadence rather than at the
 * session boundary. Measured drift on 2026-09-05 at 03:03 ET: the 09-04
 * session had closed at 0.49 three hours earlier, yet previous_price_dollars
 * still read 0.42 (the 09-03 close) — and the day before it read 0.40, which
 * matched no session close at all. Using it would have reported a +7.5 pt move
 * on a day the market actually moved +0.5.
 */
export function lastCompletedClose(
  candles: KalshiCandlestick[],
  nowTs: number
): { session: string; close: number } | null {
  for (let i = candles.length - 1; i >= 0; i--) {
    const candle = candles[i]!;
    if (candle.end_period_ts > nowTs) continue;
    const close = parseDollars(candle.price?.close_dollars);
    if (close === null) continue;
    return { session: etSessionDate(candle.end_period_ts), close };
  }
  return null;
}

/** Fills in the decisive-leg deltas from a completed-session baseline. */
export function applySessionBaseline(
  meeting: MeetingPricing,
  baseline: SessionBaseline | null
): MeetingPricing {
  if (!baseline) return meeting;

  const delta = (current: number | null, suffix: string): number | null => {
    const reference = baseline.closes[suffix];
    return current === null || reference === null || reference === undefined
      ? null
      : current - reference;
  };

  return {
    ...meeting,
    hike25Delta: delta(meeting.hike25, "H25"),
    holdDelta: delta(meeting.hold, "H0"),
    baselineSession: baseline.session,
  };
}

export function summarizePath(
  candles: KalshiCandlestick[],
  nowTs: number
): PathPoint[] {
  let previousClose: number | null = null;

  return candles.map((candle) => {
    const close = parseDollars(candle.price?.close_dollars);
    const point: PathPoint = {
      session: etSessionDate(candle.end_period_ts),
      close,
      delta: close !== null && previousClose !== null ? close - previousClose : null,
      inProgress: candle.end_period_ts > nowTs,
    };
    if (close !== null) previousClose = close;
    return point;
  });
}

function formatProbability(value: number | null): string {
  if (value === null) return "n/a";
  return `${(value * 100).toFixed(1)}%`;
}

function formatPoints(value: number | null): string {
  if (value === null) return "n/a";
  const points = value * 100;
  const sign = points > 0 ? "+" : "";
  return `${sign}${points.toFixed(1)}`;
}

function formatWithDelta(value: number | null, delta: number | null): string {
  const base = formatProbability(value);
  if (value === null || delta === null) return base;
  return `${base} (${formatPoints(delta)})`;
}

function formatCount(value: number | null): string {
  if (value === null) return "n/a";
  return Math.round(value).toLocaleString("en-US");
}

function qualityCell(meeting: MeetingPricing): string {
  if (meeting.fetchFailed) return "n/a (fetch failed)";

  const volume = `vol24h ${formatCount(meeting.maxVolume24h)}`;
  switch (meeting.quality) {
    case "OK":
      return `OK — ${volume}`;
    case "THIN":
      return `THIN — indicative only, ${volume}`;
    case "STALE":
      return `STALE QUOTE — no flow, ${volume}`;
    case "DEAD":
      return "DEAD — no quotes";
  }
}

export function formatRatePricing(
  meetings: MeetingPricing[],
  path: { decisionDate: string; points: PathPoint[] } | null,
  asOf: string,
  exhausted: boolean
): string {
  let output = `## Fed Path Pricing — Kalshi event exchange (SECONDARY SOURCE)\n\n`;
  output += `As-of: ${asOf} (live quote) · Series: ${FED_DECISION_SERIES}\n\n`;

  output += `| FOMC date | Hike >25 | Hike 25 | Hold | Cut 25 | Cut >25 | TOTAL HIKE | TOTAL CUT | Data quality |\n`;
  output += `|-----------|----------|---------|------|--------|---------|------------|-----------|--------------|\n`;

  for (const meeting of meetings) {
    const mid = (suffix: string) =>
      formatProbability(meeting.outcomes.find((o) => o.suffix === suffix)?.mid ?? null);

    output += `| ${meeting.decisionDate} | ${mid("H26")} `;
    output += `| ${formatWithDelta(meeting.hike25, meeting.hike25Delta)} `;
    output += `| ${formatWithDelta(meeting.hold, meeting.holdDelta)} `;
    output += `| ${mid("C25")} | ${mid("C26")} `;
    output += `| ${formatProbability(meeting.totalHike)} `;
    output += `| ${formatProbability(meeting.totalCut)} | ${qualityCell(meeting)} |\n`;
  }

  const baselined = meetings.find((m) => m.baselineSession !== null);
  if (baselined) {
    output += `\nΔ in parentheses = move since the ${baselined.baselineSession} ET session close `;
    output += `(from daily candles). Shown only for the decisive legs of the nearest meeting.\n`;
  } else {
    output += `\nΔ unavailable: no completed daily session close was retrievable.\n`;
  }

  for (const meeting of meetings) {
    if (meeting.sumMids === null) continue;
    const overround = meeting.sumMids - 1;
    if (Math.abs(overround) > OVERROUND_NOTE_THRESHOLD) {
      output += `\nNOTE: ${meeting.decisionDate} outcome mids sum to ${formatProbability(meeting.sumMids)} `;
      output += `(${formatPoints(overround)} pts off 100%) — read the level as approximate.\n`;
    }
  }

  if (path && path.points.length > 0) {
    output += `\n### Probability path — ${path.decisionDate} "Hike 25" (daily close, ET sessions)\n\n`;
    output += `| ET session | Close | Δ |\n`;
    output += `|------------|-------|---|\n`;
    for (const point of path.points) {
      const label = point.inProgress ? `${point.session} (in progress)` : point.session;
      output += `| ${label} | ${formatProbability(point.close)} | ${formatPoints(point.delta)} |\n`;
    }
    output += `\nThe path matters more than the level: it shows whether the market was already `;
    output += `moving before a release, which a single as-of number cannot.\n`;
  }

  if (exhausted) {
    const last = FOMC_DECISION_DATES[FOMC_DECISION_DATES.length - 1];
    output += `\nWARNING: FOMC schedule constant ends ${last} — update src/config/fomc-schedule.ts `;
    output += `from federalreserve.gov/monetarypolicy/fomccalendars.htm\n`;
  }

  output += `\nSource: Kalshi (api.elections.kalshi.com), CFTC-regulated event exchange, no API key. `;
  output += `Price = mid of the yes bid/ask, falling back to last trade when there is no two-sided quote. `;
  output += `Deltas come from daily candles, NOT from Kalshi's previous_price_dollars field, which lags `;
  output += `the session boundary and would overstate a day's move.\n`;
  output += `\nSECONDARY SOURCE — this is a prediction market, NOT fed funds futures or OIS. `;
  output += `It supplies a priced baseline (number + as-of) so a Fed-path claim is no longer unobservable. `;
  output += `It CANNOT on its own mark a pricing gap VERIFIED — that still requires a second, independent `;
  output += `evidence leg — and it must never carry a concentrated position by itself.\n`;
  output += `\nData quality: OK = vol24h >= ${THIN_VOLUME_24H.toLocaleString("en-US")} and decisive-leg spread <= `;
  output += `${(WIDE_SPREAD * 100).toFixed(0)} pts. THIN = tradeable but light. `;
  output += `STALE QUOTE = vol24h < ${STALE_VOLUME_24H.toLocaleString("en-US")}, so a tight spread is likely an `;
  output += `untested market-maker mark rather than a consensus. In practice only the nearest meeting reaches OK.\n`;

  return output;
}

export async function getRatePricing(
  meetings = 1,
  includePath = true,
  today?: string
): Promise<string> {
  const asOfDate = new Date();
  const fromDate = today ?? asOfDate.toISOString().slice(0, 10);
  const count = Math.min(Math.max(Math.trunc(meetings), 1), 8);

  const selected = selectMeetings(fromDate, count);
  if (selected.dates.length === 0) {
    const last = FOMC_DECISION_DATES[FOMC_DECISION_DATES.length - 1];
    return (
      `No scheduled FOMC meeting on or after ${fromDate}. ` +
      `The schedule constant ends ${last} — update src/config/fomc-schedule.ts ` +
      `from federalreserve.gov/monetarypolicy/fomccalendars.htm\n`
    );
  }

  const results = await Promise.allSettled(
    selected.dates.map(async (date) =>
      summarizeMeeting(date, await getKalshiEventMarkets(fomcDateToEventTicker(date)))
    )
  );
  const summaries = results.map((result, i) =>
    result.status === "fulfilled" ? result.value : failedMeeting(selected.dates[i]!)
  );

  // Candles serve two purposes for the nearest meeting: the session baseline
  // that makes Δ trustworthy, and (optionally) the rendered path.
  const nearest = selected.dates[0]!;
  const nearestTicker = fomcDateToEventTicker(nearest);
  const nowTs = Math.floor(asOfDate.getTime() / 1000);
  const startTs = nowTs - PATH_DAYS * DAY_SECONDS;

  let baseline: SessionBaseline | null = null;
  let path: { decisionDate: string; points: PathPoint[] } | null = null;

  try {
    const [hike25Candles, holdCandles] = await Promise.all(
      DECISIVE_LEGS.map((suffix) =>
        getKalshiCandlesticks(FED_DECISION_SERIES, `${nearestTicker}-${suffix}`, startTs, nowTs)
      )
    );

    const hike25Close = lastCompletedClose(hike25Candles ?? [], nowTs);
    const holdClose = lastCompletedClose(holdCandles ?? [], nowTs);
    if (hike25Close) {
      baseline = {
        session: hike25Close.session,
        closes: { H25: hike25Close.close, H0: holdClose?.close ?? null },
      };
    }
    if (includePath && hike25Candles) {
      path = { decisionDate: nearest, points: summarizePath(hike25Candles, nowTs) };
    }
  } catch {
    // The distribution is the deliverable; deltas and the path are context.
    // A candlestick failure must not take the whole tool down.
    baseline = null;
    path = null;
  }

  const withDeltas = summaries.map((meeting, i) =>
    i === 0 ? applySessionBaseline(meeting, baseline) : meeting
  );

  return formatRatePricing(
    withDeltas,
    path,
    asOfDate.toISOString().replace(/\.\d{3}Z$/, "Z"),
    selected.exhausted
  );
}
