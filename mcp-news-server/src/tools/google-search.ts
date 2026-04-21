import { searchGoogle, searchGoogleNews } from "../sources/serpapi.js";
import { deduplicateNews, type NewsItem } from "../utils/dedup.js";
import { classifyImpact } from "../utils/classify.js";

const TIME_FILTERS: Record<string, string> = {
  hour: "qdr:h",
  day: "qdr:d",
  week: "qdr:w",
  month: "qdr:m",
};

export async function googleNewsSearch(
  query: string,
  timeRange: string = "day",
  limit: number = 15
): Promise<string> {
  const timeFilter = TIME_FILTERS[timeRange];
  const results = await searchGoogleNews(query, { timeFilter, limit });

  if (results.length === 0) {
    return `No Google News results for: "${query}"`;
  }

  // Convert to NewsItem for dedup + classify
  const items: NewsItem[] = results.map((r) => ({
    headline: r.title,
    source: r.source?.name ?? "Google News",
    datetime: r.date ?? new Date().toISOString(),
    summary: r.snippet ?? "",
    url: r.link,
    impact: classifyImpact(r.title),
  }));

  const deduped = deduplicateNews(items);

  const high = deduped.filter((i) => i.impact === "HIGH");
  const medium = deduped.filter((i) => i.impact === "MEDIUM");
  const low = deduped.filter((i) => i.impact === "LOW");

  let output = `## Google News Search — "${query}"\n`;
  output += `Time: ${timeRange} | ${deduped.length} results (${results.length - deduped.length} dupes removed)\n\n`;

  if (high.length > 0) {
    output += `### HIGH IMPACT (${high.length})\n`;
    for (const item of high) {
      output += `- **${item.headline}**\n`;
      output += `  Source: ${item.source} | ${item.datetime}\n`;
      if (item.summary) output += `  ${item.summary.slice(0, 200)}\n`;
      output += `  ${item.url}\n\n`;
    }
  }

  if (medium.length > 0) {
    output += `### MEDIUM IMPACT (${medium.length})\n`;
    for (const item of medium) {
      output += `- ${item.headline}\n`;
      output += `  Source: ${item.source} | ${item.datetime}\n`;
      output += `  ${item.url}\n\n`;
    }
  }

  if (low.length > 0) {
    output += `### OTHER (${low.length})\n`;
    for (const item of low.slice(0, 5)) {
      output += `- ${item.headline} (${item.source})\n`;
    }
  }

  return output;
}

export async function googleMacroSearch(
  query: string,
  timeRange: string = "week",
  limit: number = 10
): Promise<string> {
  const timeFilter = TIME_FILTERS[timeRange];
  const { results, knowledgeGraph, answerBox } = await searchGoogle(query, {
    timeFilter,
    num: limit,
  });

  let output = `## Google Search — "${query}"\n\n`;

  if (answerBox) {
    output += `### Quick Answer\n> ${answerBox}\n\n`;
  }

  if (knowledgeGraph) {
    output += `### Knowledge Graph\n> ${knowledgeGraph}\n\n`;
  }

  if (results.length === 0) {
    output += "No results found.\n";
    return output;
  }

  output += `### Results (${results.length})\n`;
  for (const r of results) {
    output += `- **${r.title}**\n`;
    output += `  ${r.snippet}\n`;
    if (r.date) output += `  Date: ${r.date}\n`;
    output += `  ${r.link}\n\n`;
  }

  return output;
}
