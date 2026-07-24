import assert from "node:assert/strict";
import test from "node:test";

import { summarizeSeries, formatFredSeriesSummaries } from "../tools/fred-macro.js";
import type { FredSeriesDefinition, FredSeriesSummary } from "../tools/fred-macro.js";
import type { FredObservation } from "../sources/fred.js";

const monthlyDef: FredSeriesDefinition = {
  seriesId: "TEST_M",
  label: "Test Monthly",
  category: "Growth & Inflation",
  unit: "index",
  frequency: "monthly",
};

function monthlyObservations(
  start: string,
  months: number,
  valueAt: (index: number, date: string) => string
): FredObservation[] {
  const observations: FredObservation[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < months; i++) {
    const date = d.toISOString().slice(0, 10);
    observations.push({ date, value: valueAt(i, date) });
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return observations.reverse(); // FRED default sort: descending
}

function approxEqual(actual: number | null, expected: number, epsilon = 1e-9): void {
  assert.ok(actual !== null, `expected ~${expected}, got null`);
  assert.ok(
    Math.abs(actual - expected) < epsilon,
    `expected ~${expected}, got ${actual}`
  );
}

test("monthly series: date-based 3M/1Y lags survive a missing month (no index arithmetic)", () => {
  // 2025-04 .. 2026-06, value = 100 + month index; 2026-04 is "." (missing).
  // Index-based "3 back" would land on 2026-02; date-based must land on 2026-03.
  const observations = monthlyObservations("2025-04-01", 15, (i, date) =>
    date === "2026-04-01" ? "." : String(100 + i)
  );

  const summary = summarizeSeries(monthlyDef, observations);

  assert.equal(summary.latest?.date, "2026-06-01");
  approxEqual(summary.latest?.value ?? null, 114);
  assert.equal(summary.previous?.date, "2026-05-01");
  approxEqual(summary.change, 1);
  approxEqual(summary.change3m, 3); // vs 2026-03-01 = 111
  approxEqual(summary.pct3m, (3 / 111) * 100);
  approxEqual(summary.change1y, 12); // vs 2025-06-01 = 102
  approxEqual(summary.yoyPct, (12 / 102) * 100);
  assert.equal(summary.rateOfChange, "stable"); // linear series: rocNow === rocPrior
});

test("daily series: weekend/holiday gaps are skipped and lag lookups stay tolerant", () => {
  const dailyDef: FredSeriesDefinition = {
    seriesId: "TEST_D",
    label: "Test Daily",
    category: "Rates & Credit",
    unit: "%",
    frequency: "daily",
  };

  // ~400 calendar days ending 2026-06-30; weekends are "." and the final day
  // is a "." holiday, so latest must fall back to the prior weekday.
  const observations: FredObservation[] = [];
  const d = new Date("2025-06-01T00:00:00Z");
  while (d.toISOString().slice(0, 10) <= "2026-06-30") {
    const date = d.toISOString().slice(0, 10);
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    const holiday = date === "2026-06-30";
    observations.push({ date, value: weekend || holiday ? "." : "5.00" });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  observations.reverse();

  const summary = summarizeSeries(dailyDef, observations);

  assert.equal(summary.latest?.date, "2026-06-29"); // Monday before the "." holiday
  approxEqual(summary.change, 0);
  approxEqual(summary.change3m, 0);
  approxEqual(summary.yoyPct, 0);
  assert.equal(summary.rateOfChange, "stable");
});

test("rate of change classifies accelerating and decelerating", () => {
  const values = (v6m: number, v3m: number, latest: number) =>
    monthlyObservations("2025-06-01", 13, (_i, date) => {
      if (date === "2026-06-01") return String(latest);
      if (date === "2026-03-01") return String(v3m);
      if (date === "2025-12-01") return String(v6m);
      return "100";
    });

  // rocNow = 8 vs rocPrior = 2 → accelerating
  const accel = summarizeSeries(monthlyDef, values(100, 102, 110));
  assert.equal(accel.rateOfChange, "accelerating");
  approxEqual(accel.yoyPct, 10); // vs 2025-06-01 = 100

  // rocNow = 2 vs rocPrior = 8 → decelerating
  const decel = summarizeSeries(monthlyDef, values(100, 108, 110));
  assert.equal(decel.rateOfChange, "decelerating");
});

test("percentage-point series: near-zero base suppresses the % artifact, keeps Δ", () => {
  const spreadDef: FredSeriesDefinition = {
    seriesId: "TEST_SPREAD",
    label: "Test Spread",
    category: "Markets & Financial Conditions",
    unit: "%",
    frequency: "monthly",
  };

  // 1y-ago base 0.01 (< 0.1pp floor → % suppressed), 3m-ago base 0.50 (valid).
  const observations = monthlyObservations("2025-06-01", 13, (_i, date) => {
    if (date === "2026-06-01") return "0.76";
    if (date === "2026-03-01") return "0.50";
    if (date === "2025-06-01") return "0.01";
    return "0.30";
  });

  const summary = summarizeSeries(spreadDef, observations);

  approxEqual(summary.change1y, 0.75);
  assert.equal(summary.yoyPct, null); // would be +7500% off the 0.01 base
  approxEqual(summary.change3m, 0.26);
  approxEqual(summary.pct3m, (0.26 / 0.5) * 100, 1e-6);
});

test("short history yields n/a trend fields without throwing", () => {
  const summary = summarizeSeries(monthlyDef, [
    { date: "2026-06-01", value: "114" },
    { date: "2026-05-01", value: "113" },
  ]);

  approxEqual(summary.change, 1);
  assert.equal(summary.change3m, null);
  assert.equal(summary.change1y, null);
  assert.equal(summary.yoyPct, null);
  assert.equal(summary.rateOfChange, null);

  const empty = summarizeSeries(monthlyDef, []);
  assert.equal(empty.latest, null);
  assert.equal(empty.rateOfChange, null);
});

test("formats FRED summaries with trend columns and n/a rows", () => {
  const summaries: FredSeriesSummary[] = [
    {
      seriesId: "DGS10",
      label: "10Y Treasury Yield",
      category: "Rates & Credit",
      unit: "%",
      latest: { date: "2026-05-08", value: 4.42 },
      previous: { date: "2026-05-07", value: 4.35 },
      change: 0.07,
      percentChange: 1.609195402298856,
      change3m: 0.15,
      pct3m: 3.51,
      change1y: -0.3,
      yoyPct: -6.36,
      rateOfChange: "decelerating",
    },
    {
      seriesId: "M2SL",
      label: "M2 Money Supply",
      category: "Liquidity",
      unit: "$T",
      latest: null,
      previous: null,
      change: null,
      percentChange: null,
      change3m: null,
      pct3m: null,
      change1y: null,
      yoyPct: null,
      rateOfChange: null,
    },
  ];

  const output = formatFredSeriesSummaries(summaries);

  assert.match(output, /## FRED Macro Data/);
  assert.match(output, /\| Series \| Latest \| Date \| Δ Prev \| Δ 3M \| Δ 1Y \| YoY % \| RoC \|/);
  assert.match(output, /\| 10Y Treasury Yield \(DGS10\) \| 4\.42% \| 2026-05-08 \| \+0\.07 \| \+0\.15 \(\+3\.51%\) \| -0\.30 \| -6\.36% \| decelerating \|/);
  assert.match(output, /\| M2 Money Supply \(M2SL\) \| n\/a \| n\/a \| n\/a \| n\/a \| n\/a \| n\/a \| n\/a \|/);
  assert.match(output, /second derivative/);
});
