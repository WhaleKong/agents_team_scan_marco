import assert from "node:assert/strict";
import test from "node:test";

import { formatReleaseCalendar, fomcEntries } from "../tools/release-calendar.js";
import type { ReleaseCalendarEntry } from "../tools/release-calendar.js";

const cpi = (date: string): ReleaseCalendarEntry => ({
  date,
  event: "CPI",
  timeEt: "08:30",
  importance: "HIGH",
});

const nfp = (date: string): ReleaseCalendarEntry => ({
  date,
  event: "Employment Situation (NFP)",
  timeEt: "08:30",
  importance: "HIGH",
});

test("merges FRED entries with FOMC, sorts ascending, and windows by days_ahead", () => {
  const entries = [nfp("2026-08-07"), cpi("2026-07-14"), ...fomcEntries()];

  const output = formatReleaseCalendar(entries, "2026-07-05", 30);

  assert.match(output, /2026-07-05 to 2026-08-04/);
  assert.match(output, /\| 2026-07-14 \| Tue \| CPI \| 08:30 \| HIGH \|/);
  assert.match(output, /\| 2026-07-29 \| Wed \| FOMC Rate Decision \| 14:00 \(press conf 14:30\) \| HIGH \|/);
  assert.doesNotMatch(output, /2026-08-07/); // outside 30-day window
  assert.ok(
    output.indexOf("2026-07-14") < output.indexOf("2026-07-29"),
    "rows must be sorted ascending by date"
  );
});

test("dedupes duplicate release dates from FRED revisions", () => {
  const entries = [cpi("2026-07-14"), cpi("2026-07-14"), cpi("2026-07-14")];

  const output = formatReleaseCalendar(entries, "2026-07-05", 14);

  const matches = output.match(/2026-07-14/g) ?? [];
  assert.equal(matches.length, 1);
});

test("events filter narrows rows case-insensitively", () => {
  const entries = [cpi("2026-07-14"), ...fomcEntries()];

  const output = formatReleaseCalendar(entries, "2026-07-05", 30, "fomc");

  assert.match(output, /FOMC Rate Decision/);
  assert.doesNotMatch(output, /\| CPI \|/);
});

test("warns when the window runs past the FOMC schedule constant", () => {
  const output = formatReleaseCalendar(fomcEntries(), "2027-12-01", 60);

  assert.match(output, /\| 2027-12-08 \| Wed \| FOMC Rate Decision \|/);
  assert.match(output, /WARNING: FOMC schedule constant ends 2027-12-08/);

  const inside = formatReleaseCalendar(fomcEntries(), "2026-07-05", 30);
  assert.doesNotMatch(inside, /WARNING: FOMC schedule constant/);
});

test("empty window renders a no-releases note instead of an empty table", () => {
  const output = formatReleaseCalendar([cpi("2026-09-15")], "2026-07-05", 7);

  assert.match(output, /No tracked releases inside this window/);
});
