import { RateLimiter } from "../utils/rate-limiter.js";

// Kalshi public market data — a CFTC-regulated event exchange.
//
// No API key required: /events, /series, /markets and /candlesticks all return
// 200 with no credentials (verified 2026-09-04). Only /portfolio/* needs auth
// and returns 401 token_authentication_failure.
//
// The legacy host trading-api.kalshi.com is DEAD — it answers 401 with
// "API has been moved to https://api.elections.kalshi.com/". Do not use it.
//
// Kalshi exposes no rate-limit headers (CloudFront strips them), so throttle
// conservatively on our side. One /regime run costs <= 4 calls.
const limiter = new RateLimiter(20, 60_000);

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";

/**
 * FIELD-NAME TRAP — read this before editing the interface.
 *
 * Kalshi renamed every price and size field. The legacy names still PARSE
 * against the current payload but each one is `undefined`, so a consumer using
 * them silently reads null prices across the whole book and concludes the API
 * requires authentication. It does not. Legacy -> current:
 *
 *   last_price     -> last_price_dollars
 *   yes_bid        -> yes_bid_dollars
 *   yes_ask        -> yes_ask_dollars
 *   volume         -> volume_fp
 *   volume_24h     -> volume_24h_fp
 *   open_interest  -> open_interest_fp
 *   (new)          -> previous_price_dollars
 *
 * All *_dollars values are decimal STRINGS in "0.0000".."1.0000" — a
 * probability, not cents. The *_fp size fields are decimal strings too.
 */
export interface KalshiMarket {
  ticker: string;
  event_ticker?: string;
  title?: string;
  yes_sub_title?: string;
  status?: string;
  close_time?: string;
  yes_bid_dollars?: string | null;
  yes_ask_dollars?: string | null;
  last_price_dollars?: string | null;
  previous_price_dollars?: string | null;
  volume_fp?: string | null;
  volume_24h_fp?: string | null;
  open_interest_fp?: string | null;
}

export interface KalshiCandlestick {
  end_period_ts: number;
  volume_fp?: string | null;
  open_interest_fp?: string | null;
  price?: {
    open_dollars?: string | null;
    high_dollars?: string | null;
    low_dollars?: string | null;
    close_dollars?: string | null;
    previous_dollars?: string | null;
  } | null;
}

async function kalshiFetch<T>(path: string, label: string): Promise<T> {
  await limiter.waitForSlot();

  const res = await fetch(`${KALSHI_BASE}${path}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Kalshi ${label}: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as T;
}

/** One call returns the full mutually-exclusive outcome set for a meeting. */
export async function getKalshiEventMarkets(
  eventTicker: string
): Promise<KalshiMarket[]> {
  const data = await kalshiFetch<{ event?: { markets?: KalshiMarket[] } }>(
    `/events/${encodeURIComponent(eventTicker)}?with_nested_markets=true`,
    eventTicker
  );
  return data.event?.markets ?? [];
}

/** Daily OHLC history for one outcome leg. period_interval is in minutes. */
export async function getKalshiCandlesticks(
  seriesTicker: string,
  marketTicker: string,
  startTs: number,
  endTs: number,
  periodInterval = 1440
): Promise<KalshiCandlestick[]> {
  const data = await kalshiFetch<{ candlesticks?: KalshiCandlestick[] }>(
    `/series/${encodeURIComponent(seriesTicker)}` +
      `/markets/${encodeURIComponent(marketTicker)}` +
      `/candlesticks?start_ts=${startTs}&end_ts=${endTs}` +
      `&period_interval=${periodInterval}`,
    marketTicker
  );
  return data.candlesticks ?? [];
}
