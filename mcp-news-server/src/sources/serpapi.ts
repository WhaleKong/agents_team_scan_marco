import { RateLimiter } from "../utils/rate-limiter.js";

// Free tier: 100 searches/month — use as enrichment, not primary
const limiter = new RateLimiter(1, 10_000); // 1 req per 10s to conserve quota

function getApiKey(): string {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) throw new Error("SERPAPI_API_KEY not set");
  return key;
}

async function serpapiFetch<T>(params: Record<string, string>): Promise<T> {
  await limiter.waitForSlot();
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("api_key", getApiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`SerpAPI: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// --- Google News ---

export interface SerpNewsResult {
  title: string;
  link: string;
  source: { name: string };
  date: string;
  snippet: string;
  thumbnail?: string;
}

interface GoogleNewsResponse {
  news_results?: SerpNewsResult[];
  search_information?: { total_results?: number };
}

export async function searchGoogleNews(
  query: string,
  options: { timeFilter?: string; limit?: number } = {}
): Promise<SerpNewsResult[]> {
  const params: Record<string, string> = {
    engine: "google_news",
    q: query,
    gl: "us",
    hl: "en",
  };

  // Time filter: qdr:h (past hour), qdr:d (past day), qdr:w (past week)
  if (options.timeFilter) {
    params.tbs = options.timeFilter;
  }

  const data = await serpapiFetch<GoogleNewsResponse>(params);
  const results = data.news_results ?? [];
  return results.slice(0, options.limit ?? 20);
}

// --- Google Search (for macro research) ---

export interface SerpSearchResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
  source?: string;
}

interface GoogleSearchResponse {
  organic_results?: {
    title: string;
    link: string;
    snippet: string;
    date?: string;
    source?: string;
  }[];
  knowledge_graph?: {
    title?: string;
    description?: string;
    [key: string]: unknown;
  };
  answer_box?: {
    title?: string;
    answer?: string;
    snippet?: string;
    [key: string]: unknown;
  };
}

export async function searchGoogle(
  query: string,
  options: { timeFilter?: string; num?: number } = {}
): Promise<{ results: SerpSearchResult[]; knowledgeGraph?: string; answerBox?: string }> {
  const params: Record<string, string> = {
    engine: "google",
    q: query,
    gl: "us",
    hl: "en",
    num: String(options.num ?? 10),
  };

  if (options.timeFilter) {
    params.tbs = options.timeFilter;
  }

  const data = await serpapiFetch<GoogleSearchResponse>(params);

  const results: SerpSearchResult[] = (data.organic_results ?? []).map((r) => ({
    title: r.title,
    link: r.link,
    snippet: r.snippet,
    date: r.date,
    source: r.source,
  }));

  const knowledgeGraph = data.knowledge_graph
    ? `${data.knowledge_graph.title ?? ""}: ${data.knowledge_graph.description ?? ""}`
    : undefined;

  const answerBox = data.answer_box
    ? data.answer_box.answer ?? data.answer_box.snippet ?? ""
    : undefined;

  return { results, knowledgeGraph, answerBox };
}

// --- Google Finance ---

export interface FinanceQuote {
  symbol: string;
  name: string;
  price: string;
  currency: string;
  priceChange: string;
  priceChangePercent: string;
  market?: string;
}

export interface FinanceNews {
  title: string;
  link: string;
  source: string;
  date: string;
  snippet: string;
}

interface GoogleFinanceResponse {
  summary?: {
    title?: string;
    stock?: string;
    exchange?: string;
    currency?: string;
    price?: number;
    extracted_price?: number;
    price_change?: number;
    price_change_percentage?: number;
    price_movement?: {
      movement: string;
      value: number;
      percentage: number;
    };
  };
  markets?: {
    us?: { name: string; price: number; extracted_price: number; price_movement: { percentage: number; movement: string } }[];
    europe?: { name: string; price: number; extracted_price: number; price_movement: { percentage: number; movement: string } }[];
    asia?: { name: string; price: number; extracted_price: number; price_movement: { percentage: number; movement: string } }[];
    currencies?: { name: string; price: number; extracted_price: number; price_movement: { percentage: number; movement: string } }[];
    crypto?: { name: string; price: number; extracted_price: number; price_movement: { percentage: number; movement: string } }[];
  };
  news_results?: {
    title: string;
    link: string;
    source: string;
    date: string;
    snippet: string;
  }[];
  graph?: { price: number; date: string }[];
}

export async function getFinanceQuote(
  symbol: string
): Promise<{ quote: FinanceQuote | null; news: FinanceNews[]; graph: { price: number; date: string }[]; raw_has_summary: boolean }> {
  const data = await serpapiFetch<GoogleFinanceResponse>({
    engine: "google_finance",
    q: symbol,
  });

  let quote: FinanceQuote | null = null;
  if (data.summary) {
    const s = data.summary;
    const movement = s.price_movement;
    quote = {
      symbol: s.stock ?? symbol,
      name: s.title ?? symbol,
      price: String(s.extracted_price ?? s.price ?? "N/A"),
      currency: s.currency ?? "USD",
      priceChange: String(movement?.value ?? s.price_change ?? "0"),
      priceChangePercent: String(movement?.percentage ?? s.price_change_percentage ?? "0"),
      market: s.exchange,
    };
  }

  const news: FinanceNews[] = (data.news_results ?? []).map((n) => ({
    title: n.title,
    link: n.link,
    source: n.source,
    date: n.date,
    snippet: n.snippet,
  }));

  const graph = data.graph ?? [];

  return { quote, news, graph, raw_has_summary: !!data.summary };
}

export async function getMarketOverview(): Promise<GoogleFinanceResponse["markets"]> {
  const data = await serpapiFetch<GoogleFinanceResponse>({
    engine: "google_finance_markets",
    trend: "most-active",
  });
  return data.markets;
}
