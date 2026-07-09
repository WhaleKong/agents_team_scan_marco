import { RateLimiter } from "../utils/rate-limiter.js";

// Anonymous Socrata access is throttled; keep to 1 req/sec.
// Optional CFTC_APP_TOKEN (free registration) raises the ceiling.
const limiter = new RateLimiter(1, 1_000);

export interface CotRecord {
  report_date_as_yyyy_mm_dd: string;
  market_and_exchange_names: string;
  noncomm_positions_long_all: string;
  noncomm_positions_short_all: string;
  open_interest_all: string;
}

export async function getCotRecords(
  contractCode: string,
  limit = 60
): Promise<CotRecord[]> {
  await limiter.waitForSlot();

  const url = new URL("https://publicreporting.cftc.gov/resource/6dca-aqww.json");
  url.searchParams.set("cftc_contract_market_code", contractCode);
  url.searchParams.set("$order", "report_date_as_yyyy_mm_dd DESC");
  url.searchParams.set("$limit", String(limit));
  url.searchParams.set(
    "$select",
    "report_date_as_yyyy_mm_dd,market_and_exchange_names,noncomm_positions_long_all,noncomm_positions_short_all,open_interest_all"
  );

  const headers: Record<string, string> = {};
  if (process.env.CFTC_APP_TOKEN) {
    headers["X-App-Token"] = process.env.CFTC_APP_TOKEN;
  }

  const res = await fetch(url.toString(), {
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`CFTC ${contractCode}: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as CotRecord[];
}
