const HIGH_IMPACT_PATTERNS = [
  /\bfed\b/i,
  /\bfomc\b/i,
  /\brate\s*(cut|hike|decision|hold)/i,
  /\bcentral\s*bank/i,
  /\becb\b/i,
  /\bboj\b/i,
  /\bpboc\b/i,
  /\bwar\b/i,
  /\bceasefire\b/i,
  /\bsanction/i,
  /\btariff/i,
  /\bdefault\b/i,
  /\bemergency/i,
  /\bcrash/i,
  /\bcrisis/i,
  /\bcpi\b/i,
  /\bpce\b/i,
  /\bnonfarm|nfp\b/i,
  /\bgdp\b/i,
  /\binflation\b/i,
  /\brecession/i,
  /\bhormuz/i,
  /\bopec/i,
  /\bstrait/i,
  /\bnuclear/i,
  /\bshutdown/i,
  /\bcircuit\s*breaker/i,
  /\bblack\s*swan/i,
  /\bsurprise/i,
  /\bsurge[ds]?\b/i,
  /\bplunge[ds]?\b/i,
  /\bcollapse[ds]?\b/i,
];

const MEDIUM_IMPACT_PATTERNS = [
  /\bearnings/i,
  /\bpmi\b/i,
  /\bism\b/i,
  /\bjobless/i,
  /\bunemployment/i,
  /\bretail\s*sales/i,
  /\bhousing/i,
  /\bdurable\s*goods/i,
  /\bipo\b/i,
  /\bmerger/i,
  /\bacquisition/i,
  /\bupgrade[ds]?\b/i,
  /\bdowngrade[ds]?\b/i,
  /\bbond\s*(auction|issuance)/i,
  /\bvix\b/i,
  /\bvolatility/i,
  /\bcommodit/i,
  /\bcrypto/i,
  /\bbitcoin\b/i,
  /\bgold\b/i,
  /\boil\b/i,
  /\bcrude\b/i,
];

export function classifyImpact(
  headline: string
): "HIGH" | "MEDIUM" | "LOW" {
  if (HIGH_IMPACT_PATTERNS.some((p) => p.test(headline))) return "HIGH";
  if (MEDIUM_IMPACT_PATTERNS.some((p) => p.test(headline))) return "MEDIUM";
  return "LOW";
}
