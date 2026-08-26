# Quant Macro Agent Team

ระบบ Multi-Agent ที่เป็น **Macro Confluence Layer** สำหรับ swing trader — ทำงานผ่าน Claude Code

> *"It's not whether you're right or wrong, but how much money you make when you're right and how much you lose when you're wrong."* — Stanley Druckenmiller, *The New Market Wizards* (1992)

**แนวคิดหลัก:** คุณมีระบบ technical entry ของตัวเองอยู่แล้ว (กราฟ 1H – weekly) — ระบบนี้**ไม่สร้าง entry/stop/target ให้** หน้าที่ของมันคือตอบคำถามเดียว: *"macro หนุนหรือขวาง trade ที่กำลังจะเข้า?"*

**Universe:** XAUUSD, DXY, USDJPY, EURUSD, SPX, NDX + หุ้น US รายตัว

---

## สารบัญ

- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Slash Commands](#slash-commands)
- [Workflow](#workflow)
- [MCP Server & Data Sources](#mcp-server--data-sources)
- [Project Structure](#project-structure)
- [ข้อจำกัดที่ต้องรู้](#ข้อจำกัดที่ต้องรู้)
- [House Principles Inspired by Druckenmiller](#house-principles-inspired-by-druckenmiller)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR                              │
│           Druckenmiller-Inspired House Framework              │
├──────────┬───────────┬───────────┬───────────┬───────────────┤
│  NEWS    │  MACRO    │  BIAS     │  QUANT    │  RISK         │
│  SCANNER │  RESEARCH │  CHECKER  │  SIGNAL   │  MANAGER      │
│          │  (weekly) │ (pre-trade│ (macro    │ (validate     │
│          │           │ fast path)│  tape)    │ user's trade) │
└──────────┴───────────┴───────────┴───────────┴───────────────┘
หลักการร่วม: ไม่มี agent ไหน invent price levels — ผู้ใช้เป็นเจ้าของกราฟ
```

| Agent | หน้าที่ | Trigger |
|-------|---------|---------|
| **news-scanner** | สแกนข่าว market-moving + catalysts 10 วันข้างหน้า (วันที่/เวลา ET จริง) | เช้า/เย็น ทุกวัน |
| **macro-researcher** | วิเคราะห์ house 6 pillars → regime + expectations gap + **Per-Asset Macro Bias Table** | Weekly / regime shift |
| **bias-checker** ⭐ | เช็ค macro confluence ก่อนเข้าไม้ → macro sizing permission | ก่อนเข้าทุกไม้ |
| **quant-signal** | macro tape ยืนยัน thesis ไหม (composite −5..+5) — ไม่ใช่ chart reading | หลังตั้ง thesis / เช็ค divergence |
| **risk-manager** | validate trade ที่**คุณ**ออกแบบ (entry/stop/target ต้องมาจากคุณ) | ก่อน execute ทุกครั้ง |

### Timeframe Map

```
/regime (weekly macro context)
   └─> /bias (pre-trade confluence check — ก่อนเข้าทุกไม้)
          └─> entry จากกราฟของคุณเอง (1H–4H)
```

---

## Getting Started

### Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)
- Node.js 18+ (สำหรับ build MCP server)
- API keys (ฟรีทั้งหมด — ดูตารางด้านล่าง)

### 1. Build MCP Server

```bash
cd mcp-news-server
npm install
npm run build
npm test        # ต้องเขียวทั้งหมด
```

### 2. ตั้งค่า API Keys

```bash
cp .mcp.json.example .mcp.json
```

แก้ `.mcp.json`: ใส่ absolute path ของ `mcp-news-server/dist/index.js` และ API keys:

| Key | สมัครที่ | ใช้กับ |
|-----|---------|--------|
| `FRED_API_KEY` | [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html) | **hard data หลัก** — macro series + release calendar |
| `FINNHUB_API_KEY` | [finnhub.io](https://finnhub.io) | breaking news, earnings |
| `ALPHA_VANTAGE_API_KEY` | [alphavantage.co](https://www.alphavantage.co) | news sentiment |
| `NEWSAPI_API_KEY` | [newsapi.org](https://newsapi.org) | targeted news search |
| `SERPAPI_API_KEY` | [serpapi.com](https://serpapi.com) | Google search (quota 100/เดือน — ใช้น้อยที่สุด) |
| `CFTC_APP_TOKEN` | ไม่ต้องมี (ฟรี ไม่ต้อง key) | COT positioning |

> ⚠️ `.mcp.json` ถูก gitignore ไว้แล้ว — **ห้าม commit** เด็ดขาด

### 3. เริ่มใช้งาน

```bash
claude
```

---

## Slash Commands

| Command | Agent | ใช้เมื่อ |
|---------|-------|---------|
| `/scan` | news-scanner | เช้า/เย็น — ข่าว + catalysts |
| `/regime` | macro-researcher | weekly — regime + Per-Asset Bias Table |
| `/bias {asset} {dir?} {horizon?}` ⭐ | bias-checker | **ก่อนเข้าทุกไม้** |
| `/signal {asset?}` | quant-signal | เช็ค macro tape confirmation |
| `/risk {asset} {dir} entry= stop= target=` | risk-manager | ก่อน execute |
| `/decide` | ทุก agent | weekly deep dive |

ทุก command export รายงานภาษาไทยลง `summary/{news,regime,bias,signals,risk,decide}.md`

### `/scan` — News Scanner

```
/scan
```

**Output:** News Digest (HIGH/MEDIUM impact) + CATALYSTS AHEAD 10 วันข้างหน้า พร้อมวันที่ + เวลา ET จริงจาก release calendar

### `/regime` — Macro Regime Check (weekly)

```
/regime
```

**Output:** Regime classification + data dates + dashboards + KEY THESIS + expectations/pricing gap + **Per-Asset Macro Bias Table** — ตารางนี้คือสิ่งที่ `/bias` ใช้ทั้งสัปดาห์ (เกิน 7 วัน = stale) RoC อย่างเดียวไม่ถือเป็นหลักฐานว่าตลาด mispriced

| Regime | สภาวะ | Strategy |
|--------|--------|----------|
| GOLDILOCKS | Growth ↑ Inflation ↓ Liquidity ↑ | Risk-on macro lean; ยังไม่ใช่คำสั่ง sizing |
| REFLATION | Growth ↑ Inflation ↑ | Commodities, Value |
| STAGFLATION | Growth ↓ Inflation ↑ Liquidity ↓ | Defensive, Gold |
| DEFLATION | Growth ↓ Inflation ↓ Liquidity ↑ | Bonds, Quality Growth |
| TRANSITION | Mixed signals | ลดขนาด, รอความชัดเจน |

### `/bias {asset} {direction} {holding_window?}` ⭐ — Pre-Trade Fast Path

เจอ setup จากกราฟตัวเองแล้ว → เช็คก่อนเข้าไม้:

```
/bias XAUUSD long 5d
/bias NDX short 10d
```

**Output:** Macro Bias Card
- **VERDICT:** WITH-MACRO / NEUTRAL / AGAINST-MACRO
- Evidence clusters (Δ3M + direction-aware RoC) + expectations status + event risk ใน holding window + invalidation
- **Macro Sizing Permission**:

| Permission | เงื่อนไข |
|------------|---------|
| ELIGIBLE | WITH-MACRO + regime สด + pricing gap VERIFIED + ไม่มี unmanaged HIGH event/blind spot |
| REDUCED | NEUTRAL, event risk, regime stale, pricing UNVERIFIED, หรือ fragility สำคัญ |
| WITHHELD | AGAINST-MACRO, ไม่มี direction, หรือ driver หลักตรวจไม่ได้ |

`ELIGIBLE` ไม่ได้แปลว่า full size; ขนาดจริงต้องผ่าน chart confirmation, stop, payoff asymmetry,
instrument liquidity และ portfolio exposure ก่อน

### `/signal {asset?}` — Macro Tape Confirmation

```
/signal XAUUSD
```

**Output:** Composite score −5..+5 จาก 5 หมวด (−1/0/+1 ต่อหมวด):
1. USD tape (Broad USD Δ3M + RoC)
2. Real rates & curve (10Y real yield, 10Y−3M)
3. Liquidity pulse (Fed B/S, RRP, reserves, NFCI)
4. Vol & credit (VIX, HY/IG OAS)
5. Sentiment & positioning (news sentiment + COT — positioning ตึงระดับปี = crowded)

> ไม่มี RSI/MA/VWAP — คุณเป็นเจ้าของกราฟ นี่คือ macro tape ล้วนๆ

### `/risk` — Validate Your Trade

```
/risk XAUUSD long entry=2650 stop=2620 target=2760 horizon=5d
```

- entry/stop/target **มาจากคุณเท่านั้น** — ขาดข้อไหน agent จะถาม ไม่ invent ราคาให้
- R:R ต้อง ≥ 3:1 + เช็ค HIGH event ใน horizon + invalidation ต้องเป็นเงื่อนไข macro ที่วัดได้

**Verdict:** GO / REDUCE / NO-GO — หลักฐานไม่พอเป็นเหตุผลที่ถูกต้องสำหรับ NO-GO/CASH

### `/decide` — Full Pipeline

```
/decide
```

รันทุก agent ตามลำดับ → THE THESIS / REGIME / CONVICTION / EXPECTATIONS & PRICING GAP / WHAT CHANGES MY MIND / TRADE EXPRESSION (levels มาจากกราฟคุณ หรือ mark "awaiting user levels")

> ถ้าไม่มี fat pitch → **CASH IS THE POSITION**

---

## Workflow

### Daily / Pre-trade

```
เช้า:        /scan                       → News Digest + catalysts วันนี้
ก่อนเข้าไม้:  /bias {asset} {direction} {horizon?} → Macro Bias Card + sizing permission
ก่อน execute: /risk {asset} {dir} entry= stop= target= → GO / REDUCE / NO-GO
เย็น:        /scan                       → after-hours catalysts
```

### Weekly

```
จันทร์:  /regime  → classify regime + Per-Asset Macro Bias Table
ad-hoc: /decide  → full pipeline เมื่อต้องการ deep dive ทั้งระบบ
```

---

## MCP Server & Data Sources

MCP server `macro-news-feed` (`mcp-news-server/`) มี 13 tools:

| Tool | Backend | หมายเหตุ |
|------|---------|----------|
| `get_fred_macro_data` | FRED | **hard data หลัก** — 20 series, 4 categories + `all`, รวม real GDP growth QoQ SAAR + Core CPI; ตารางมี Δ Prev / Δ 3M / Δ 1Y / YoY % / direction-aware **RoC** |
| `get_release_calendar` | FRED + FOMC + RBA schedules | CPI/NFP/Core PCE/GDP/PPI (08:30 ET) + FOMC (14:00 ET) + RBA cash rate (14:30 Sydney → ET) |
| `get_cot_positioning` | CFTC Socrata (ฟรี) | COT non-commercial: net, weekly Δ, % of OI, 52w percentile — Gold/EUR/JPY/USD Index/AUD/CHF/ES/NQ |
| `get_breaking_news` | Finnhub + RSS | ข่าวเร็วสุด — ใช้เป็นหลัก |
| `get_rss_feeds` | RSS 12 feeds | Reuters/CNBC/AP/Fed — ไม่มี quota |
| `get_market_news` | Finnhub | ข่าวหุ้น US รายตัว |
| `get_earnings_calendar` | Finnhub | earnings dates + surprise |
| `get_news_sentiment` | Alpha Vantage | 4 req/min |
| `search_news` | NewsAPI | 100 req/วัน |
| `google_news_search` / `google_macro_search` / `google_market_overview` | SerpAPI | ⚠️ 100 req/**เดือน** — ใช้เท่าที่จำเป็น |
| `google_finance_quote` | SerpAPI | snapshot quote เท่านั้น ไม่มี OHLC |

### Maintenance

- `mcp-news-server/src/config/fomc-schedule.ts` — วัน FOMC hardcode ถึงสิ้นปี 2027 → tool เตือน `WARNING` เมื่อ window เกิน แล้วอัปเดตจาก federalreserve.gov
- `mcp-news-server/src/config/rba-schedule.ts` — วัน RBA hardcode **ถึง 2026-12-08** (2027 ยังไม่ประกาศ) → เก็บเป็นวันที่ซิดนีย์ ให้ tool แปลง ET เอง; tool เตือน `WARNING` เมื่อ window เกิน แล้วอัปเดตจาก rba.gov.au
- ก่อน restart server: `cd mcp-news-server && npm run build && npm test` ต้องเขียว

---

## Project Structure

```
agents_team_scan_marco/
├── .claude/commands/           # Slash commands
│   ├── scan.md  regime.md  bias.md  signal.md  risk.md  decide.md
│
├── agents/                     # Agent definitions
│   ├── news-scanner.md
│   ├── macro-researcher.md
│   ├── bias-checker.md
│   ├── quant-signal.md
│   └── risk-manager.md
│
├── mcp-news-server/            # MCP server (TypeScript)
│   ├── src/sources/            # FRED, CFTC, Finnhub, Alpha Vantage, NewsAPI, SerpAPI, RSS
│   ├── src/tools/              # 13 MCP tools
│   ├── src/config/             # FOMC schedule, RSS sources
│   └── src/__tests__/
│
├── summary/                    # รายงานที่ export จากทุก command
│   ├── news.md  regime.md  bias.md  signals.md  risk.md  decide.md
│
├── data/sessions/              # Session logs
├── templates/decision.md       # Trade Decision template
├── CLAUDE.md                   # Master system prompt
├── .mcp.json.example           # MCP config template (copy → .mcp.json + ใส่ keys)
└── .gitignore                  # .mcp.json ถูก ignore — keys ไม่ขึ้น repo
```

---

## ข้อจำกัดที่ต้องรู้

- **ไม่มี price/OHLC feed จริง** → ไม่มี agent ไหนอ้าง technical indicators หรือ invent ราคา — กราฟเป็นของคุณ
- Economic calendar ครอบเฉพาะ US releases หลัก + FOMC — ISM/BOJ/ECB ต้องอาศัยข่าว
- COT เป็นรายสัปดาห์ (ข้อมูล ณ วันอังคาร ออกศุกร์ ~15:30 ET) — ใช้ shade verdict ไม่ใช่ timing

---

## House Principles Inspired by Druckenmiller

หลักการต่อไปนี้เป็นการสรุปเพื่อใช้งานของระบบ ไม่ใช่ quote หรือ proprietary checklist ของ Druckenmiller:

1. **Liquidity First, Not Liquidity Only** — เริ่มจาก liquidity แล้วยืนยันด้วย cross-asset evidence
2. **Direction-Aware Inflections** — อ่าน Δ3M คู่กับ rising/falling faster/slower
3. **Expectations Before Mispricing** — macro view ที่ถูกไม่เท่ากับตลาด price ผิด
4. **Concentration Must Be Earned** — ต้องมี thesis, catalyst, confirmation, liquidity และ asymmetry
5. **Change When Evidence Changes** — thesis broken ให้ลด/ออก ไม่ผูกติดกับ narrative
6. **Cash Is Valid** — หากหลักฐานหรือ asymmetry ไม่พอ ไม่ต้องฝืนเทรด

---

## License

For personal/educational use only. Not financial advice.
