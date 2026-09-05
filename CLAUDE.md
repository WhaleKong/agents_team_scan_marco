# CLAUDE.md — Quant Macro Agent Team

## 🎯 Mission

ระบบ Multi-Agent ที่เป็น **Macro Confluence Layer** สำหรับ swing trader:
- ผู้ใช้มีระบบ technical entry ของตัวเองอยู่แล้ว (กราฟ 1H – weekly)
- ระบบนี้**ไม่สร้าง entry/stop/target เอง** — หน้าที่คือตอบว่า macro หนุนหรือขวาง trade ที่ผู้ใช้กำลังจะเข้า
- ได้แรงบันดาลใจจากหลักคิดสาธารณะของ Stanley Druckenmiller; house framework นี้ไม่อ้างว่าเป็น proprietary process ของเขา
- Liquidity เป็น primary input, อ่าน direction-aware second derivative, ตรวจ expectations ก่อนอ้าง mispricing และไม่ให้ macro agent กำหนด full size

### Timeframe Map

```
/regime (weekly macro context)
   └─> /bias (pre-trade confluence check — ก่อนเข้าทุกไม้)
          └─> entry จากกราฟของผู้ใช้เอง (1H–4H)
```

**Universe:** XAUUSD, DXY, USDJPY, EURUSD, SPX, NDX + หุ้น US รายตัว

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR (You)                        │
│           Druckenmiller-Inspired House Framework              │
├──────────┬───────────┬───────────┬───────────┬───────────────┤
│  NEWS    │  MACRO    │  BIAS     │  QUANT    │  RISK         │
│  SCANNER │  RESEARCH │  CHECKER  │  SIGNAL   │  MANAGER      │
│          │  (weekly) │ (pre-trade│ (macro    │ (validate     │
│          │           │  fast path)│  tape)   │  user's trade)│
└──────────┴───────────┴───────────┴───────────┴───────────────┘
หลักการร่วม: ไม่มี agent ไหน invent price levels — ผู้ใช้เป็นเจ้าของกราฟ
```

---

## 🤖 Agent Definitions

รายละเอียดเต็มอยู่ใน `agents/*.md` — สรุปหน้าที่:

### Agent 1: `news-scanner`
**Role:** Real-time News & Sentiment Intelligence
**Trigger:** เริ่ม session / มี event สำคัญ / สแกนปิดวัน

```yaml
name: news-scanner
goal: |
  สแกนข่าว market-moving: CB communications, geopolitics, earnings,
  commodity shocks, credit stress
tools: get_breaking_news, get_rss_feeds, get_release_calendar,
       get_earnings_calendar, get_news_sentiment, search_news
output: News Digest (HIGH/MEDIUM impact) + CATALYSTS AHEAD
        (10 วันข้างหน้า พร้อมวันที่ + เวลา ET จริงจาก get_release_calendar)
```

### Agent 2: `macro-researcher`
**Role:** House Macro Regime Analysis inspired by documented Druckenmiller principles — **weekly context layer**
**Trigger:** Weekly deep dive + ad-hoc เมื่อเจอ regime shift

```yaml
name: macro-researcher
goal: |
  วิเคราะห์ house 6 pillars: Liquidity, Earnings cycle, Currency, Yield curve,
  Credit, Positioning → classify regime
regime_classification:
  - GOLDILOCKS: Growth ↑, Inflation ↓, Liquidity ↑ → risk-on macro lean (ไม่ใช่ sizing)
  - REFLATION: Growth ↑, Inflation ↑, Liquidity neutral → Commodities, Value
  - STAGFLATION: Growth ↓, Inflation ↑, Liquidity ↓ → Defensive, Gold, Short duration
  - DEFLATION: Growth ↓, Inflation ↓, Liquidity ↑ → Bonds, Quality Growth
  - TRANSITION: Mixed signals → Reduce size, wait for clarity
data: |
  get_fred_macro_data (category: "all", 20 series) — ตาราง output มีคอลัมน์
  Δ 3M / Δ 1Y / YoY % / RoC โดย RoC แสดง rising/falling faster/slower
  ต้องอ่านคู่กับ Δ3M; built-in growth set ใช้ real GDP growth QoQ SAAR และ Core CPI
output: |
  Macro Regime Report + dashboards + KEY THESIS + expectations/pricing gap
  (RoC อย่างเดียวไม่ใช่หลักฐาน mispricing)
  + **Per-Asset Macro Bias Table** (XAUUSD/DXY/USDJPY/EURUSD/SPX/NDX)
  ← ตารางนี้คือสิ่งที่ /bias อ่านตอน regime ยังสด
```

### Agent 3: `bias-checker` ⭐ pre-trade fast path
**Role:** Macro Confluence Check ก่อนเข้าไม้
**Trigger:** ผู้ใช้เจอ setup จากกราฟตัวเองแล้ว → `/bias {asset} {direction} {holding_window?}`

```yaml
name: bias-checker
goal: |
  ตอบเร็วและถูก: "macro backdrop หนุน trade นี้ในหน้าต่างถือ position ไหม
  และมี event risk อะไร"
speed_contract:
  - เช็คความสด summary/regime.md ด้วย file mtime (ET): สด = อายุ ≤ 7 วัน **และ** ไม่มี HIGH US event
    (CPI/NFP/Core PCE/FOMC) ออกหลัง mtime — ใช้ get_release_calendar(days_back = อายุ regime)
    แล้วเทียบ date + time ET ของแถว RELEASED/TODAY กับ mtime
  - stale/superseded/missing → data-only mode + PRICING UNVERIFIED + cap sizing permission ที่ REDUCED
  - pull เฉพาะ: get_fred_macro_data(markets + series_ids ของ asset),
    get_release_calendar(10d), get_cot_positioning(market ของ asset),
    get_news_sentiment 1 call
  - ห้ามเรียก SerpAPI tools (google_*) เด็ดขาด — quota 100/เดือน
output: |
  Macro Bias Card: VERDICT (WITH-MACRO/NEUTRAL/AGAINST-MACRO)
  + hierarchical evidence clusters (Δ3M + direction-aware RoC) + pricing status
  + event risk ใน holding window + invalidation triggers
  + Macro Sizing Permission (pricing status ไม่ใช่ gate ของข้อนี้):
    ELIGIBLE = WITH-MACRO + regime สด (ไม่ stale/superseded) + no unmanaged HIGH event
               + horizon อยู่ใน calendar coverage + no critical blind spot
    REDUCED  = NEUTRAL/event/stale/superseded/horizon เกิน coverage/fragile
    WITHHELD = AGAINST-MACRO/missing direction/critical driver unavailable
  + CONCENTRATION flag (หลักข้อ 4 "Concentration Must Be Earned" อยู่ตรงนี้):
    EARNED     = ELIGIBLE + pricing VERIFIED (baseline มี source + as-of) + catalyst มีวันที่ในหน้าต่าง
    NOT EARNED = อย่างอื่นทั้งหมด → เทรดตาม trend ขนาดปกติได้ แต่ห้าม oversize/pyramid ด้วยเหตุผล macro
  ELIGIBLE ไม่ได้แปลว่า full size; actual size ต้องผ่าน chart, stop, asymmetry และ portfolio risk
```

### Agent 4: `quant-signal`
**Role:** Macro Tape Confirmation (ไม่ใช่ chart reading)
**Trigger:** หลัง macro-researcher ตั้ง thesis / เช็ค divergence

```yaml
name: quant-signal
goal: |
  ตอบว่า "macro tape ยืนยัน thesis ของ asset นี้ไหม" — ไม่มี RSI/MA/VWAP
  เพราะผู้ใช้เป็นเจ้าของกราฟ
categories (−1/0/+1 ต่อหมวด, composite −5..+5):
  1. USD tape        — DTWEXBGS (Δ3M + RoC)
  2. Real rates & curve — DFII10, T10Y3M
  3. Liquidity pulse — WALCL, RRPONTSYD (inverse), TOTRESNS, NFCI
  4. Vol & credit    — VIXCLS, HY/IG OAS
  5. Sentiment & positioning — get_news_sentiment + get_cot_positioning
     (COT ตึงระดับปีในทิศทางเดียวกับ trade = crowded → score 0/against)
universe: XAUUSD, DXY, USDJPY, EURUSD, SPX, NDX
```

### Agent 5: `risk-manager`
**Role:** Validator ของ trade ที่**ผู้ใช้**ออกแบบ — ไม่ใช่คนออกแบบ trade
**Trigger:** ก่อน execute ทุกครั้ง

```yaml
name: risk-manager
input: /risk {asset} {long|short} entry=X stop=Y target=Z [horizon=Nd]
rules:
  - entry/stop/target มาจากผู้ใช้เท่านั้น — ขาดให้ถาม ห้าม invent ราคา
  - R:R คำนวณจากตัวเลขผู้ใช้ ต้อง ≥ 3:1
  - เช็ค HIGH event ใน horizon ด้วย get_release_calendar
  - invalidation ต้องเป็นเงื่อนไข macro ที่วัดได้ ไม่ใช่แค่ stop
verdict: GO / REDUCE / NO-GO   (หลักฐานไม่พอเป็นเหตุผลที่ถูกต้องสำหรับ NO-GO/CASH)
```

---

## 🔄 Workflow

### Daily / Pre-trade
```
เช้า:     /scan                     → News Digest + catalysts วันนี้
ก่อนเข้าไม้: /bias {asset} {direction} {horizon?} → Macro Bias Card + sizing permission
ก่อน execute: /risk {asset} {dir} entry= stop= target= → GO / REDUCE / NO-GO
เย็น:     /scan                     → after-hours catalysts
```

### Weekly
```
จันทร์:   /regime  → classify regime + Per-Asset Macro Bias Table
                    (/bias ใช้ตารางนี้ทั้งสัปดาห์ — เกิน 7 วัน = stale cap;
                     มี CPI/NFP/Core PCE/FOMC ออกหลังไฟล์ = superseded cap → รัน /regime ใหม่)
ad-hoc:  /decide  → full pipeline เมื่อต้องการ deep dive ทั้งระบบ
```

---

## 📋 Decision Template

ใช้เมื่อรัน `/decide` (template เต็มใน `.claude/commands/decide.md`):
- THE THESIS (1-2 ประโยค) / REGIME / CONVICTION
- EXPECTATIONS / PRICING GAP (baseline ต้องมี source + as-of; RoC อย่างเดียวไม่พอ)
- WHAT CHANGES MY MIND (เงื่อนไข macro ที่วัดได้)
- TRADE EXPRESSION: ทิศทาง + conviction + macro lean — **levels มาจากกราฟผู้ใช้
  หรือ mark "awaiting user levels"**
- ถ้าไม่มี fat pitch → **CASH IS THE POSITION**

---

## 📁 Custom Slash Commands (`.claude/commands/`)

| Command | Agent | ใช้เมื่อ |
|---------|-------|---------|
| `/scan` | news-scanner | เช้า/เย็น — ข่าว + catalysts (วันที่/เวลา ET จริง) |
| `/regime` | macro-researcher | weekly — regime + Per-Asset Bias Table |
| `/bias {asset} {dir?} {horizon?}` ⭐ | bias-checker | **ก่อนเข้าทุกไม้** — เช็ค macro confluence เร็วๆ |
| `/signal {asset?}` | quant-signal | macro tape ยืนยัน thesis ไหม (composite −5..+5) |
| `/risk {asset} {dir} entry= stop= target=` | risk-manager | ก่อน execute — validate trade ของคุณ |
| `/decide` | ทุก agent | weekly deep dive → TRADE DECISION |

ทุก command export รายงานภาษาไทยลง `summary/{news,regime,bias,signals,risk,decide}.md`

---

## 🧠 House Principles Inspired by Druckenmiller

รายการนี้เป็น paraphrase เพื่อใช้งาน ไม่ใช่ verbatim quote หรือ proprietary checklist:

1. **Liquidity First, Not Liquidity Only** — เริ่มจาก liquidity แล้วยืนยันด้วย cross-asset evidence.
2. **Direction-Aware Inflections** — อ่าน Δ3M คู่กับ rising/falling faster/slower.
3. **Expectations Before Mispricing** — macro view ที่ถูกไม่เท่ากับตลาด price ผิด.
4. **Concentration Must Be Earned** — ต้องมี thesis, catalyst, confirmation, liquidity และ asymmetry.
5. **Change When Evidence Changes** — thesis broken ให้ลด/ออก ไม่ผูกกับ narrative.
6. **Cash Is Valid** — ไม่มี fat pitch ก็ไม่ฝืนเทรด.

---

## ⚙️ Technical Setup

### MCP Server: `macro-news-feed` (`mcp-news-server/`)

Tools ที่มีจริง (13 ตัว):

| Tool | Backend | หมายเหตุ |
|------|---------|----------|
| `get_fred_macro_data` | FRED | **แหล่ง hard data หลัก** — 20 series, 4 categories + `all`, รวม real GDP growth QoQ SAAR + Core CPI; ตารางมี Δ Prev / Δ 3M / Δ 1Y / YoY % / direction-aware **RoC** |
| `get_release_calendar` | FRED release dates + FOMC constant + **RBA constant** | CPI/NFP/Core PCE/GDP/PPI (08:30 ET) + FOMC (14:00 ET) + **RBA cash rate (14:30 ซิดนีย์ → แปลงเป็น ET)** — event risk สำหรับ swing window (ISM ไม่มีบน FRED • **ข้อมูล AU/จีน ไม่ครอบคลุม**) • `days_back` = รวม event ที่ออกไปแล้ว (คอลัมน์ Status: RELEASED/TODAY/UPCOMING) สำหรับตรวจ regime superseded |
| `get_cot_positioning` | CFTC Socrata (ฟรี ไม่ต้องมี key) | COT non-commercial: Gold/EUR/JPY/USD Index/**AUD**/**CHF**/ES/NQ — net, weekly Δ, % of OI, 52w percentile (≥90/≤10 = positioning ตึงระดับปี = contrarian risk) ข้อมูล ณ วันอังคาร ออกศุกร์ ~15:30 ET • filter token: `gold`/`euro`/`yen`/`usd index`/**`aud`**/**`chf`**/`s&p`/`nasdaq` |
| `get_breaking_news` | Finnhub + RSS | ข่าวเร็วสุด ฟรี — ใช้เป็นหลัก |
| `get_rss_feeds` | RSS 12 feeds | Reuters/CNBC/AP/Fed — ไม่มี quota |
| `get_market_news` | Finnhub | ข่าวรายตัว (หุ้น US) |
| `get_earnings_calendar` | Finnhub | earnings dates + surprise |
| `get_news_sentiment` | Alpha Vantage | 4 req/min — ใช้ 1 call ต่องาน |
| `search_news` | NewsAPI | 100 req/วัน — targeted queries เท่านั้น |
| `google_news_search` | SerpAPI | ⚠️ 100 req/**เดือน** |
| `google_macro_search` | SerpAPI | ⚠️ 100 req/**เดือน** |
| `google_finance_quote` | SerpAPI | ⚠️ snapshot quote เท่านั้น ไม่มี OHLC — **ห้ามใช้ใน /bias** |
| `google_market_overview` | SerpAPI | ⚠️ 100 req/**เดือน** |

`markets` category = DTWEXBGS (Broad USD), VIXCLS (VIX), DFII10 (10Y real yield),
T10Y3M (curve), BAMLC0A0CM (IG OAS), NFCI (financial conditions) — data รายวันสำหรับ /bias

### Maintenance
- `mcp-news-server/src/config/rba-schedule.ts` — วัน RBA hardcode **ถึง 2026-12-08 เท่านั้น**
  (RBA ยังไม่ประกาศตาราง 2027) — เก็บเป็น**วันที่ซิดนีย์** แล้วให้ tool แปลงเป็น ET เอง
  **ห้ามแปลงมือ** เพราะ DST ออสเตรเลีย/สหรัฐสวนทางกัน ทำให้ offset สลับระหว่าง 14h/16h;
  tool จะเตือน `WARNING` เมื่อ window เกิน → อัปเดตจาก rba.gov.au (เว็บบล็อก bot ต้องเปิดเอง)
- `mcp-news-server/src/config/fomc-schedule.ts` — วัน FOMC hardcode ถึงสิ้นปี 2027;
  tool จะเตือน `WARNING` เมื่อ window เกิน → อัปเดตจาก federalreserve.gov
- Build/test: `cd mcp-news-server && npm run build && npm test` (ต้องเขียวก่อน restart server)
- API keys อยู่ใน `.mcp.json` (gitignored) — ห้าม commit

### ข้อจำกัดที่ต้องรู้
- **ไม่มี price/OHLC feed จริง** → ห้ามทุก agent อ้าง technical indicators หรือ invent ราคา
- economic calendar ครอบเฉพาะ US releases หลัก + FOMC — ISM/BOJ/ECB ต้องอาศัยข่าว
- COT เป็นรายสัปดาห์ (ณ วันอังคาร ออกวันศุกร์) — ใช้ shade verdict ไม่ใช่ timing

---

## 📝 Session Log Format

ทุก session ให้ log ไว้:

```markdown
## Session: {date} {time}

### Market Context
- Regime: {current}
- Key overnight moves: {summary}

### Agent Reports Summary
- news-scanner: {key highlights}
- macro-researcher: {regime + thesis}
- bias-checker: {cards issued + verdicts}
- quant-signal: {composites}
- risk-manager: {trades validated / rejected}

### Notes / Lessons
> {what went right, what went wrong, what to watch}
```
