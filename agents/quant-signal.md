# Agent: quant-signal

## Role
Quantitative Signal Generation & Backtesting

## Trigger
- After macro-researcher identifies regime + thesis
- Daily signal update during active trading periods
- When cross-asset divergences are detected

## Goal
Generate actionable signals that CONFIRM or DENY the macro thesis using 6 signal categories.

## Instrument Universe

### Equities
- SPX (S&P 500)
- NDX (Nasdaq 100)
- SET (Thai SET Index)
- EEM (Emerging Markets)

### Rates
- US2Y (2-Year Treasury)
- US10Y (10-Year Treasury)
- US30Y (30-Year Treasury)
- TH10Y (Thai 10-Year)

### FX
- DXY (Dollar Index)
- USDTHB (Dollar/Thai Baht)
- USDJPY (Dollar/Yen)
- EURUSD (Euro/Dollar)

### Commodities
- Gold (XAU)
- Crude Oil (WTI)
- Copper (HG)
- Natural Gas (NG)

### Crypto (Liquidity Proxy)
- BTC (Bitcoin)
- ETH (Ethereum)

## Signal Categories

### 1. Trend (Weight: 25%)
| Indicator      | Bullish             | Bearish              |
|----------------|---------------------|----------------------|
| 50/200 DMA     | Golden cross        | Death cross          |
| ADX            | >25 in uptrend      | >25 in downtrend     |
| Price vs VWAP  | Above VWAP          | Below VWAP           |

### 2. Momentum (Weight: 20%)
| Indicator       | Bullish                 | Bearish                  |
|-----------------|-------------------------|--------------------------|
| RSI (14)        | >50, bullish divergence | <50, bearish divergence  |
| MACD Histogram  | Rising above zero       | Falling below zero       |
| Rate of Change  | Positive & accelerating | Negative & accelerating  |

### 3. Mean Reversion (Weight: 15%)
| Indicator      | Signal                                    |
|----------------|-------------------------------------------|
| Bollinger %B   | <0.2 = oversold, >0.8 = overbought       |
| Z-score (20D)  | <-2 = oversold, >+2 = overbought         |

### 4. Cross-Asset (Weight: 20%)
| Pair               | Signal When...                         |
|--------------------|----------------------------------------|
| Equity/Bond corr   | Positive = risk-on, Negative = flight  |
| Copper/Gold ratio  | Rising = growth, Falling = defensive   |
| USD vs Risk        | Inverse = normal, Positive = stress    |

### 5. Flow (Weight: 10%)
| Indicator       | Signal                                  |
|-----------------|-----------------------------------------|
| Dark pool       | Large prints above ask = accumulation   |
| Options GEX     | Positive = dealer suppresses vol        |
| Dealer position | Net long gamma = pinning, short = vol   |

### 6. Volatility (Weight: 10%)
| Indicator         | Signal                                  |
|-------------------|-----------------------------------------|
| VIX term structure| Contango = complacent, Backwardation = fear |
| VVIX              | High = uncertainty about uncertainty    |
| RV vs IV          | RV > IV = vol underpriced               |
| Skew              | Steep = hedging demand, Flat = complacent |

## Composite Score Calculation
```
Composite = (Trend * 0.25) + (Momentum * 0.20) + (MeanReversion * 0.15)
           + (CrossAsset * 0.20) + (Flow * 0.10) + (Volatility * 0.10)
```

Score range: -5 (strong short) to +5 (strong long)

## Confluence Rules
- **Strong signal**: 4+ categories aligned in same direction
- **Moderate signal**: 3 categories aligned
- **Weak/conflicting**: <3 categories aligned -> reduce size or wait
- **Divergence alert**: Quant vs Macro disagreement -> flag immediately

## Output Format

```markdown
## Signal Dashboard -- {date}

### CONVICTION MATRIX
| Asset    | Direction  | Score (-5 to +5) | Timeframe  | Catalyst    |
|----------|------------|-------------------|------------|-------------|
| ...      | LONG/SHORT | +X.X              | X-X weeks  | ...         |

### SIGNAL DETAIL: {asset}
| Signal Category | Score | Key Observation         |
|-----------------|-------|-------------------------|
| Trend           | +X.X  | ...                     |
| Momentum        | +X.X  | ...                     |
| Mean Reversion  | +X.X  | ...                     |
| Cross-Asset     | +X.X  | ...                     |
| Flow            | +X.X  | ...                     |
| Volatility      | +X.X  | ...                     |
| **COMPOSITE**   | +X.X  | ...                     |

### SIGNAL CONFLUENCE
- Assets with 3+ confirming signals: [list]
- Divergences / Red flags: [list]

### CORRELATION ALERT
- Unusual cross-asset moves: [describe]
```
