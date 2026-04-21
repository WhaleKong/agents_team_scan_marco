import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { getBreakingNews } from "./tools/breaking-news.js";
import { getMarketNewsForSymbol } from "./tools/market-news.js";
import { getEconomicEvents } from "./tools/economic-calendar.js";
import { getNewsSentimentForTickers } from "./tools/news-sentiment.js";
import { searchNews } from "./tools/search-news.js";
import { getEarnings } from "./tools/earnings-calendar.js";
import { getRssFeeds } from "./tools/rss-feeds.js";
import { googleNewsSearch, googleMacroSearch } from "./tools/google-search.js";
import { getGoogleFinanceQuote, getGoogleMarketOverview } from "./tools/google-finance.js";

const server = new McpServer({
  name: "macro-news-feed",
  version: "1.0.0",
});

// Tool 1: Breaking News (Finnhub + RSS combined)
server.tool(
  "get_breaking_news",
  "Get latest market-moving news from Finnhub + RSS wire feeds (Reuters, CNBC, AP, Fed). Classified by impact level. Use this as the primary news scanning tool.",
  {
    category: z
      .enum(["general", "forex", "crypto", "merger"])
      .optional()
      .describe("News category filter (default: general)"),
    limit: z
      .number()
      .optional()
      .describe("Max number of results (default: 30)"),
  },
  async ({ category, limit }) => {
    try {
      const result = await getBreakingNews(category ?? "general", limit ?? 30);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err}` }],
        isError: true,
      };
    }
  }
);

// Tool 2: Market News by Symbol
server.tool(
  "get_market_news",
  "Get news for a specific stock/instrument symbol from Finnhub. Use for deep-dive into individual assets.",
  {
    symbol: z.string().describe("Ticker symbol (e.g., AAPL, MSFT, TSLA)"),
    from_date: z
      .string()
      .optional()
      .describe("Start date YYYY-MM-DD (default: 7 days ago)"),
    to_date: z
      .string()
      .optional()
      .describe("End date YYYY-MM-DD (default: today)"),
  },
  async ({ symbol, from_date, to_date }) => {
    try {
      const result = await getMarketNewsForSymbol(symbol, from_date, to_date);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err}` }],
        isError: true,
      };
    }
  }
);

// Tool 3: Economic Calendar
server.tool(
  "get_economic_calendar",
  "Get upcoming economic events (FOMC, CPI, NFP, GDP, PMI etc.) via Google Search. Returns links to economic calendars with event schedules and data releases.",
  {
    from_date: z
      .string()
      .optional()
      .describe("Start date YYYY-MM-DD (default: today)"),
    to_date: z
      .string()
      .optional()
      .describe("End date YYYY-MM-DD (default: 7 days ahead)"),
    country: z
      .string()
      .optional()
      .describe("Filter by country code (e.g., US, EU, JP)"),
    importance: z
      .enum(["low", "medium", "high"])
      .optional()
      .describe("Minimum importance level"),
  },
  async ({ from_date, to_date, country, importance }) => {
    try {
      const result = await getEconomicEvents(from_date, to_date, country, importance);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err}` }],
        isError: true,
      };
    }
  }
);

// Tool 4: News Sentiment (Alpha Vantage)
server.tool(
  "get_news_sentiment",
  "Get sentiment-scored news for specific tickers from Alpha Vantage. Returns bullish/bearish classification and scores.",
  {
    tickers: z
      .string()
      .describe("Comma-separated tickers (e.g., SPY,GLD,USO,QQQ)"),
    sort: z
      .enum(["LATEST", "EARLIEST", "RELEVANCE"])
      .optional()
      .describe("Sort order (default: LATEST)"),
    limit: z
      .number()
      .optional()
      .describe("Max results (default: 15)"),
  },
  async ({ tickers, sort, limit }) => {
    try {
      const result = await getNewsSentimentForTickers(
        tickers,
        sort ?? "LATEST",
        limit ?? 15
      );
      return { content: [{ type: "text" as const, text: result }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err}` }],
        isError: true,
      };
    }
  }
);

