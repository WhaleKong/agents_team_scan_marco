import assert from "node:assert/strict";
import test from "node:test";

import {
  applySessionBaseline,
  etSessionDate,
  failedMeeting,
  fomcDateToEventTicker,
  formatRatePricing,
  lastCompletedClose,
  parseDollars,
  selectMeetings,
  summarizeMeeting,
  summarizePath,
  type MeetingPricing,
  type SessionBaseline,
} from "../tools/rate-pricing.js";
import type { KalshiCandlestick, KalshiMarket } from "../sources/kalshi.js";

interface LegFixture {
  bid?: string | null;
  ask?: string | null;
  last?: string | null;
  volume24h?: string | null;
  openInterest?: string | null;
}

function market(suffix: string, leg: LegFixture): KalshiMarket {
  return {
    ticker: `KXFEDDECISION-26SEP-${suffix}`,
    event_ticker: "KXFEDDECISION-26SEP",
    yes_sub_title: suffix,
    status: "active",
    yes_bid_dollars: leg.bid ?? null,
    yes_ask_dollars: leg.ask ?? null,
    last_price_dollars: leg.last ?? null,
    volume_24h_fp: leg.volume24h ?? null,
    open_interest_fp: leg.openInterest ?? null,
  };
}

/**
 * Real Kalshi snapshot for the 2026-09-16 FOMC, captured 2026-09-04 13:40 UTC.
 * Keeping the measured numbers means the arithmetic is checked against a book
 * that actually existed, not against invented values.
 */
function septemberSnapshot(): KalshiMarket[] {
  return [
    market("C26", { bid: "0.0000", ask: "0.0100", last: "0.0100", volume24h: "20571.43", openInterest: "977211.31" }),
    market("C25", { bid: "0.0000", ask: "0.0100", last: "0.0100", volume24h: "240075.59", openInterest: "5523704.80" }),
    market("H0", { bid: "0.4600", ask: "0.4700", last: "0.4700", volume24h: "1311830.49", openInterest: "9532623.53" }),
    market("H25", { bid: "0.5200", ask: "0.5300", last: "0.5300", volume24h: "338127.73", openInterest: "3758809.85" }),
    market("H26", { bid: "0.0100", ask: "0.0200", last: "0.0100", volume24h: "151639.77", openInterest: "6151169.00" }),
  ];
}

function candle(day: number, close: string | null): KalshiCandlestick {
  return {
    end_period_ts: Date.UTC(2026, 8, day, 4, 0, 0) / 1000,
    price: { close_dollars: close },
  };
}

function approx(actual: number | null, expected: number, message: string): void {
  assert.notEqual(actual, null, `${message}: got null`);
  assert.ok(
    Math.abs((actual as number) - expected) < 1e-9,
    `${message}: expected ~${expected}, got ${actual}`
  );
}

test("maps every FOMC month to a Kalshi event ticker, including year rollover", () => {
  assert.equal(fomcDateToEventTicker("2026-01-28"), "KXFEDDECISION-26JAN");
  assert.equal(fomcDateToEventTicker("2026-03-18"), "KXFEDDECISION-26MAR");
  assert.equal(fomcDateToEventTicker("2026-09-16"), "KXFEDDECISION-26SEP");
  assert.equal(fomcDateToEventTicker("2026-12-09"), "KXFEDDECISION-26DEC");
  assert.equal(fomcDateToEventTicker("2027-01-27"), "KXFEDDECISION-27JAN");
  assert.equal(fomcDateToEventTicker("2027-11-03"), "KXFEDDECISION-27NOV");
  assert.throws(() => fomcDateToEventTicker("2026-13-01"));
});

test("selects upcoming meetings and reports when the schedule constant runs out", () => {
  const near = selectMeetings("2026-09-05", 2);
  assert.deepEqual(near.dates, ["2026-09-16", "2026-10-28"]);
  assert.equal(near.exhausted, false);

  const onDecisionDay = selectMeetings("2026-09-16", 1);
  assert.deepEqual(onDecisionDay.dates, ["2026-09-16"], "decision day itself still counts");

  const past = selectMeetings("2027-12-01", 4);
  assert.deepEqual(past.dates, ["2027-12-08"]);
  assert.equal(past.exhausted, true, "asking past the constant must flag exhaustion");
});

