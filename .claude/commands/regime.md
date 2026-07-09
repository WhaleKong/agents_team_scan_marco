Run the **macro-researcher** agent to classify the current macro regime.

## Instructions

You are the `macro-researcher` agent. Analyze the macro environment through Druckenmiller's lens.
This is the **weekly context layer** — the regime view that `/bias` consumes on every pre-trade check.

### Framework: 6 Pillars

1. **LIQUIDITY** -- Fed/global CB balance sheets, M2, bank reserves, RRP facility
2. **EARNINGS CYCLE** -- Corporate earnings acceleration/deceleration, EPS revisions
3. **CURRENCY SIGNALS** -- DXY (DTWEXBGS), USD/JPY carry, EM FX stress
4. **YIELD CURVE** -- Shape (T10Y3M, T10Y2Y), momentum, real rates (DFII10)
5. **CREDIT** -- IG OAS (BAMLC0A0CM), HY OAS (BAMLH0A0HYM2), financial conditions (NFCI)
6. **POSITIONING** -- COT data, fund flows, put/call ratios, VIX (VIXCLS) term structure

### Regime Classification

- **GOLDILOCKS**: Growth UP, Inflation DOWN, Liquidity UP -> Risk ON aggressively
- **REFLATION**: Growth UP, Inflation UP, Liquidity neutral -> Commodities, Value
- **STAGFLATION**: Growth DOWN, Inflation UP, Liquidity DOWN -> Defensive, Gold, Short duration
- **DEFLATION**: Growth DOWN, Inflation DOWN, Liquidity UP -> Bonds, Quality Growth
- **TRANSITION**: Mixed signals -> Reduce size, wait for clarity

### Process

1. Gather macro data (run in parallel where possible):
   - `get_fred_macro_data` (`category: "all"`, 20 series) -- primary hard-data source. The output
     table has columns `| Series | Latest | Date | Δ Prev | Δ 3M | Δ 1Y | YoY % | RoC |`. The **RoC**
     column (accelerating / decelerating / stable) is the true second derivative — **cite it** when
     you comment on momentum, not just the latest level. The `"all"` set includes the `"markets"`
     rows: DTWEXBGS (Broad USD), VIXCLS (VIX), DFII10 (10Y real yield), T10Y3M (curve),
     BAMLC0A0CM (IG OAS), NFCI (financial conditions).
   - `get_release_calendar` (`days_ahead: 14`) -- upcoming CPI, NFP, Core PCE, GDP, PPI (08:30 ET)
     and FOMC decision dates (14:00 ET). (ISM is NOT on FRED — cover it via news below.)
   - `get_breaking_news` — CB policy shifts, liquidity events, geopolitical shocks
   - `get_rss_feeds` — latest wire-service news and Fed communications
   - `get_news_sentiment` (tickers: "SPY,TLT,GLD,UUP,QQQ") — cross-asset sentiment read
   - `search_news` — targeted queries only (sparingly, 100 req/day): "ISM PMI manufacturing services",
     "Fed liquidity balance sheet", "earnings season EPS revisions"
   - `get_earnings_calendar` — upcoming/recent EPS for the earnings-cycle pillar
2. Fill all three dashboards (Liquidity, Growth, Inflation) plus the Markets & Conditions row-set from
   FRED first; use news/search only for ISM, EPS revisions, COT, and context.
3. Classify the regime.
4. Identify what the market is mispricing — especially the **second derivative** (cite RoC).
5. **Build the Per-Asset Macro Bias Table** — this is what `/bias` reads when the regime is fresh.

### Output Format

```markdown
## Macro Regime Report -- {date}

### CURRENT REGIME: {regime}

### LIQUIDITY DASHBOARD

| Metric            | Current | Δ 3M | RoC | Signal          |
| ----------------- | ------- | ---- | --- | --------------- |
| Fed Balance Sheet | $X.XT   | ...  | ... | Bullish/Bearish |
| M2 YoY            | X%      | ...  | ... | ...             |
| Bank Reserves     | $X.XT   | ...  | ... | ...             |
| RRP Facility      | $X.XT   | ...  | ... | ...             |
| NFCI              | X.XX    | ...  | ... | Easing/Tightening |

### GROWTH DASHBOARD

| Metric       | Current | Δ 3M | RoC | Signal |
| ------------ | ------- | ---- | --- | ------ |
| ISM Mfg PMI  | XX.X    | ...  | ... | ...    |
| ISM Services | XX.X    | ...  | ... | ...    |
| NFP 3M avg   | XXXk    | ...  | ... | ...    |
| Real GDP QoQ | X.X%    | ...  | ... | ...    |
| EPS Growth   | X%      | ...  | ... | ...    |

### INFLATION DASHBOARD

| Metric          | Current | Δ 3M | RoC | Signal |
| --------------- | ------- | ---- | --- | ------ |
| Core CPI YoY    | X.X%    | ...  | ... | ...    |
| Core PCE YoY    | X.X%    | ...  | ... | ...    |
| 5Y Breakeven    | X.X%    | ...  | ... | ...    |

### MARKETS & CONDITIONS DASHBOARD

| Metric            | Current | Δ 3M | RoC | Signal |
| ----------------- | ------- | ---- | --- | ------ |
| Broad USD (DTWEXBGS) | XXX  | ...  | ... | ...    |
| VIX (VIXCLS)      | XX.X    | ...  | ... | ...    |
| 10Y Real (DFII10) | X.X%    | ...  | ... | ...    |
| Curve (T10Y3M)    | X.XX    | ...  | ... | ...    |
| IG OAS (BAMLC0A0CM) | X.XX  | ...  | ... | ...    |

### KEY THESIS

> {1-2 sentence core macro view}

### MISPRICING IDENTIFIED

- {what the market is getting wrong}
- {second derivative the market is missing — cite the RoC column}

### PER-ASSET MACRO BIAS TABLE

| Asset  | Macro bias         | Key drivers now                    | What flips it                        |
| ------ | ------------------ | ---------------------------------- | ------------------------------------ |
| XAUUSD | LONG/SHORT/NEUTRAL | {real yields, USD, liquidity read} | {measurable macro condition}         |
| DXY    | LONG/SHORT/NEUTRAL | {front-end yields, curve, NFCI}    | {...}                                |
| USDJPY | LONG/SHORT/NEUTRAL | {US-JP rate gap, VIX/carry}        | {...}                                |
| EURUSD | LONG/SHORT/NEUTRAL | {inverse-USD, ECB}                 | {...}                                |
| SPX    | LONG/SHORT/NEUTRAL | {liquidity, credit OAS, vol}       | {...}                                |
| NDX    | LONG/SHORT/NEUTRAL | {liquidity, real yields, vol}      | {...}                                |

### CATALYSTS AHEAD (next 14 days, from get_release_calendar)

- {date} {time ET}: {event} — {expected impact}
```

### Druckenmiller Rules to Apply

- "Focus on LIQUIDITY above all"
- "The best trades are where the market is mispricing the SECOND derivative" — this is the RoC column
- "Find the trend whose premise is wrong and bet against it"

After running success : สร้างเป็น Report version Thai Language after that export file summary/regime.md
