import { RateLimiter } from "../utils/rate-limiter.js";

const limiter = new RateLimiter(4, 60_000); // 4 req/min (buffer from 5 limit)

function getApiKey(): string {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) throw new Error("ALPHA_VANTAGE_API_KEY not set");
  return key;
}

export interface SentimentArticle {
  title: string;
  url: string;
  time_published: string;
  authors: string[];
  summary: string;
  source: string;
  overall_sentiment_score: number;
  overall_sentiment_label: string;
  ticker_sentiment?: {
    ticker: string;
    relevance_score: string;
    ticker_sentiment_score: string;
    ticker_sentiment_label: string;
  }[];
}

interface SentimentResponse {
  items: string;
  sentiment_score_definition: string;
  relevance_score_definition: string;
  feed: SentimentArticle[];
  Note?: string;
  Information?: string;
  "Error Message"?: string;
}

export async function getNewsSentiment(
  options: { tickers?: string; sort?: string; limit?: number } = {}
): Promise<SentimentArticle[]> {
  await limiter.waitForSlot();

  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "NEWS_SENTIMENT");
  url.searchParams.set("apikey", getApiKey());

  if (options.tickers) url.searchParams.set("tickers", options.tickers);
  if (options.sort) url.searchParams.set("sort", options.sort);
  if (options.limit) url.searchParams.set("limit", String(options.limit));

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Alpha Vantage: ${res.status} ${res.statusText}`);

  const data = (await res.json()) as SentimentResponse;

  // Alpha Vantage returns errors in JSON body, not HTTP status
  if (data.Note) {
    throw new Error(`Alpha Vantage rate limit: ${data.Note}`);
  }
  if (data["Error Message"]) {
    throw new Error(`Alpha Vantage error: ${data["Error Message"]}`);
  }
  if (data.Information) {
    throw new Error(`Alpha Vantage: ${data.Information}`);
  }

  return data.feed ?? [];
}
