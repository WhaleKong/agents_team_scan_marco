# Quant Macro Agent Team

ระบบ Multi-Agent สำหรับ Macro Trading แบบ Stanley Druckenmiller ทำงานผ่าน Claude Code

> *"It's not whether you're right or wrong, but how much money you make when you're right and how much you lose when you're wrong."*

---

## สารบัญ

- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Slash Commands](#slash-commands)
- [Daily Workflow](#daily-workflow)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Portfolio Management](#portfolio-management)
- [Druckenmiller Principles](#druckenmiller-principles)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  ORCHESTRATOR                        │
│         Druckenmiller Decision Framework             │
├──────────┬──────────┬──────────┬────────────────────┤
│  NEWS    │  MACRO   │  QUANT   │  RISK              │
│  SCANNER │  RESEARCH│  SIGNAL  │  MANAGER           │
│          │  ER      │          │                    │
└──────────┴──────────┴──────────┴────────────────────┘
```

| Agent | หน้าที่ | Trigger |
|-------|---------|---------|
| **news-scanner** | สแกนข่าวและ sentiment | ทุก session / event สำคัญ |
| **macro-researcher** | วิเคราะห์ regime (Goldilocks/Reflation/Stagflation/Deflation) | Weekly / regime shift |
| **quant-signal** | สร้าง signal เชิงปริมาณ score -5 ถึง +5 | หลัง regime assessment |
| **risk-manager** | Position sizing & risk control | ก่อนทุก trade decision |

---

## Getting Started

### Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) ติดตั้งแล้ว
- API keys สำหรับ data sources (optional แต่แนะนำ)

### 1. Clone & Setup

```bash
cd agents_team_scan_marco
cp .env.example .env
# แก้ไข .env ใส่ API keys ของคุณ
```

### 2. ใส่ API Keys (optional)

แก้ไขไฟล์ `.env`:

```bash
FRED_API_KEY=your_key_here        # Fed data, yield curves, M2
ALPHA_VANTAGE_API_KEY=your_key    # Macro indicators, FX
NEWSAPI_API_KEY=your_key          # Aggregated news
FINNHUB_API_KEY=your_key          # Earnings, SEC filings
```

> หากไม่มี API keys ระบบจะใช้ WebSearch เป็น fallback ได้

### 3. เริ่มใช้งาน

```bash
claude
```

จากนั้นใช้ slash commands ด้านล่าง

---

## Slash Commands

### `/scan` — News Scanner

สแกนข่าวล่าสุดที่กระทบตลาด

```
/scan
```

**Output:** News Digest แยกตาม impact level (HIGH/MEDIUM), sentiment shift, และ catalysts 7 วันข้างหน้า

**ใช้เมื่อ:** เปิด session ใหม่, ก่อนตลาดเปิด, หรือเมื่อมี event สำคัญ

---

### `/regime` — Macro Regime Check

วิเคราะห์ macro regime ปัจจุบัน

```
/regime
```

**Output:** Regime classification + dashboards 3 ตัว (Liquidity, Growth, Inflation) + mispricing ที่ตลาดมองข้าม

**Regime ที่เป็นไปได้:**
| Regime | สภาวะ | Strategy |
|--------|--------|----------|
| GOLDILOCKS | Growth ↑ Inflation ↓ Liquidity ↑ | Risk ON เต็มที่ |
| REFLATION | Growth ↑ Inflation ↑ | Commodities, Value |
| STAGFLATION | Growth ↓ Inflation ↑ Liquidity ↓ | Defensive, Gold |
| DEFLATION | Growth ↓ Inflation ↓ Liquidity ↑ | Bonds, Quality Growth |
| TRANSITION | Mixed signals | ลดขนาด, รอความชัดเจน |

---

### `/signal {asset}` — Quant Signal Check

เช็ค signal เชิงปริมาณของ asset

```
/signal SPX
/signal Gold
/signal USDJPY
```

ถ้าไม่ระบุ asset จะรันทุก instrument ใน universe

**Output:** Signal score -5 (strong short) ถึง +5 (strong long) จาก 6 categories:
1. Trend (50/200 DMA, ADX)
2. Momentum (RSI, MACD)
3. Mean Reversion (Bollinger, z-score)
4. Cross-Asset (correlations)
5. Flow (options, dark pool)
6. Volatility (VIX structure, skew)

---

### `/risk {trade_idea}` — Pre-Trade Risk Check

ประเมินความเสี่ยงก่อนเข้าเทรด

```
/risk Long Gold on stagflation thesis
/risk Short SPX via puts
/risk Long Crude Oil breakout
```

**Output:** Pre-trade checklist (7 items), position sizing recommendation, kill switch conditions

**ต้องผ่านทุกข้อ:**
- [x] Macro regime supports direction?
- [x] Quant signals confirm (3+ aligned)?
- [x] Risk/Reward >= 3:1?
- [x] Portfolio heat within 6% limit?

---

### `/decide` — Full Pipeline Decision

รัน **ทั้ง 4 agents** ตามลำดับ แล้วสังเคราะห์เป็น trade decision

```
/decide
```

**Pipeline:**
1. news-scanner → สแกนข่าว
2. macro-researcher → วิเคราะห์ regime
3. quant-signal → เช็ค signals
4. risk-manager → sizing & risk

**Output:** Trade Decision พร้อม thesis, entry/stop/target, R:R ratio, Druckenmiller gut check

> ถ้าไม่มี high-conviction trade → output = **"CASH IS THE POSITION"**

---

### `/review` — Portfolio Review

รีวิว portfolio และ open positions ทั้งหมด

```
/review
```

**สำหรับแต่ละ position จะแนะนำ:**
- **ADD** — thesis แข็งแกร่งขึ้น เพิ่มขนาด
- **HOLD** — thesis ยังใช้ได้ คงไว้
- **REDUCE** — take profit บางส่วน หรือ thesis อ่อนลง
- **CUT** — thesis invalidated ออกทันที

---

## Daily Workflow

### Morning (ก่อนตลาดเปิด)

```
1. /scan          ← สแกนข่าว overnight
2. /regime        ← update regime ด้วยข้อมูลใหม่
3. /signal        ← เช็ค signals ทั้งหมด
4. /risk {idea}   ← ถ้ามี trade idea ให้ประเมิน risk
5. /decide        ← หรือรัน full pipeline ทีเดียว
```

### Evening (หลังตลาดปิด)

```
6. /scan          ← สแกน after-hours catalysts
7. /review        ← รีวิว P&L, ปรับ stops, rebalance
```

### Weekly (ทุกวันจันทร์)

```
/regime           ← deep dive macro regime
/review           ← full portfolio review
```

---

## Project Structure

```
agents_team_scan_marco/
├── .claude/commands/           # Slash commands
│   ├── scan.md                 # /scan
│   ├── regime.md               # /regime
│   ├── signal.md               # /signal {asset}
│   ├── risk.md                 # /risk {trade_idea}
│   ├── decide.md               # /decide
│   └── review.md               # /review
│
├── agents/                     # Agent definitions & prompts
│   ├── news-scanner.md
│   ├── macro-researcher.md
│   ├── quant-signal.md
│   └── risk-manager.md
│
├── config/
│   ├── instruments.yaml        # Instrument universe & tickers
│   ├── api-sources.yaml        # API endpoints & data sources
│   └── risk-params.yaml        # Risk limits & parameters
│
├── data/
│   ├── portfolio/
│   │   └── portfolio-state.json  # Portfolio state (NAV, positions)
│   └── sessions/               # Session logs
│
├── templates/
│   ├── decision.md             # Trade Decision template
│   └── session-log.md          # Session Log template
│
├── CLAUDE.md                   # Master system prompt
├── .env.example                # API key template
└── .gitignore
```

---

## Configuration

### Instrument Universe (`config/instruments.yaml`)

Assets ที่ระบบติดตาม:

| Asset Class | Instruments |
|-------------|-------------|
| Equities | SPX, NDX, SET (Thai), EEM |
| Rates | US2Y, US10Y, US30Y, TH10Y |
| FX | DXY, USDTHB, USDJPY, EURUSD |
| Commodities | Gold, Crude, Copper, Nat Gas |
| Crypto | BTC, ETH (liquidity proxy) |

เพิ่ม/ลบ instruments ได้ในไฟล์ `config/instruments.yaml`

### Risk Parameters (`config/risk-params.yaml`)

| Parameter | Default |
|-----------|---------|
| Max single position | 30% NAV |
| Normal position | 5-10% NAV |
| Max portfolio heat | 6% |
| Max gross exposure | 150% |
| Drawdown circuit breaker | -5% MTD |
| Emergency halt | -10% MTD |

แก้ไขค่าเหล่านี้ได้ตามสไตล์การเทรดของคุณ

---

## Portfolio Management

Portfolio state ถูกเก็บใน `data/portfolio/portfolio-state.json`

### Initial State

```json
{
  "nav": 1000000,
  "currency": "USD",
  "positions": [],
  "portfolio_metrics": {
    "gross_exposure_pct": 0,
    "net_exposure_pct": 0,
    "portfolio_heat_pct": 0
  },
  "regime": {
    "current": "TRANSITION"
  }
}
```

### ปรับ NAV เริ่มต้น

แก้ไข `nav` ในไฟล์ `portfolio-state.json` ให้ตรงกับขนาด portfolio ของคุณ

### Session Logs

ทุก session จะบันทึกใน `data/sessions/` ตาม template:
- Market context & regime
- Actions taken (OPENED/CLOSED/ADJUSTED)
- Open positions table
- Portfolio summary
- Notes & lessons learned

---

## Druckenmiller Principles

หลักการ 8 ข้อที่ระบบใช้ในทุก decision:

1. **Liquidity is King** — Central bank balance sheets drive everything
2. **Second Derivative Thinking** — เทรด rate of change ของ rate of change
3. **Concentrate When Right** — เมื่อมั่นใจ ลงหนัก อย่ากระจาย
4. **Cut Immediately When Wrong** — ไม่มี ego, ไม่หวัง, ไม่ average down
5. **Don't Predict, React** — ใช้ liquidity + technical ไม่ใช่ valuation
6. **Be Flexible** — ไม่ต้องเล่นทุกตลาด เลือกเฉพาะ fat pitch
7. **Cash is a Position** — ไม่เห็น setup ที่ดี = นั่ง cash คือ trade ที่ดีที่สุด
8. **Asymmetry Over Frequency** — เทรดน้อย แต่ได้เยอะ ไม่ใช่เทรดเยอะ ได้น้อย

---

## License

For personal/educational use only. Not financial advice.