// Tool 5: Search News (NewsAPI)
server.tool(
  "search_news",
  "Search 150k+ news sources by keyword via NewsAPI. Use for targeted research on specific topics. Limited to 100 req/day on free tier — use sparingly.",
  {
    query: z
      .string()
      .describe('Search query (e.g., "Fed rate decision", "Iran Hormuz oil")'),
    from_date: z
      .string()
      .optional()
      .describe("Start date YYYY-MM-DD"),
    sort_by: z
      .enum(["publishedAt", "relevancy", "popularity"])
      .optional()
      .describe("Sort order (default: publishedAt)"),
    limit: z
      .number()
      .optional()
      .describe("Max results (default: 15)"),
  },
  async ({ query, from_date, sort_by, limit }) => {
    try {
      const result = await searchNews(
        query,
        from_date,
        sort_by ?? "publishedAt",
        limit ?? 15
      );
      return { content: [{ type: "text" as const, text: result }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err}` }],
        isError: true,
      };
    }
  }
);

// Tool 6: Earnings Calendar
server.tool(
  "get_earnings_calendar",
  "Get upcoming and recent earnings reports from Finnhub. Shows EPS estimates, actuals, and surprises.",
  {
    from_date: z
      .string()
      .optional()
      .describe("Start date YYYY-MM-DD (default: today)"),
    to_date: z
      .string()
      .optional()
      .describe("End date YYYY-MM-DD (default: 7 days ahead)"),
    symbol: z
      .string()
      .optional()
      .describe("Filter by symbol (e.g., AAPL)"),
  },
  async ({ from_date, to_date, symbol }) => {
    try {
      const result = await getEarnings(from_date, to_date, symbol);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err}` }],
        isError: true,
      };
    }
  }
);

// Tool 7: Raw RSS Feeds
server.tool(
  "get_rss_feeds",
  "Fetch latest items from curated financial RSS feeds (Reuters, CNBC, AP, Fed, MarketWatch, OilPrice, CoinDesk). Fastest free source for wire-service news.",
  {
    sources: z
      .array(z.string())
      .optional()
      .describe(
        "Filter by source names (e.g., ['Reuters World', 'CNBC Markets']). Omit for all feeds."
      ),
    limit: z
      .number()
      .optional()
      .describe("Max items to return (default: 30)"),
  },
  async ({ sources, limit }) => {
    try {
      const result = await getRssFeeds(sources, limit ?? 30);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err}` }],
        isError: true,
      };
    }
  }
);

// Tool 8: Google News Search (SerpAPI)
server.tool(
  "google_news_search",
  "Search Google News via SerpAPI for real-time news. Better freshness than NewsAPI — use for breaking news and time-sensitive queries. Requires SERPAPI_API_KEY. Free tier: 100 searches/month — use when Finnhub/RSS results are insufficient.",
  {
    query: z
      .string()
      .describe('Search query (e.g., "Fed rate decision", "OPEC oil production")'),
    time_range: z
      .enum(["hour", "day", "week", "month"])
      .optional()
      .describe("Time filter (default: day)"),
    limit: z
      .coerce.number()
      .optional()
      .describe("Max results (default: 15)"),
  },
  async ({ query, time_range, limit }) => {
    try {
      const result = await googleNewsSearch(query, time_range ?? "day", limit ?? 15);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err}` }],
        isError: true,
      };
    }
  }
);

// Tool 9: Google Search for Macro Research (SerpAPI)
server.tool(
  "google_macro_search",
  "Google web search via SerpAPI for macro research topics. Returns organic results + knowledge graph + answer box. Use for researching macro indicators, policy analysis, and economic data. Requires SERPAPI_API_KEY.",
  {
    query: z
      .string()
      .describe('Search query (e.g., "Fed balance sheet 2024", "US real GDP growth rate")'),
    time_range: z
      .enum(["hour", "day", "week", "month"])
      .optional()
      .describe("Time filter (default: week)"),
    limit: z
      .number()
      .optional()
      .describe("Max results (default: 10)"),
  },
  async ({ query, time_range, limit }) => {
    try {
      const result = await googleMacroSearch(query, time_range ?? "week", limit ?? 10);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err}` }],
        isError: true,
      };
    }
  }
);

// Tool 10: Google Finance Quote (SerpAPI)
server.tool(
  "google_finance_quote",
  "Get real-time stock/index/currency quote from Google Finance via SerpAPI. Returns price, change, related news, and price history. Use for quant-signal agent price checks. Requires SERPAPI_API_KEY.",
  {
    symbol: z
      .string()
      .describe("Ticker symbol (e.g., AAPL, BTC-USD). For ETFs use exchange format: SPY:NYSEARCA, QQQ:NASDAQ. Futures (GC=F) and forex (DX-Y.NYB) auto-remap to ETF proxies. Use google_market_overview for broad market snapshot."),
  },
  async ({ symbol }) => {
    try {
      const result = await getGoogleFinanceQuote(symbol);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err}` }],
        isError: true,
      };
    }
  }
);

// Tool 11: Google Finance Market Overview (SerpAPI)
server.tool(
  "google_market_overview",
  "Get broad market overview from Google Finance — US, Europe, Asia indices, currencies, and crypto. Use for quick portfolio-level market snapshot. Requires SERPAPI_API_KEY.",
  {},
  async () => {
    try {
      const result = await getGoogleMarketOverview();
      return { content: [{ type: "text" as const, text: result }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err}` }],
        isError: true,
      };
    }
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("macro-news-feed MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
