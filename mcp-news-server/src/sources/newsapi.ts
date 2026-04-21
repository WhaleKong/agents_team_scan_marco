import { RateLimiter } from "../utils/rate-limiter.js";

// Free tier: 100 req/day — use sparingly
const limiter = new RateLimiter(2, 60_000); // 2 req/min to stay well under daily limit

function getApiKey(): string {
  const key = process.env.NEWSAPI_API_KEY;
  if (!key) throw new Error("NEWSAPI_API_KEY not set");
  return key;
}

export interface NewsApiArticle {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  content: string | null;
}

interface NewsApiResponse {
  status: string;
  totalResults: number;
  articles: NewsApiArticle[];
}

async function newsapiFetch(
  endpoint: string,
  params: Record<string, string>
): Promise<NewsApiResponse> {
  await limiter.waitForSlot();
  const url = new URL(`https://newsapi.org/v2/${endpoint}`);
  url.searchParams.set("apiKey", getApiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`NewsAPI ${endpoint}: ${res.status} ${res.statusText}`);
  return res.json() as Promise<NewsApiResponse>;
}

export async function searchEverything(
  query: string,
  options: { from?: string; sortBy?: string; pageSize?: number } = {}
): Promise<NewsApiArticle[]> {
  const params: Record<string, string> = {
    q: query,
    language: "en",
    sortBy: options.sortBy ?? "publishedAt",
    pageSize: String(options.pageSize ?? 20),
  };
  if (options.from) params.from = options.from;

  const data = await newsapiFetch("everything", params);
  return data.articles;
}

export async function getTopHeadlines(
  options: { category?: string; country?: string; pageSize?: number } = {}
): Promise<NewsApiArticle[]> {
  const params: Record<string, string> = {
    country: options.country ?? "us",
    pageSize: String(options.pageSize ?? 20),
  };
  if (options.category) params.category = options.category;

  const data = await newsapiFetch("top-headlines", params);
  return data.articles;
}
