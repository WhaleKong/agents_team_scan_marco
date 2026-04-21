export interface NewsItem {
  headline: string;
  source: string;
  datetime: string;
  summary: string;
  url: string;
  tickers?: string[];
  impact?: "HIGH" | "MEDIUM" | "LOW";
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

export function deduplicateNews(
  items: NewsItem[],
  threshold = 0.6
): NewsItem[] {
  const result: NewsItem[] = [];
  const tokenCache = new Map<number, Set<string>>();

  for (let i = 0; i < items.length; i++) {
    const tokensI = tokenCache.get(i) ?? tokenize(items[i]!.headline);
    tokenCache.set(i, tokensI);

    let isDuplicate = false;
    for (let j = 0; j < result.length; j++) {
      const tokensJ = tokenize(result[j]!.headline);
      if (jaccardSimilarity(tokensI, tokensJ) > threshold) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      result.push(items[i]!);
    }
  }

  return result;
}
