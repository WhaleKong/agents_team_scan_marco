import { getFredReleaseDates } from "../sources/fred.js";
import { FOMC_DECISION_DATES } from "../config/fomc-schedule.js";

export interface ReleaseCalendarEntry {
  date: string; // YYYY-MM-DD
  event: string;
  timeEt: string;
  importance: "HIGH" | "MEDIUM";
}

interface CuratedRelease {
  releaseId: number;
  event: string;
  timeEt: string;
  importance: "HIGH" | "MEDIUM";
}

// FRED release IDs verified against /fred/releases on 2026-07-05.
const CURATED_RELEASES: CuratedRelease[] = [
  { releaseId: 10, event: "CPI", timeEt: "08:30", importance: "HIGH" },
  { releaseId: 50, event: "Employment Situation (NFP)", timeEt: "08:30", importance: "HIGH" },
  { releaseId: 54, event: "Core PCE (Personal Income & Outlays)", timeEt: "08:30", importance: "HIGH" },
  { releaseId: 53, event: "GDP", timeEt: "08:30", importance: "MEDIUM" },
  { releaseId: 46, event: "PPI", timeEt: "08:30", importance: "MEDIUM" },
];

const FOMC_EVENT_NAME = "FOMC Rate Decision";

const DAY_MS = 86_400_000;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toUtcMs(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

function addDays(date: string, days: number): string {
  return new Date(toUtcMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}

function dayName(date: string): string {
  return DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

function parseEventFilter(events?: string): string[] {
  if (!events) return [];
  return events
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function matchesFilter(eventName: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const name = eventName.toLowerCase();
  return tokens.some((t) => name.includes(t));
}

export function fomcEntries(): ReleaseCalendarEntry[] {
  return FOMC_DECISION_DATES.map((date) => ({
    date,
    event: FOMC_EVENT_NAME,
    timeEt: "14:00 (press conf 14:30)",
    importance: "HIGH" as const,
  }));
}

/**
 * Pure formatter: windows, filters, dedupes, sorts, and renders entries.
 * Fetch-free so it is unit-testable with synthetic data and a fixed asOf.
 */
export function formatReleaseCalendar(
  entries: ReleaseCalendarEntry[],
  asOf: string,
  daysAhead: number,
  events?: string,
  notes: string[] = []
): string {
  const windowEnd = addDays(asOf, daysAhead);
  const tokens = parseEventFilter(events);

  const seen = new Set<string>();
  const rows = entries
    .filter((e) => e.date >= asOf && e.date <= windowEnd)
    .filter((e) => matchesFilter(e.event, tokens))
    .filter((e) => {
      const key = `${e.date}|${e.event}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (a.date === b.date ? a.event.localeCompare(b.event) : a.date.localeCompare(b.date)));

  let output = `## US Economic Release Calendar — ${asOf} to ${windowEnd}\n\n`;

  if (rows.length === 0) {
    output += `No tracked releases inside this window.\n`;
  } else {
    output += `| Date | Day | Event | Time (ET) | Importance |\n`;
    output += `|------|-----|-------|-----------|------------|\n`;
    for (const r of rows) {
      output += `| ${r.date} | ${dayName(r.date)} | ${r.event} | ${r.timeEt} | ${r.importance} |\n`;
    }
  }

  const lastFomc = FOMC_DECISION_DATES[FOMC_DECISION_DATES.length - 1];
  if (windowEnd > lastFomc) {
    output += `\nWARNING: FOMC schedule constant ends ${lastFomc} — update src/config/fomc-schedule.ts from federalreserve.gov/monetarypolicy/fomccalendars.htm\n`;
  }

  for (const note of notes) {
    output += `\nNOTE: ${note}\n`;
  }

  output += `\nAll times US Eastern. Sources: FRED release calendar (CPI, NFP, Core PCE, GDP, PPI) + scheduled FOMC decisions. `;
  output += `ISM PMI is not carried by FRED — check news for its date (1st/3rd business day of the month).\n`;
  return output;
}

export async function getReleaseCalendar(
  daysAhead: number = 14,
  events?: string
): Promise<string> {
  const clampedDays = Math.min(Math.max(Math.floor(daysAhead), 1), 90);
  const asOf = new Date().toISOString().slice(0, 10);
  const windowEnd = addDays(asOf, clampedDays);
  const tokens = parseEventFilter(events);

  // Only hit FRED for releases the filter can match — each release is one API call.
  const wanted = CURATED_RELEASES.filter((r) => matchesFilter(r.event, tokens));

  const results = await Promise.allSettled(
    wanted.map(async (release) => {
      const dates = await getFredReleaseDates(release.releaseId, {
        realtimeStart: asOf,
        realtimeEnd: windowEnd,
      });
      return dates.map((date) => ({
        date,
        event: release.event,
        timeEt: release.timeEt,
        importance: release.importance,
      }));
    })
  );

  const entries: ReleaseCalendarEntry[] = [];
  const notes: string[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      entries.push(...result.value);
    } else {
      notes.push(`${wanted[i].event}: fetch failed (${result.reason}) — dates missing from this table.`);
    }
  });

  entries.push(...fomcEntries());

  return formatReleaseCalendar(entries, asOf, clampedDays, events, notes);
}
