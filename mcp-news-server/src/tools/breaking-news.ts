import { getGeneralNews, type FinnhubNewsItem } from "../sources/finnhub.js";
import { fetchMultipleFeeds } from "../sources/rss.js";
import { searchGoogleNews } from "../sources/serpapi.js";
import { RSS_FEEDS } from "../config/rss-sources.js";
import { deduplicateNews, type NewsItem } from "../utils/dedup.js";
import { classifyImpact } from "../utils/classify.js";

function finnhubToNewsItem(item: FinnhubNewsItem): NewsItem {
  return {
    headline: item.headline,
    source: item.source,
    datetime: new Date(item.datetime * 1000).toISOString(),
    summary: item.summary.slice(0, 300),
    url: item.url,
    tickers: item.related ? item.related.split(",").filter(Boolean) : [],
  };
}

// Map categories to Google News search queries for enrichment
const CATEGORY_QUERIES: Record<string, string> = {
  general: "stock market economy finance",
  forex: "forex currency exchange rate",
  crypto: "cryptocurrency bitcoin ethereum",
  merger: "merger acquisition deal",
};

export async function getBreakingNews(
  category: string = "general",
  limit: number = 30
): Promise<string> {
  const serpQuery = CATEGORY_QUERIES[category] ?? CATEGORY_QUERIES.general;
  const hasSerpApiKey = !!process.env.SERPAPI_API_KEY;

  const fetches: Promise<unknown>[] = [
    getGeneralNews(category),
    fetchMultipleFeeds(RSS_FEEDS, 50),
  ];

  // Only call SerpAPI if key is configured
  if (hasSerpApiKey) {
    fetches.push(searchGoogleNews(serpQuery, { timeFilter: "qdr:d", limit: 20 }));
  }

  const results = await Promise.allSettled(fetches);
  const [finnhubNews, rssNews, serpNews] = results;

  const items: NewsItem[] = [];
  const sources: string[] = [];

  if (finnhubNews!.status === "fulfilled") {
    const val = finnhubNews!.value as FinnhubNewsItem[];
    items.push(...val.map(finnhubToNewsItem));
    sources.push("Finnhub");
  } else {
    console.error("Finnhub fetch failed:", (finnhubNews as PromiseRejectedResult).reason);
  }

  if (rssNews!.status === "fulfilled") {
    const val = rssNews!.value as { title: string; source: string; pubDate: string; contentSnippet: string; link: string }[];
    items.push(
      ...val.map((r) => ({
        headline: r.title,
        source: r.source,
        datetime: r.pubDate ? new Date(r.pubDate).toISOString() : new Date().toISOString(),
        summary: r.contentSnippet,
        url: r.link,
      }))
    );
    sources.push(`${RSS_FEEDS.length} RSS`);
  } else {
    console.error("RSS fetch failed:", (rssNews as PromiseRejectedResult).reason);
  }

  if (hasSerpApiKey && serpNews) {
    if (serpNews.status === "fulfilled") {
      const val = serpNews.value as { title: string; source?: { name: string }; date?: string; snippet?: string; link: string }[];
      items.push(
        ...val.map((r) => ({
          headline: r.title,
          source: `Google News (${r.source?.name ?? "unknown"})`,
          datetime: r.date ?? new Date().toISOString(),
          summary: r.snippet ?? "",
          url: r.link,
        }))
      );
      sources.push("Google News");
    } else {
      console.error("SerpAPI fetch failed:", (serpNews as PromiseRejectedResult).reason);
    }
  }

  // Classify impact
  for (const item of items) {
    item.impact = classifyImpact(item.headline);
  }

  // Sort by datetime descending
  items.sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());

  // Deduplicate
  const deduped = deduplicateNews(items).slice(0, limit);

  // Format output
  const high = deduped.filter((i) => i.impact === "HIGH");
  const medium = deduped.filter((i) => i.impact === "MEDIUM");
  const low = deduped.filter((i) => i.impact === "LOW");

  let output = `## Breaking News Feed — ${new Date().toISOString().slice(0, 16)}\n`;
  output += `Sources: ${sources.join(" + ")} | ${deduped.length} items (${items.length - deduped.length} duplicates removed)\n\n`;

  if (high.length > 0) {
    output += `### HIGH IMPACT (${high.length})\n`;
    for (const item of high) {
      output += `- **${item.headline}**\n`;
      output += `  Source: ${item.source} | ${item.datetime}\n`;
      if (item.summary) output += `  ${item.summary}\n`;
      if (item.tickers?.length) output += `  Tickers: ${item.tickers.join(", ")}\n`;
      output += `  ${item.url}\n\n`;
    }
  }

  if (medium.length > 0) {
    output += `### MEDIUM IMPACT (${medium.length})\n`;
    for (const item of medium) {
      output += `- ${item.headline}\n`;
      output += `  Source: ${item.source} | ${item.datetime}\n`;
      if (item.summary) output += `  ${item.summary}\n`;
      output += `  ${item.url}\n\n`;
    }
  }

  if (low.length > 0) {
    output += `### OTHER (${low.length})\n`;
    for (const item of low.slice(0, 10)) {
      output += `- ${item.headline} (${item.source}, ${item.datetime})\n`;
    }
  }

  return output;
}
