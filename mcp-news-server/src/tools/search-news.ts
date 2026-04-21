import { searchEverything } from "../sources/newsapi.js";

export async function searchNews(
  query: string,
  fromDate?: string,
  sortBy: string = "publishedAt",
  limit: number = 15
): Promise<string> {
  const articles = await searchEverything(query, { from: fromDate, sortBy, pageSize: limit });

  if (articles.length === 0) {
    return `No articles found for query: "${query}"`;
  }

  let output = `## News Search — "${query}"\n\n`;
  output += `Found ${articles.length} articles\n\n`;

  for (const a of articles) {
    output += `- **${a.title}**\n`;
    output += `  Source: ${a.source.name} | ${a.publishedAt}\n`;
    if (a.description) output += `  ${a.description.slice(0, 200)}\n`;
    output += `  ${a.url}\n\n`;
  }

  return output;
}