test("parses Kalshi decimal strings and rejects unusable values", () => {
  approx(parseDollars("0.5300"), 0.53, "decimal string");
  approx(parseDollars("0.0000"), 0, "zero");
  assert.equal(parseDollars(null), null);
  assert.equal(parseDollars(undefined), null);
  assert.equal(parseDollars(""), null);
  assert.equal(parseDollars("not-a-number"), null);
});

test("summarizes a meeting from the real September book", () => {
  const summary = summarizeMeeting("2026-09-16", septemberSnapshot());

  const hike25 = summary.outcomes.find((o) => o.suffix === "H25");
  approx(hike25?.mid ?? null, 0.525, "Hike 25 mid is the bid/ask midpoint");
  approx(hike25?.spread ?? null, 0.01, "Hike 25 spread");

  approx(summary.hike25, 0.525, "decisive hike leg");
  approx(summary.hold, 0.465, "Hold mid");
  approx(summary.totalHike, 0.54, "total hike = H25 + H26");
  approx(summary.totalCut, 0.01, "total cut = C25 + C26");
  approx(summary.sumMids, 1.015, "mids carry a small overround, not normalized away");

  approx(summary.maxVolume24h, 1311830.49, "quality reads the most-traded leg");
  assert.equal(summary.quality, "OK");
  assert.equal(summary.eventTicker, "KXFEDDECISION-26SEP");
  assert.equal(summary.fetchFailed, false);
  assert.equal(summary.hike25Delta, null, "deltas stay empty until a baseline is applied");
});

test("falls back to last trade when a leg has no two-sided quote", () => {
  const markets = septemberSnapshot().filter((m) => !m.ticker.endsWith("-H25"));
  markets.push(market("H25", { last: "0.5300", volume24h: "338127.73" }));

  const summary = summarizeMeeting("2026-09-16", markets);
  const hike25 = summary.outcomes.find((o) => o.suffix === "H25");
  approx(hike25?.mid ?? null, 0.53, "mid falls back to last trade");
  assert.equal(hike25?.spread, null, "no spread when there is no book");
});

test("grades a tight spread on no flow as STALE, not OK", () => {
  // Measured 2026-09-04 on the Dec 2026 meeting: 1-pt spreads, vol24h in the
  // hundreds. A narrow quote nobody trades is a market-maker mark.
  const summary = summarizeMeeting("2026-12-09", [
    market("C26", { bid: "0.0100", ask: "0.0200", volume24h: "5" }),
    market("C25", { bid: "0.0300", ask: "0.0600", volume24h: "12" }),
    market("H0", { bid: "0.4800", ask: "0.4900", volume24h: "451" }),
    market("H25", { bid: "0.4200", ask: "0.4300", volume24h: "90" }),
    market("H26", { bid: "0.0100", ask: "0.0200", volume24h: "3" }),
  ]);

  assert.equal(summary.quality, "STALE");
});

test("grades light-but-traded flow as THIN, and a wide decisive spread as THIN", () => {
  const light = summarizeMeeting("2026-10-28", [
    market("C26", { bid: "0.0100", ask: "0.0200", volume24h: "10" }),
    market("C25", { bid: "0.0300", ask: "0.0400", volume24h: "20" }),
    market("H0", { bid: "0.6800", ask: "0.6900", volume24h: "499" }),
    market("H25", { bid: "0.2700", ask: "0.2800", volume24h: "4990" }),
    market("H26", { bid: "0.0100", ask: "0.0200", volume24h: "8" }),
  ]);
  assert.equal(light.quality, "THIN");

  const wide = summarizeMeeting("2026-10-28", [
    market("C26", { bid: "0.0100", ask: "0.0200", volume24h: "10" }),
    market("C25", { bid: "0.0300", ask: "0.0400", volume24h: "20" }),
    market("H0", { bid: "0.7000", ask: "0.7600", volume24h: "60000" }),
    market("H25", { bid: "0.1000", ask: "0.1800", volume24h: "60000" }),
    market("H26", { bid: "0.0100", ask: "0.0200", volume24h: "8" }),
  ]);
  assert.equal(wide.quality, "THIN", "heavy volume cannot excuse an 8-pt decisive spread");
});

