import { searchGoogle } from "../sources/serpapi.js";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAhead(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function getEconomicEvents(
  fromDate?: string,
  toDate?: string,
  country?: string,
  importance?: string
): Promise<string> {
  const from = fromDate ?? todayStr();
  const to = toDate ?? daysAhead(7);

  // Use SerpAPI Google Search to find economic calendar data
  const countryFilter = country ? ` ${country}` : " US";
  const importanceFilter = importance === "high" ? " high impact" : "";
  const query = `economic calendar${countryFilter}${importanceFilter} ${from} to ${to} FOMC CPI NFP GDP PMI`;

  const { results, answerBox } = await searchGoogle(query, {
    timeFilter: "qdr:w",
    num: 10,
  });

  let output = `## Economic Calendar — ${from} to ${to}\n`;
  output += `Source: Google Search (SerpAPI)\n\n`;

  if (answerBox) {
    output += `### Quick Answer\n> ${answerBox}\n\n`;
  }

  if (results.length === 0) {
    output += "No economic calendar data found.\n";
    return output;
  }

  output += `### Upcoming Events & Data Releases\n`;
  for (const r of results) {
    output += `- **${r.title}**\n`;
    output += `  ${r.snippet}\n`;
    if (r.date) output += `  Date: ${r.date}\n`;
    output += `  ${r.link}\n\n`;
  }

  return output;
}
