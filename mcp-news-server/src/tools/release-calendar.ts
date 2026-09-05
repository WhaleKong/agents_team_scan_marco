import { getFredReleaseDates } from "../sources/fred.js";
import { FOMC_DECISION_DATES } from "../config/fomc-schedule.js";
import {
  RBA_DECISION_DATES_SYDNEY,
  RBA_ANNOUNCEMENT_TIME_SYDNEY,
  RBA_TIME_ZONE,
} from "../config/rba-schedule.js";

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
const RBA_EVENT_NAME = "RBA Rate Decision (Australia)";
const ET_TIME_ZONE = "America/New_York";

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

type ReleaseStatus = "RELEASED" | "TODAY" | "UPCOMING";

/** Where a row sits relative to asOf. TODAY rows may or may not be out yet — compare the time. */
function releaseStatus(date: string, asOf: string): ReleaseStatus {
  if (date < asOf) return "RELEASED";
  if (date === asOf) return "TODAY";
  return "UPCOMING";
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

/** Wall-clock fields for an instant, read out of the IANA database. */
function zonedParts(at: Date, timeZone: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);

  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** Offset of `timeZone` from UTC at `at`, in ms (east of UTC is positive). */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const p = zonedParts(at, timeZone);
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24, // Intl renders midnight as "24" in some ICU versions
    Number(p.minute),
    Number(p.second)
  );
  return asUtc - at.getTime();
}

/** Convert a wall-clock date+time in `timeZone` to the UTC instant it names. */
function zonedTimeToUtc(date: string, timeHm: string, timeZone: string): Date {
  const naive = new Date(`${date}T${timeHm}:00Z`);
  const firstGuess = new Date(naive.getTime() - zoneOffsetMs(naive, timeZone));
  // Re-read the offset at the guessed instant: if the naive guess fell on the
  // far side of a DST transition the two offsets differ and the second wins.
  const settled = zoneOffsetMs(firstGuess, timeZone);
  return new Date(naive.getTime() - settled);
}

/**
 * RBA decisions rendered in ET. The announcement is 14:30 Sydney, which lands
 * on the PREVIOUS calendar day in New York whenever Sydney is on daylight
 * saving — so the date is derived, never assumed to equal the Sydney date.
 */
export function rbaEntries(): ReleaseCalendarEntry[] {
  return RBA_DECISION_DATES_SYDNEY.map((sydneyDate) => {
    const instant = zonedTimeToUtc(sydneyDate, RBA_ANNOUNCEMENT_TIME_SYDNEY, RBA_TIME_ZONE);
    const et = zonedParts(instant, ET_TIME_ZONE);
    return {
      date: `${et.year}-${et.month}-${et.day}`,
      event: RBA_EVENT_NAME,
      timeEt: `${String(Number(et.hour) % 24).padStart(2, "0")}:${et.minute}`,
      importance: "HIGH" as const,
    };
  });
}

/** Latest ET date the RBA constant covers — used for the staleness warning. */
function lastRbaEtDate(): string {
  return rbaEntries()
    .map((e) => e.date)
    .sort()
    .slice(-1)[0];
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
  notes: string[] = [],
  daysBack: number = 0
): string {
  const windowStart = addDays(asOf, -daysBack);
  const windowEnd = addDays(asOf, daysAhead);
  const tokens = parseEventFilter(events);

  const seen = new Set<string>();
  const rows = entries
    .filter((e) => e.date >= windowStart && e.date <= windowEnd)
    .filter((e) => matchesFilter(e.event, tokens))
    .filter((e) => {
      const key = `${e.date}|${e.event}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (a.date === b.date ? a.event.localeCompare(b.event) : a.date.localeCompare(b.date)));

  let output = `## Economic Release Calendar — ${windowStart} to ${windowEnd}\n\n`;

  if (rows.length === 0) {
    output += `No tracked releases inside this window.\n`;
  } else {
    output += `| Date | Day | Event | Time (ET) | Importance | Status |\n`;
    output += `|------|-----|-------|-----------|------------|--------|\n`;
    for (const r of rows) {
      output += `| ${r.date} | ${dayName(r.date)} | ${r.event} | ${r.timeEt} | ${r.importance} | ${releaseStatus(r.date, asOf)} |\n`;
    }
  }

  const lastFomc = FOMC_DECISION_DATES[FOMC_DECISION_DATES.length - 1];
  if (windowEnd > lastFomc) {
    output += `\nWARNING: FOMC schedule constant ends ${lastFomc} — update src/config/fomc-schedule.ts from federalreserve.gov/monetarypolicy/fomccalendars.htm\n`;
  }

  const lastRba = lastRbaEtDate();
  if (windowEnd > lastRba) {
    output += `\nWARNING: RBA schedule constant ends ${lastRba} (ET) — update src/config/rba-schedule.ts from rba.gov.au/schedules-events/board-meeting-schedules.html\n`;
  }

  if (daysBack > 0) {
    output += `\nRELEASED rows occurred before ${asOf} (look-back ${daysBack} days). `;
    output += `Compare each RELEASED/TODAY row's date + time (ET) with the regime report's mtime in ET: `;
    output += `a HIGH row that landed after that mtime means the regime report is SUPERSEDED.\n`;
  }

  for (const note of notes) {
    output += `\nNOTE: ${note}\n`;
  }

  output += `\nAll times US Eastern. Sources: FRED release calendar (CPI, NFP, Core PCE, GDP, PPI) + scheduled FOMC decisions `;
  output += `+ RBA Monetary Policy Board decisions (announced 14:30 Sydney, converted to ET — note this falls on the PREVIOUS ET day when Sydney is on daylight saving). `;
  output += `ISM PMI is not carried by FRED — check news for its date (1st/3rd business day of the month). `;
  output += `Australian data (jobs, CPI) and Chinese data are NOT covered.\n`;
  return output;
}

export async function getReleaseCalendar(
  daysAhead: number = 14,
  events?: string,
  daysBack: number = 0
): Promise<string> {
  const clampedDays = Math.min(Math.max(Math.floor(daysAhead), 1), 90);
  const clampedBack = Math.min(Math.max(Math.floor(daysBack), 0), 30);
  const asOf = new Date().toISOString().slice(0, 10);
  const windowStart = addDays(asOf, -clampedBack);
  const windowEnd = addDays(asOf, clampedDays);
  const tokens = parseEventFilter(events);

  // Only hit FRED for releases the filter can match — each release is one API call.
  const wanted = CURATED_RELEASES.filter((r) => matchesFilter(r.event, tokens));

  const results = await Promise.allSettled(
    wanted.map(async (release) => {
      const dates = await getFredReleaseDates(release.releaseId, {
        realtimeStart: windowStart,
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

  entries.push(...fomcEntries(), ...rbaEntries());

  return formatReleaseCalendar(entries, asOf, clampedDays, events, notes, clampedBack);
}