test("grades a meeting with no quotes at all as DEAD", () => {
  const summary = summarizeMeeting("2027-12-08", [market("H0", {}), market("H25", {})]);
  assert.equal(summary.quality, "DEAD");
  assert.equal(summary.totalHike, null);
  assert.equal(summary.sumMids, null);
});

test("maps a daily candle to the ET session it covers", () => {
  // Kalshi daily candles end at 00:00 ET, so the candle ending 2026-09-04
  // 00:00 ET is the 2026-09-03 session. Verified against the NFP print, which
  // landed at 12:30Z on 09-04 and appears in the candle stamped 09-05T04:00Z.
  assert.equal(etSessionDate(Date.UTC(2026, 8, 4, 4, 0, 0) / 1000), "2026-09-03");
  assert.equal(etSessionDate(Date.UTC(2026, 8, 5, 4, 0, 0) / 1000), "2026-09-04");
});

test("takes the delta baseline from the last COMPLETED session, never an open one", () => {
  const candles = [candle(3, "0.6100"), candle(4, "0.4200"), candle(5, "0.4900")];

  // 2026-09-05 07:00Z: the 09-04 session closed three hours ago.
  const settled = lastCompletedClose(candles, Date.UTC(2026, 8, 5, 7, 0, 0) / 1000);
  assert.equal(settled?.session, "2026-09-04");
  approx(settled?.close ?? null, 0.49, "uses the completed 09-04 close");

  // 2026-09-05 02:00Z: the 09-04 session is still open, so fall back a day.
  const midSession = lastCompletedClose(candles, Date.UTC(2026, 8, 5, 2, 0, 0) / 1000);
  assert.equal(midSession?.session, "2026-09-03");
  approx(midSession?.close ?? null, 0.42, "an in-progress candle is not a baseline");

  assert.equal(lastCompletedClose([], Date.UTC(2026, 8, 5, 7, 0, 0) / 1000), null);
  assert.equal(
    lastCompletedClose([candle(4, null)], Date.UTC(2026, 8, 5, 7, 0, 0) / 1000),
    null,
    "a candle with no close is skipped rather than reported as zero"
  );
});

test("applies a session baseline to the decisive legs only", () => {
  const baseline: SessionBaseline = {
    session: "2026-09-04",
    closes: { H25: 0.49, H0: 0.485 },
  };
  const summary = applySessionBaseline(summarizeMeeting("2026-09-16", septemberSnapshot()), baseline);

  approx(summary.hike25Delta, 0.035, "hike delta vs the completed session close");
  approx(summary.holdDelta, -0.02, "hold delta vs the completed session close");
  assert.equal(summary.baselineSession, "2026-09-04");

  const unbaselined = applySessionBaseline(summarizeMeeting("2026-09-16", septemberSnapshot()), null);
  assert.equal(unbaselined.hike25Delta, null, "no baseline means no delta, not a zero");
  assert.equal(unbaselined.baselineSession, null);
});

test("builds a probability path with per-session deltas and an in-progress flag", () => {
  const nowTs = Date.UTC(2026, 8, 4, 20, 0, 0) / 1000;
  const points = summarizePath([candle(3, "0.6100"), candle(4, "0.4200"), candle(5, "0.4900")], nowTs);

  assert.equal(points.length, 3);
  assert.equal(points[0]!.session, "2026-09-02");
  assert.equal(points[0]!.delta, null, "first point has no predecessor");
  approx(points[1]!.close, 0.42, "second close");
  approx(points[1]!.delta, -0.19, "second delta");
  assert.equal(points[1]!.inProgress, false);
  assert.equal(points[2]!.inProgress, true, "candle ending after now is still open");
});

