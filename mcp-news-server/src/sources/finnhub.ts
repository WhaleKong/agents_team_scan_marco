import { RateLimiter } from "../utils/rate-limiter.js";

const limiter = new RateLimiter(55, 60_000); // 55 req/min (buffer from 60 limit)

function getApiKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY not set");
  return key;
}

async function finnhubFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  await limiter.waitForSlot();
  const url = new URL(`https://finnhub.io/api/v1${path}`);
  url.searchParams.set("token", getApiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Finnhub ${path}: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export interface FinnhubNewsItem {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export interface FinnhubEarning {
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  hour: string;
  quarter: number;
  revenueActual: number | null;
  revenueEstimate: number | null;
  symbol: string;
  year: number;
}

export interface FinnhubEconomicEvent {
  actual: number | null;
  country: string;
  estimate: number | null;
  event: string;
  impact: string;
  prev: number | null;
  time: string;
  unit: string;
}

export async function getGeneralNews(category = "general"): Promise<FinnhubNewsItem[]> {
  return finnhubFetch<FinnhubNewsItem[]>("/news", { category });
}

export async function getCompanyNews(
  symbol: string,
  from: string,
  to: string
): Promise<FinnhubNewsItem[]> {
  return finnhubFetch<FinnhubNewsItem[]>("/company-news", { symbol, from, to });
}

export async function getEconomicCalendar(
  from: string,
  to: string
): Promise<{ economicCalendar: FinnhubEconomicEvent[] }> {
  return finnhubFetch("/calendar/economic", { from, to });
}

export async function getEarningsCalendar(
  from: string,
  to: string
): Promise<{ earningsCalendar: FinnhubEarning[] }> {
  return finnhubFetch("/calendar/earnings", { from, to });
}

export async function getMarketNews(category: string = "general"): Promise<FinnhubNewsItem[]> {
  return finnhubFetch<FinnhubNewsItem[]>("/news", { category });
}
