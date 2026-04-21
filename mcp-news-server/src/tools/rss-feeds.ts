import { fetchMultipleFeeds } from "../sources/rss.js";
import { RSS_FEEDS, RSS_FEED_MAP } from "../config/rss-sources.js";
import { classifyImpact } from "../utils/classify.js";

export async function getRssFeeds(
  sources?: string[],
  limit: number = 30
): Promise<string> {
  let feeds = RSS_FEEDS;

  if (sources && sources.length > 0) {
    feeds = sources
      .map((s) => RSS_FEED_MAP[s.toLowerCase().replace(/\s+/g, "_")])
      .filter((f): f is (typeof RSS_FEEDS)[number] => f !== undefined);

    if (feeds.length === 0) {
      const available = RSS_FEEDS.map((f) => f.name).join(", ");
      return `No matching RSS sources found. Available: ${available}`;
    }
  }

  const items = await fetchMultipleFeeds(feeds, limit);

  if (items.length === 0) {
    return "No RSS items fetched. Feeds may be temporarily unavailable.";
  }

  let output = `## RSS Feed — ${new Date().toISOString().slice(0, 16)}\n`;
  output += `Sources: ${feeds.map((f) => f.name).join(", ")}\n\n`;

  for (const item of items) {
    const impact = classifyImpact(item.title);
    const marker = impact === "HIGH" ? "**" : "";
    const tag = impact !== "LOW" ? ` [${impact}]` : "";
    output += `- ${marker}${item.title}${marker}${tag}\n`;
    output += `  Source: ${item.source} | ${item.pubDate}\n`;
    if (item.contentSnippet) output += `  ${item.contentSnippet.slice(0, 150)}\n`;
    output += `  ${item.link}\n\n`;
  }

  return output;
}
