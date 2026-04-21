import { getNewsSentiment, SentimentArticle } from "../sources/alphavantage.js";

export async function getNewsSentimentForTickers(
  tickers: string,
  sort: string = "LATEST",
  limit: number = 15
): Promise<string> {
  const tickerList = tickers.split(",").map((t) => t.trim()).filter(Boolean);

  // Alpha Vantage free tier doesn't support multi-ticker queries.
  // Call each ticker individually and merge results.
  const allArticles: SentimentArticle[] = [];
  const errors: string[] = [];
  const perTickerLimit = Math.max(3, Math.ceil(limit / tickerList.length));

  for (const ticker of tickerList) {
    try {
      const articles = await getNewsSentiment({
        tickers: ticker,
        sort,
        limit: perTickerLimit,
      });
      allArticles.push(...articles);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${ticker}: ${msg}`);
    }
  }

  if (allArticles.length === 0) {
    const errDetail = errors.length > 0
      ? `\n\nErrors:\n${errors.map((e) => `- ${e}`).join("\n")}`
      : "";
    return `No sentiment data found for ${tickers}.${errDetail}`;
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const unique = allArticles.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  // Sort by time (newest first)
  unique.sort((a, b) => b.time_published.localeCompare(a.time_published));
  const final = unique.slice(0, limit);

  let output = `## News Sentiment — ${tickers}\n\n`;

  // Summary stats
  const scores = final.map((a) => a.overall_sentiment_score);
  const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length;
  const bullish = final.filter((a) => a.overall_sentiment_label.includes("Bullish")).length;
  const bearish = final.filter((a) => a.overall_sentiment_label.includes("Bearish")).length;
  const neutral = final.length - bullish - bearish;

  output += `### Aggregate\n`;
  output += `- Average Sentiment Score: **${avgScore.toFixed(4)}**\n`;
  output += `- Bullish: ${bullish} | Neutral: ${neutral} | Bearish: ${bearish}\n\n`;

  if (errors.length > 0) {
    output += `### Warnings\n`;
    for (const e of errors) {
      output += `- ${e}\n`;
    }
    output += `\n`;
  }

  output += `### Articles\n`;
  for (const a of final) {
    const score = a.overall_sentiment_score > 0 ? `+${a.overall_sentiment_score.toFixed(3)}` : a.overall_sentiment_score.toFixed(3);
    output += `- [${a.overall_sentiment_label}] (${score}) **${a.title}**\n`;
    output += `  Source: ${a.source} | ${a.time_published}\n`;
    if (a.ticker_sentiment?.length) {
      for (const ts of a.ticker_sentiment) {
        output += `  ${ts.ticker}: ${ts.ticker_sentiment_label} (${ts.ticker_sentiment_score})\n`;
      }
    }
    output += `\n`;
  }

  return output;
}
