import { RateLimiter } from "../utils/rate-limiter.js";

const limiter = new RateLimiter(100, 60_000); // FRED allows 120 req/min; keep a buffer.

function getApiKey(): string {
  const key = process.env.FRED_API_KEY;
  if (!key) throw new Error("FRED_API_KEY not set");
  return key;
}

export interface FredObservation {
  date: string;
  value: string;
}

interface FredObservationResponse {
  observations?: FredObservation[];
  error_code?: number;
  error_message?: string;
}

export async function getFredObservations(
  seriesId: string,
  options: {
    limit?: number;
    observationStart?: string;
    observationEnd?: string;
    sortOrder?: "asc" | "desc";
  } = {}
): Promise<FredObservation[]> {
  await limiter.waitForSlot();

  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("api_key", getApiKey());
  url.searchParams.set("file_type", "json");
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("sort_order", options.sortOrder ?? "desc");
  url.searchParams.set("limit", String(options.limit ?? 24));

  if (options.observationStart) {
    url.searchParams.set("observation_start", options.observationStart);
  }
  if (options.observationEnd) {
    url.searchParams.set("observation_end", options.observationEnd);
  }

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`FRED ${seriesId}: ${res.status} ${res.statusText}`);

  const data = (await res.json()) as FredObservationResponse;
  if (data.error_message) {
    throw new Error(`FRED ${seriesId}: ${data.error_message}`);
  }

  return data.observations ?? [];
}

interface FredReleaseDatesResponse {
  release_dates?: { release_id: number; date: string }[];
  error_code?: number;
  error_message?: string;
}

/**
 * Upcoming/past release dates for a FRED release ID within [realtimeStart, realtimeEnd].
 * include_release_dates_with_no_data is required — future dates have no data attached
 * and are omitted without it. Returns deduped dates ascending (revisions can duplicate).
 */
export async function getFredReleaseDates(
  releaseId: number,
  options: { realtimeStart: string; realtimeEnd: string }
): Promise<string[]> {
  await limiter.waitForSlot();

  const url = new URL("https://api.stlouisfed.org/fred/release/dates");
  url.searchParams.set("api_key", getApiKey());
  url.searchParams.set("file_type", "json");
  url.searchParams.set("release_id", String(releaseId));
  url.searchParams.set("include_release_dates_with_no_data", "true");
  url.searchParams.set("realtime_start", options.realtimeStart);
  url.searchParams.set("realtime_end", options.realtimeEnd);
  url.searchParams.set("sort_order", "asc");

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`FRED release ${releaseId}: ${res.status} ${res.statusText}`);

  const data = (await res.json()) as FredReleaseDatesResponse;
  if (data.error_message) {
    throw new Error(`FRED release ${releaseId}: ${data.error_message}`);
  }

  return [...new Set((data.release_dates ?? []).map((rd) => rd.date))];
}
