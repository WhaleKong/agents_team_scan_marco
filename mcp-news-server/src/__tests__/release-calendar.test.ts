import assert from "node:assert/strict";
import test from "node:test";

import { formatReleaseCalendar, fomcEntries, rbaEntries } from "../tools/release-calendar.js";
import type { ReleaseCalendarEntry } from "../tools/release-calendar.js";
import { RBA_DECISION_DATES_SYDNEY } from "../config/rba-schedule.js";

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

test("RBA 14:30 Sydney converts to the correct ET date and time across both DST regimes", () => {
  const byEt = new Map(
    rbaEntries().map((e: ReleaseCalendarEntry) => [`${e.date} ${e.timeEt}`, e])
  );

  // Australian and US daylight saving run in opposite halves of the year, so the
  // Sydney->ET offset is 14h or 16h depending on the date. Three of the eight
  // 2026 decisions land on the PREVIOUS calendar day in New York.
  const expected = [
    ["2026-02-02", "22:30"], // Sydney 02-03 AEDT, NY EST  (-16h)
    ["2026-03-16", "23:30"], // Sydney 03-17 AEDT, NY EDT  (-15h)
    ["2026-05-05", "00:30"], // Sydney 05-05 AEST, NY EDT  (-14h)
    ["2026-06-16", "00:30"],
    ["2026-08-11", "00:30"],
    ["2026-09-29", "00:30"],
    ["2026-11-02", "22:30"], // Sydney 11-03 AEDT, NY EST  (-16h)
    ["2026-12-07", "22:30"], // Sydney 12-08 AEDT, NY EST  (-16h)
  ];

  assert.equal(rbaEntries().length, RBA_DECISION_DATES_SYDNEY.length);
  for (const [date, timeEt] of expected) {
    assert.ok(byEt.has(`${date} ${timeEt}`), `expected an RBA entry at ${date} ${timeEt} ET`);
  }
});

test("the verified 2026-08-11 RBA decision renders as a HIGH-impact row", () => {
  // Cross-check anchor: Reuters reported the hold on Tuesday 11 Aug 2026 Sydney time.
  const output = formatReleaseCalendar(rbaEntries(), "2026-08-01", 20);

  assert.match(output, /\| 2026-08-11 \| Tue \| RBA Rate Decision \(Australia\) \| 00:30 \| HIGH \|/);
});

test("RBA rows are reachable by the events filter and excluded by an unrelated one", () => {
  const entries = [cpi("2026-09-30"), ...rbaEntries()];

  const rbaOnly = formatReleaseCalendar(entries, "2026-09-20", 20, "rba");
  assert.match(rbaOnly, /RBA Rate Decision/);
  assert.doesNotMatch(rbaOnly, /\| CPI \|/);

  const cpiOnly = formatReleaseCalendar(entries, "2026-09-20", 20, "cpi");
  assert.match(cpiOnly, /\| CPI \|/);
  assert.doesNotMatch(cpiOnly, /RBA Rate Decision/);
});

test("warns when the window runs past the RBA schedule constant", () => {
  const output = formatReleaseCalendar(rbaEntries(), "2026-12-01", 40);

  assert.match(output, /WARNING: RBA schedule constant ends 2026-12-07/);

  const inside = formatReleaseCalendar(rbaEntries(), "2026-08-01", 20);
  assert.doesNotMatch(inside, /WARNING: RBA schedule constant/);
});

test("empty window renders a no-releases note instead of an empty table", () => {
  const output = formatReleaseCalendar([cpi("2026-09-15")], "2026-07-05", 7);

  assert.match(output, /No tracked releases inside this window/);
});
