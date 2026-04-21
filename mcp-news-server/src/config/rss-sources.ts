export const RSS_FEEDS = [
  // Wire Services (fastest for breaking news)
  { name: "Reuters World", url: "https://feeds.reuters.com/reuters/worldNews" },
  { name: "Reuters Business", url: "https://feeds.reuters.com/reuters/businessNews" },
  { name: "AP Top News", url: "https://rsshub.app/apnews/topics/apf-topnews" },

  // Central Banks (critical for this system)
  { name: "Fed Press Releases", url: "https://www.federalreserve.gov/feeds/press_all.xml" },

  // Financial News
  { name: "CNBC Top News", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114" },
  { name: "CNBC World", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100727362" },
  { name: "CNBC Markets", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258" },
  { name: "MarketWatch Top", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
  { name: "MarketWatch Markets", url: "https://feeds.content.dowjones.io/public/rss/mw_marketpulse" },

  // Commodities & Energy
  { name: "OilPrice", url: "https://oilprice.com/rss/main" },

  // Crypto (liquidity proxy)
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },

  // Macro / Economics
  { name: "Calculated Risk", url: "https://www.calculatedriskblog.com/feeds/posts/default?alt=rss" },
];

export const RSS_FEED_MAP = Object.fromEntries(
  RSS_FEEDS.map((f) => [f.name.toLowerCase().replace(/\s+/g, "_"), f])
);
