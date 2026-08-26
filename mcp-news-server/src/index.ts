import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { getBreakingNews } from "./tools/breaking-news.js";
import { getMarketNewsForSymbol } from "./tools/market-news.js";
import { getReleaseCalendar } from "./tools/release-calendar.js";
import { getNewsSentimentForTickers } from "./tools/news-sentiment.js";
import { searchNews } from "./tools/search-news.js";
import { getEarnings } from "./tools/earnings-calendar.js";
import { getRssFeeds } from "./tools/rss-feeds.js";
import { googleNewsSearch, googleMacroSearch } from "./tools/google-search.js";
import { getGoogleFinanceQuote, getGoogleMarketOverview } from "./tools/google-finance.js";
import { getFredMacroData } from "./tools/fred-macro.js";
import { getCotPositioning } from "./tools/cot-positioning.js";

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

// Tool 3: US Economic Release Calendar (FRED release dates + FOMC schedule)
server.tool(
  "get_release_calendar",
  "Get upcoming economic release dates with times (ET): US releases (CPI, NFP/Employment Situation, Core PCE, GDP, PPI) from the FRED release calendar, scheduled FOMC decisions, and RBA (Australia) cash rate decisions. Use to check event risk inside a swing-trade holding window. RBA announces 14:30 Sydney, which converts to the PREVIOUS ET day when Sydney is on daylight saving. Australian data (jobs, CPI) and Chinese data are NOT covered. Requires FRED_API_KEY.",
  {
    days_ahead: z
      .number()
      .optional()
      .describe("How many days ahead to look (default: 14, max: 90)"),
    events: z
      .string()
      .optional()
      .describe('Optional comma-separated event filter, e.g. "CPI,FOMC" or "NFP". Omit for all tracked events.'),
  },
  async ({ days_ahead, events }) => {
    try {
      const result = await getReleaseCalendar(days_ahead ?? 14, events);
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

// Tool 12: FRED Macro Data
server.tool(
  "get_fred_macro_data",
  "Get FRED macro series with trend context: latest value, Δ vs previous, 3M change, 1Y change, YoY %, and direction-aware rate-of-change acceleration (rising/falling faster or slower) per series. The built-in growth set uses real GDP growth (QoQ SAAR), core CPI, Core PCE, and total payroll employment. Categories: liquidity, rates/credit, growth/inflation, and markets (Broad USD, VIX, 10Y real yield, 10Y-3M, IG OAS, NFCI). Primary hard-data source for macro regime and bias analysis. Requires FRED_API_KEY.",
  {
    category: z
      .enum(["all", "liquidity", "rates_credit", "growth_inflation", "markets"])
      .optional()
      .describe("Macro category to fetch (default: all). 'markets' = daily USD/VIX/real-rates/curve/credit series for bias checks."),
    series_ids: z
      .string()
      .optional()
      .describe("Optional comma-separated FRED series IDs. Overrides category."),
    limit: z
      .number()
      .optional()
      .describe("Override observations fetched per series (default: auto by series frequency, enough for 1Y trend analysis)"),
    observation_start: z
      .string()
      .optional()
      .describe("Optional FRED observation_start date YYYY-MM-DD"),
    observation_end: z
      .string()
      .optional()
      .describe("Optional FRED observation_end date YYYY-MM-DD"),
  },
  async ({ category, series_ids, limit, observation_start, observation_end }) => {
    try {
      const result = await getFredMacroData(
        category ?? "all",
        series_ids,
        limit,
        observation_start,
        observation_end
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

// Tool 13: CFTC COT Positioning
server.tool(
  "get_cot_positioning",
  "Get CFTC Commitments of Traders (COT) non-commercial futures positioning for Gold, Euro FX, Japanese Yen, USD Index, Australian Dollar, Swiss Franc, E-mini S&P 500, and Nasdaq-100: net position, weekly change, % of open interest, and 52-week percentile (crowdedness — >=90 crowded long, <=10 crowded short). Free CFTC public API, no key required. Data as-of Tuesday, published Friday ~15:30 ET.",
  {
    markets: z
      .string()
      .optional()
      .describe('Optional comma-separated market filter, e.g. "gold,euro", "aud", "chf", or "s&p,nasdaq". Omit for all eight markets.'),
  },
  async ({ markets }) => {
    try {
      const result = await getCotPositioning(markets);
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
