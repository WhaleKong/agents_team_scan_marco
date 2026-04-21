import { getCompanyNews } from "../sources/finnhub.js";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function getMarketNewsForSymbol(
  symbol: string,
  fromDate?: string,
  toDate?: string
): Promise<string> {
  const from = fromDate ?? daysAgo(7);
  const to = toDate ?? todayStr();

  const news = await getCompanyNews(symbol, from, to);

  if (news.length === 0) {
    return `No news found for ${symbol} from ${from} to ${to}`;
  }

  let output = `## Market News — ${symbol} (${from} to ${to})\n\n`;
  output += `Found ${news.length} articles\n\n`;

  for (const item of news.slice(0, 20)) {
    const dt = new Date(item.datetime * 1000).toISOString().slice(0, 16);
    output += `- **${item.headline}**\n`;
    output += `  Source: ${item.source} | ${dt}\n`;
    if (item.summary) output += `  ${item.summary.slice(0, 200)}\n`;
    output += `  ${item.url}\n\n`;
  }

  return output;
}
