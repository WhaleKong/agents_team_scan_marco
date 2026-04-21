import Parser from "rss-parser";

const parser = new Parser({
  timeout: 8_000,
  headers: {
    "User-Agent": "MacroNewsFeed/1.0",
  },
});

export interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet: string;
  source: string;
}

export async function fetchFeed(url: string, sourceName: string): Promise<RssItem[]> {
  try {
    const feed = await parser.parseURL(url);
    return (feed.items ?? []).map((item) => ({
      title: item.title ?? "(no title)",
      link: item.link ?? "",
      pubDate: item.pubDate ?? item.isoDate ?? "",
      contentSnippet: (item.contentSnippet ?? item.content ?? "").slice(0, 300),
      source: sourceName,
    }));
  } catch (err) {
    console.error(`RSS fetch failed for ${sourceName} (${url}): ${err}`);
    return [];
  }
}

export async function fetchMultipleFeeds(
  feeds: { url: string; name: string }[],
  limit = 50
): Promise<RssItem[]> {
  const results = await Promise.allSettled(
    feeds.map((f) => fetchFeed(f.url, f.name))
  );

  const allItems: RssItem[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value);
    }
  }

  // Sort by date, most recent first
  allItems.sort((a, b) => {
    const dateA = new Date(a.pubDate).getTime() || 0;
    const dateB = new Date(b.pubDate).getTime() || 0;
    return dateB - dateA;
  });

  return allItems.slice(0, limit);
}
