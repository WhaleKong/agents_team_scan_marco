import { getEarningsCalendar } from "../sources/finnhub.js";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAhead(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function getEarnings(
  fromDate?: string,
  toDate?: string,
  symbol?: string
): Promise<string> {
  const from = fromDate ?? todayStr();
  const to = toDate ?? daysAhead(7);

  const data = await getEarningsCalendar(from, to);
  let earnings = data.earningsCalendar ?? [];

  if (symbol) {
    earnings = earnings.filter(
      (e) => e.symbol.toUpperCase() === symbol.toUpperCase()
    );
  }

  if (earnings.length === 0) {
    return `No earnings found from ${from} to ${to}${symbol ? ` for ${symbol}` : ""}`;
  }

  // Finnhub returns dates descending; nearest-first keeps today's reports
  // from being cut by the 50-row cap.
  earnings.sort(
    (a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol)
  );

  let output = `## Earnings Calendar — ${from} to ${to}\n\n`;
  output += `| Date | Symbol | EPS Est | EPS Actual | Revenue Est | Revenue Actual | Surprise |\n`;
  output += `|------|--------|---------|------------|-------------|----------------|----------|\n`;

  for (const e of earnings.slice(0, 50)) {
    const epsEst = e.epsEstimate !== null ? e.epsEstimate.toFixed(2) : "—";
    const epsAct = e.epsActual !== null ? e.epsActual.toFixed(2) : "—";
    const revEst = e.revenueEstimate !== null ? `$${(e.revenueEstimate / 1e6).toFixed(0)}M` : "—";
    const revAct = e.revenueActual !== null ? `$${(e.revenueActual / 1e6).toFixed(0)}M` : "—";
    const surprise =
      e.epsActual !== null && e.epsEstimate !== null && e.epsEstimate !== 0
        ? `${(((e.epsActual - e.epsEstimate) / Math.abs(e.epsEstimate)) * 100).toFixed(1)}%`
        : "—";
    output += `| ${e.date} | ${e.symbol} | ${epsEst} | ${epsAct} | ${revEst} | ${revAct} | ${surprise} |\n`;
  }

  if (earnings.length > 50) {
    output += `\nShowing first 50 of ${earnings.length} reports (nearest dates first).\n`;
  }

  return output;
}
