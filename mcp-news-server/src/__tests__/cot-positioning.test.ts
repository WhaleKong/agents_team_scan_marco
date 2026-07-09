import assert from "node:assert/strict";
import test from "node:test";

import { summarizeCot, formatCotSummaries } from "../tools/cot-positioning.js";
import type { CotRecord } from "../sources/cftc.js";

function record(
  date: string,
  long: number,
  short: number,
  oi: number | string = 400_000
): CotRecord {
  return {
    report_date_as_yyyy_mm_dd: `${date}T00:00:00.000`,
    market_and_exchange_names: "GOLD - COMMODITY EXCHANGE INC.",
    noncomm_positions_long_all: String(long),
    noncomm_positions_short_all: String(short),
    open_interest_all: String(oi),
  };
}

/** Weekly Tuesdays counting back from 2026-06-23, oldest-last like a real desc feed. */
function weeklyDates(count: number): string[] {
  const dates: string[] = [];
  const d = new Date("2026-06-23T00:00:00Z");
  for (let i = 0; i < count; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 7);
  }
  return dates;
}

test("computes net, weekly change, and % of open interest from the two latest reports", () => {
  const [latest, prev] = weeklyDates(2);
  const summary = summarizeCot("Gold (COMEX)", [
    record(latest, 217_028, 35_689, 352_167),
    record(prev, 211_127, 30_907, 350_000),
  ]);

  assert.equal(summary.reportDate, latest);
  assert.equal(summary.net, 181_339);
  assert.equal(summary.weeklyChange, 181_339 - 180_220);
  assert.ok(Math.abs((summary.pctOfOpenInterest ?? 0) - (181_339 / 352_167) * 100) < 1e-9);
  assert.equal(summary.percentile52w, null); // only 2 weeks of history
});

test("52-week percentile: latest at max of the window is 100, at min is 0", () => {
  const dates = weeklyDates(52);

  // Net rises 1000 per week into the present -> latest is the year's max.
  const rising = dates.map((d, i) => record(d, 100_000 + (52 - i) * 1_000, 50_000));
  const top = summarizeCot("Gold (COMEX)", rising);
  assert.equal(top.percentile52w, 100);

  // Net falls into the present -> latest is the year's min.
  const falling = dates.map((d, i) => record(d, 100_000 + i * 1_000, 50_000));
  const bottom = summarizeCot("Gold (COMEX)", falling);
  assert.equal(bottom.percentile52w, 0);
});

test("unparseable rows are skipped and zero/invalid open interest yields n/a percent", () => {
  const [latest, prev, older] = weeklyDates(3);
  const summary = summarizeCot("Gold (COMEX)", [
    { ...record("2026-06-30", 1, 1), noncomm_positions_long_all: "not-a-number" },
    record(latest, 100_000, 40_000, 0),
    record(prev, 90_000, 40_000),
    record(older, 80_000, 40_000),
  ]);

  assert.equal(summary.reportDate, latest); // bad 06-30 row skipped
  assert.equal(summary.net, 60_000);
  assert.equal(summary.weeklyChange, 10_000);
  assert.equal(summary.pctOfOpenInterest, null); // OI of 0 is invalid
});

test("empty records produce an all-n/a summary without throwing", () => {
  const summary = summarizeCot("USD Index (ICE)", []);

  assert.equal(summary.reportDate, null);
  assert.equal(summary.net, null);
  assert.equal(summary.weeklyChange, null);
  assert.equal(summary.percentile52w, null);
});

test("formats the positioning table with crowdedness flags and n/a rows", () => {
  const output = formatCotSummaries([
    {
      label: "Gold (COMEX)",
      reportDate: "2026-06-23",
      net: 181_339,
      weeklyChange: 1_119,
      pctOfOpenInterest: 51.5,
      percentile52w: 96,
    },
    {
      label: "Japanese Yen (CME)",
      reportDate: "2026-06-23",
      net: -45_000,
      weeklyChange: -2_000,
      pctOfOpenInterest: -18.2,
      percentile52w: 4,
    },
    {
      label: "USD Index (ICE) (fetch failed)",
      reportDate: null,
      net: null,
      weeklyChange: null,
      pctOfOpenInterest: null,
      percentile52w: null,
    },
  ]);

  assert.match(output, /\| Market \| Report Date \| Net Non-Comm \| Weekly Δ \| % of OI \| 52w Percentile \|/);
  assert.match(output, /\| Gold \(COMEX\) \| 2026-06-23 \| \+181,339 \| \+1,119 \| \+51\.5% \| 96 — AT 1Y LONG EXTREME \|/);
  assert.match(output, /\| Japanese Yen \(CME\) \| 2026-06-23 \| -45,000 \| -2,000 \| -18\.2% \| 4 — AT 1Y SHORT EXTREME \|/);
  assert.match(output, /\| USD Index \(ICE\) \(fetch failed\) \| n\/a \| n\/a \| n\/a \| n\/a \| n\/a \|/);
  assert.match(output, /published Friday/);
});
