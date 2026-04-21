import { getFinanceQuote, getMarketOverview } from "../sources/serpapi.js";

// SerpAPI google_finance requires exchange-qualified symbols for most tickers
// e.g., "AAPL:NASDAQ", "SPY:NYSEARCA", "GLD:NYSEARCA"
const EXCHANGE_HINTS: Record<string, string> = {
  // Major ETFs
  SPY: "SPY:NYSEARCA",
  QQQ: "QQQ:NASDAQ",
  IWM: "IWM:NYSEARCA",
  DIA: "DIA:NYSEARCA",
  TLT: "TLT:NASDAQ",
  GLD: "GLD:NYSEARCA",
  SLV: "SLV:NYSEARCA",
  USO: "USO:NYSEARCA",
  UNG: "UNG:NYSEARCA",
  EEM: "EEM:NYSEARCA",
  EFA: "EFA:NYSEARCA",
  XLE: "XLE:NYSEARCA",
  XLF: "XLF:NYSEARCA",
  XLK: "XLK:NYSEARCA",
  HYG: "HYG:NYSEARCA",
  LQD: "LQD:NYSEARCA",
  VIX: "VIX:INDEXCBOE",
  // Major indices
  "^GSPC": ".INX:INDEXSP",
  "^DJI": ".DJI:INDEXDJX",
  "^IXIC": ".IXIC:INDEXNASDAQ",
  // Forex — use currency pair format
  "DX-Y.NYB": "USD-EUR",  // DXY not directly supported, fallback
  // Futures — not supported by google_finance engine
  "GC=F": "GLD:NYSEARCA",   // Gold futures → Gold ETF fallback
  "CL=F": "USO:NYSEARCA",   // Crude futures → Oil ETF fallback
  "SI=F": "SLV:NYSEARCA",   // Silver futures → Silver ETF fallback
  // Bonds — use ETF fallback
  "^TNX": "TLT:NASDAQ",     // 10Y yield → Bond ETF fallback
  "^TYX": "TLT:NASDAQ",     // 30Y yield → Bond ETF fallback
};

export async function getGoogleFinanceQuote(symbol: string): Promise<string> {
  // Try original symbol first, then exchange-qualified version
  const qualifiedSymbol = EXCHANGE_HINTS[symbol];
  const attempts = qualifiedSymbol ? [qualifiedSymbol, symbol] : [symbol];

  let lastResult: Awaited<ReturnType<typeof getFinanceQuote>> | null = null;
  let usedSymbol = symbol;

  for (const trySymbol of attempts) {
    try {
      const result = await getFinanceQuote(trySymbol);
      if (result.quote) {
        lastResult = result;
        usedSymbol = trySymbol;
        break;
      }
      lastResult = result;
    } catch {
      continue;
    }
  }

  if (!lastResult?.quote) {
    const isFutures = symbol.includes("=F");
    const isForex = symbol.includes("DX-Y") || symbol.includes("USD") || symbol.includes("JPY");
    const isBond = symbol.startsWith("^T");

    let hint = "";
    if (isFutures) {
      hint = `\n- Futures symbols (${symbol}) are not supported by SerpAPI google_finance.\n- Use google_market_overview for broad market prices, or google_macro_search to find current prices.`;
    } else if (isForex) {
      hint = `\n- Forex/DXY symbols may not be supported. Use google_market_overview for currency data.`;
    } else if (isBond) {
      hint = `\n- Bond yield indices are not supported. Use google_macro_search with query "10 year Treasury yield" instead.`;
    } else {
      hint = `\n- Try exchange-qualified format: ${symbol}:NASDAQ or ${symbol}:NYSE\n- Use google_market_overview for major indices and currencies.`;
    }

    return `No finance data found for: ${symbol}${hint}`;
  }

  const quote = lastResult.quote;
  const news = lastResult.news;
  const graph = lastResult.graph;

  const wasRemapped = usedSymbol !== symbol;
  const direction = parseFloat(quote.priceChange) >= 0 ? "▲" : "▼";

  let output = `## Google Finance — ${quote.name} (${quote.symbol})\n\n`;
  if (wasRemapped) {
    output += `> Note: ${symbol} remapped to ${usedSymbol} (ETF proxy)\n\n`;
  }
  output += `| Field     | Value |\n`;
  output += `|-----------|-------|\n`;
  output += `| Price     | ${quote.price} ${quote.currency} |\n`;
  output += `| Change    | ${direction} ${quote.priceChange} (${quote.priceChangePercent}%) |\n`;
  if (quote.market) output += `| Exchange  | ${quote.market} |\n`;

  // Recent price history from graph
  if (graph.length > 0) {
    const recent = graph.slice(-5);
    output += `\n### Recent Price History\n`;
    for (const p of recent) {
      output += `- ${p.date}: ${p.price}\n`;
    }
  }

  // Related news
  if (news.length > 0) {
    output += `\n### Related News (${news.length})\n`;
    for (const n of news.slice(0, 5)) {
      output += `- **${n.title}**\n`;
      output += `  Source: ${n.source} | ${n.date}\n`;
      if (n.snippet) output += `  ${n.snippet.slice(0, 200)}\n`;
      output += `  ${n.link}\n\n`;
    }
  }

  return output;
}

export async function getGoogleMarketOverview(): Promise<string> {
  const markets = await getMarketOverview();

  if (!markets) {
    return "No market overview data available.";
  }

  let output = `## Market Overview — ${new Date().toISOString().slice(0, 16)}\n\n`;

  const sections: { key: keyof NonNullable<typeof markets>; label: string }[] = [
    { key: "us", label: "US Markets" },
    { key: "europe", label: "Europe" },
    { key: "asia", label: "Asia" },
    { key: "currencies", label: "Currencies" },
    { key: "crypto", label: "Crypto" },
  ];

  for (const { key, label } of sections) {
    const items = markets[key];
    if (!items || items.length === 0) continue;

    output += `### ${label}\n`;
    output += `| Name | Price | Change |\n`;
    output += `|------|-------|--------|\n`;
    for (const item of items.slice(0, 8)) {
      const dir = item.price_movement?.movement === "Up" ? "▲" : "▼";
      const pct = item.price_movement?.percentage ?? 0;
      output += `| ${item.name} | ${item.extracted_price ?? item.price} | ${dir} ${pct}% |\n`;
    }
    output += `\n`;
  }

  return output;
}