test("formats the pricing table with deltas, quality grades and the secondary-source rule", () => {
  const meeting = applySessionBaseline(summarizeMeeting("2026-09-16", septemberSnapshot()), {
    session: "2026-09-04",
    closes: { H25: 0.49, H0: 0.485 },
  });
  const output = formatRatePricing([meeting], null, "2026-09-05T07:00:00Z", false);

  assert.match(
    output,
    /\| FOMC date \| Hike >25 \| Hike 25 \| Hold \| Cut 25 \| Cut >25 \| TOTAL HIKE \| TOTAL CUT \| Data quality \|/
  );
  assert.match(
    output,
    /\| 2026-09-16 \| 1\.5% \| 52\.5% \(\+3\.5\) \| 46\.5% \(-2\.0\) \| 0\.5% \| 0\.5% \| 54\.0% \| 1\.0% \| OK — vol24h 1,311,830 \|/
  );
  assert.match(output, /Δ in parentheses = move since the 2026-09-04 ET session close/);
  assert.match(output, /NOT from Kalshi's previous_price_dollars field/);
  assert.match(output, /SECONDARY SOURCE/);
  assert.match(output, /CANNOT on its own mark a pricing gap VERIFIED/);
  assert.doesNotMatch(output, /NOTE: 2026-09-16 outcome mids/, "1.5 pts of overround is below the note threshold");
});

test("says so plainly when no session baseline was retrievable", () => {
  const output = formatRatePricing(
    [summarizeMeeting("2026-09-16", septemberSnapshot())],
    null,
    "2026-09-05T07:00:00Z",
    false
  );
  assert.match(output, /Δ unavailable: no completed daily session close was retrievable\./);
  assert.match(output, /\| 2026-09-16 \| 1\.5% \| 52\.5% \| 46\.5% \|/, "levels still render without deltas");
});

test("notes a large overround instead of normalizing it away", () => {
  const output = formatRatePricing(
    [
      summarizeMeeting("2026-09-16", [
        market("C26", { bid: "0.0400", ask: "0.0600", volume24h: "50000" }),
        market("C25", { bid: "0.0400", ask: "0.0600", volume24h: "50000" }),
        market("H0", { bid: "0.4600", ask: "0.4700", volume24h: "1311830" }),
        market("H25", { bid: "0.5200", ask: "0.5300", volume24h: "338127" }),
        market("H26", { bid: "0.0400", ask: "0.0600", volume24h: "50000" }),
      ]),
    ],
    null,
    "2026-09-05T07:00:00Z",
    false
  );

  assert.match(output, /NOTE: 2026-09-16 outcome mids sum to 114\.0% \(\+14\.0 pts off 100%\)/);
});

test("keeps a failed meeting visible as an n/a row without emptying the table", () => {
  const meetings: MeetingPricing[] = [
    summarizeMeeting("2026-09-16", septemberSnapshot()),
    failedMeeting("2026-10-28"),
  ];
  const output = formatRatePricing(meetings, null, "2026-09-05T07:00:00Z", false);

  assert.match(output, /\| 2026-09-16 \| 1\.5% \|/, "the healthy row survives");
  assert.match(
    output,
    /\| 2026-10-28 \| n\/a \| n\/a \| n\/a \| n\/a \| n\/a \| n\/a \| n\/a \| n\/a \(fetch failed\) \|/
  );
});

test("renders the probability path and warns when the FOMC constant is exhausted", () => {
  const points = summarizePath(
    [candle(4, "0.4200"), candle(5, "0.4900")],
    Date.UTC(2026, 8, 5, 2, 0, 0) / 1000
  );

  const output = formatRatePricing(
    [summarizeMeeting("2026-09-16", septemberSnapshot())],
    { decisionDate: "2026-09-16", points },
    "2026-09-05T02:00:00Z",
    true
  );

  assert.match(output, /### Probability path — 2026-09-16 "Hike 25" \(daily close, ET sessions\)/);
  assert.match(output, /\| 2026-09-03 \| 42\.0% \| n\/a \|/);
  assert.match(output, /\| 2026-09-04 \(in progress\) \| 49\.0% \| \+7\.0 \|/);
  assert.match(
    output,
    /WARNING: FOMC schedule constant ends 2027-12-08 — update src\/config\/fomc-schedule\.ts/
  );
});
