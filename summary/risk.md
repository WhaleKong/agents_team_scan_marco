# การประเมินความเสี่ยง — SHORT XAUUSD (ทองคำ)

> รันโดย: `risk-manager` | 3 กรกฎาคม 2026 | อ้างอิง: regime.md (07-02 post-NFP, regime = **TRANSITION**) + news.md (07-02) + live quote GLD
> วินัยต่อเทรดแบบ Druckenmiller: "Stop บังคับ ตัดเมื่อธีสิสพัง ไม่ใช่เมื่อ P&L แดง" · "อย่า average down บนธีสิสที่พัง" · "เมื่อไม่รู้ ให้อยู่เฉย ๆ"
> **ราคาอ้างอิง:** GLD = **$377.60 (+1.89% วันที่ 2 ก.ค. หลัง NFP)** ≈ spot XAUUSD ~**$4,070** (แปลงด้วย ~×10.78 — โดยประมาณ) | GLD เพิ่งปิด **ไตรมาสแย่สุดในรอบกว่า 10 ปี** | ตลาดสหรัฐปิด 3 ก.ค. (วันหยุด) — สภาพคล่องบาง

---

## ⚖️ VERDICT: **NO-GO (ตอนนี้) — STAND ASIDE / รอเงื่อนไข 6 + 8 ก.ค.**

**เหตุผลหลักใน 1 บรรทัด:** นี่คือการ short สวน catalyst สด ๆ (NFP +57k → real rates ↓ → ทองเด้ง +1.9%) ใน regime TRANSITION โดยไม่มี signal ยืนยัน และธีสิสฝั่ง short ("Warsh Fed hawkish → real rates ขึ้น → ทองลง") **คือธีสิสที่ kill-switch เพิ่งทำงานเมื่อวานนี้เอง** — การกลับเข้า short ตอนนี้ = average down บนธีสิสที่พัง ซึ่งผิดกฎ Druckenmiller ตรง ๆ

---

### PRE-TRADE CHECKLIST

- [❌] **Macro regime รองรับทิศทาง?** — *ไม่ผ่าน*. Regime = **TRANSITION** (ตาราง size: probe หรือ stand aside เท่านั้น) และ catalyst ล่าสุด (NFP miss) เป็น**บวกต่อทอง**: yields ↓, hike premium ถูกถอน, DXY on probation. Playbook ปัจจุบันเขียนว่า "probe **long** duration/gold" — คำสั่งนี้คือฝั่ง**ตรงข้าม**กับ playbook
- [❌] **Quant signals ยืนยัน 3+ aligned?** — *ไม่ผ่าน*. ยังไม่ได้รัน `/signal XAUUSD` (signals.md ล่าสุดคือ GOOGL 06-29). ที่รู้: เทรนด์ใหญ่ลงจริง (ไตรมาสแย่สุดในทศวรรษ, ลบทั้งปี 2026) = 1 สัญญาณฝั่ง short — แต่ momentum วันล่าสุด**สวน** (+1.9% บน catalyst จริง) และไม่มี RSI/MA/COT/vol structure สด → ยืนยันได้ 1/6 ไม่ถึงเกณฑ์ 3+
- [❌] **News catalyst ชัด?** — *ไม่ผ่านสำหรับฝั่ง short*. Catalyst ที่เกิดจริงล่าสุดเป็นฝั่ง**ตรงข้าม** (NFP miss → bullish gold). Catalyst ฝั่ง short ยังเป็นแค่สมมติฐานอนาคต: ISM Services ร้อน (6 ก.ค.) / FOMC minutes hawkish จัด (8 ก.ค.) — **ยังไม่เกิด** → เข้า short ตอนนี้ = front-run catalyst ที่ยังไม่ยืนยัน
- [⚠️] **Invalidation ชัด?** — *นิยามได้แต่ข้อมูลบาง*. เชิงธีสิส: ถ้า ISM Services อ่อน (โดยเฉพาะ employment) + minutes ไม่ hawkish → dovish repricing เดินต่อ → ธีสิส short ตายสนิท. เชิงราคา: ยังไม่มีระดับ MA/swing สดของ XAUUSD ในระบบ
- [❌] **R:R ≥ 3:1?** — *ไม่ผ่านที่ market*. Short ที่ GLD $377.6, stop เหนือ bounce ~$392: risk ~$14. Target retest ฐานไตรมาส ~$369: reward ~$9 → **R:R ≈ 0.6:1**. ต้องใช้ target breakdown ลึก (~$355) ถึงจะแตะ ~3:1 — และตามกฎระบบ **conviction LOW ต้องการ ≥5:1** → ไม่ผ่านทุกกรณีที่ market
- [⚠️] **Stop ตั้งแล้ว?** — *ตั้งได้* (เหนือ post-NFP bounce) แต่อนุมานจากข้อมูลบาง — ยังไม่มีกราฟ/level สดของ spot

**สรุป: ไม่ผ่าน 4 / มีเงื่อนไข 2 → NO-GO ชัดเจน** (เทียบเกณฑ์: ALL must pass)

---

### TRADE SPEC

| Parameter | Value |
| --------- | ----- |
| Conviction Level | **LOW** (สวน catalyst + ไม่มี signal ยืนยัน + regime ไม่หนุน) |
| Size Bias | **Stand aside** (TRANSITION + conviction LOW + สวน playbook) |
| Entry Price | — ไม่แนะนำ entry ตอนนี้ (ดู "เงื่อนไขพิจารณาใหม่" ด้านล่าง) |
| Stop Loss | — |
| Target 1 | — |
| Target 2 | — |
| Risk/Reward | ที่ market ≈ **0.6:1** (ต่ำกว่าเกณฑ์มาก) |
| Timeframe | — |

> **"เมื่อไม่รู้ ให้อยู่เฉย ๆ" — CASH คือสถานะที่ valid.** ทองเพิ่งลงมาทั้งไตรมาส (แย่สุดในทศวรรษ) แปลว่าฝั่ง short คือ crowd เก่าที่กำไรมาแล้ว ขณะ premise (real rates ขึ้นจาก hawkish Fed) เพิ่งร้าว — asymmetry ของ short จากจุดนี้แย่: downside เหลือน้อย (retest ฐาน) แต่ upside risk เปิดกว้าง (short-covering + dovish repricing + วันหยุดสภาพคล่องบาง)

### 📋 เงื่อนไขพิจารณาใหม่ (ถ้ายังอยากเล่นฝั่ง short — เทรดนี้ "เร็วไป" ไม่ใช่ "ผิดตลอดกาล")

regime.md ระบุ mispricing #2 ไว้เอง: ตลาดเสี่ยง **overshoot ฝั่ง dovish** (เพราะ NFP miss ≠ growth scare — U-rate ลง, ISM 53.3) → fade ฝั่งกลับอาจเปิด**สัปดาห์หน้า** แต่ต้องให้ครบเงื่อนไขก่อน:

1. **Catalyst ยืนยันจริง:** ISM Services (6 ก.ค.) ออกแข็ง (โดยเฉพาะ employment ฟื้น) **และ/หรือ** FOMC minutes (8 ก.ค.) hawkish จัด (committee ใกล้ขึ้นดอกเบี้ยจริง)
2. **รัน `/signal XAUUSD` แล้วได้ score ≤ -2** (ยืนยัน 3+ สัญญาณฝั่ง short รวม momentum ที่พลิกกลับลง)
3. **เข้าตอนเด้ง ไม่เข้าตอนหลุด:** short บน failed rally (เช่น GLD โซน ~$385–390 / XAU ~$4,150–4,200 ถ้าเด้งถึง) ให้ stop แคบพอที่ R:R ≥ 5:1 (conviction LOW) — ถ้าเด้งไม่ถึง = ปล่อยผ่าน อย่าไล่ short ที่ต่ำ
4. **เช็ค COT ศุกร์นี้ก่อน:** ถ้า spec positioning ฝั่ง short ทองตึงอยู่แล้ว → ข้ามเทรดนี้ไปเลย (เบียดกับ crowd บนเทรนด์แก่)

> **ทางเลือกที่ asymmetry ดีกว่า ถ้า hawkish ยืนยันจริง (6+8 ก.ค.):** reload **long DXY / short duration** — เป็น expression ที่สด ยังไม่ crowded และตรง thesis กว่า การ short ทองหลังลงมาทั้งไตรมาสคือ expression ที่เหนื่อยสุดของธีม hawkish

---

### KILL SWITCH CONDITIONS (สำหรับกรณีฝืนเข้า หรือเข้าตามเงื่อนไขพิจารณาใหม่แล้ว)

- **ISM Services (6 ก.ค.) อ่อน — โดยเฉพาะ employment sub-index หดต่อ** → ธีสิส short ตาย → ออกทันที ห้ามต่อรอง
- **FOMC minutes (8 ก.ค.) โทน neutral/dovish** (committee ไม่ได้ใกล้ hike อย่างที่ตลาดเคยกลัว) → ออกทันที
- **GLD ปิดเหนือ post-NFP bounce high (~$392) / XAU ยืนเหนือ ~$4,225** → โครงสร้าง short-covering rally ทำงาน → ออก
- **DXY ทำ lower low ต่อหลัง NFP** → real-rate premise พังต่อเนื่อง → ออก
- **Repo/SOFR stress โผล่ต้นไตรมาส (RRP = $1B)** → เสี่ยง Fed ถูกบังคับหยุด QT = liquidity pivot บวกทอง → ออก/กลับข้าง
- เข้าแล้วกำไรถึง T1 → เลื่อน stop เป็น breakeven ทันที (เทรนด์แก่ อย่าให้กำไรกลายเป็นขาดทุน)

---

### 🧭 บทสรุป Druckenmiller

> **นี่ไม่ใช่ fat pitch — นี่คือการไล่เทรนด์แก่หลัง premise ของมันเพิ่งร้าวต่อหน้าเมื่อวาน.** ทองลงมาทั้งไตรมาส (แย่สุดในทศวรรษ) บนธีม "Warsh hawkish + real rates ขึ้น" — เมื่อวาน NFP +57k ถอนเสาหลักของธีมนั้นออก และทองเด้ง +1.9% ทันที. การ short ตรงนี้คือ (1) สวน catalyst สด (2) สวน playbook ของระบบเอง (3) ไม่มี signal ยืนยัน (4) R:R 0.6:1. ถ้าเชื่อว่าตลาดจะ overshoot ฝั่ง dovish — **รอให้มัน overshoot ก่อน แล้วค่อย fade ด้วย catalyst ยืนยัน (6+8 ก.ค.) บนราคาเด้ง ไม่ใช่เดาล่วงหน้าบนราคาฐานในสัปดาห์วันหยุด.** ระหว่างนี้: stand aside — cash คือสถานะ

### ⚠️ ข้อจำกัดข้อมูล
- ไม่มี live spot XAUUSD (Google Finance ไม่รองรับ forex pair) — ใช้ GLD $377.60 แปลง ~×10.78 ≈ $4,070 (คลาดเคลื่อนได้ ±0.5%)
- ระดับ $392/$369/$355 (GLD) อนุมานจาก price action ล่าสุด + ข่าว ไม่ใช่จากกราฟเต็ม — เช็ค swing levels จริงก่อนตั้งออเดอร์ทุกครั้ง
- ยังไม่มี COT ทอง (ออกศุกร์), GEX/options positioning, และ MA levels สด — ทั้งหมดควรเติมผ่าน `/signal XAUUSD` ก่อนพิจารณาใหม่
- ตลาดสหรัฐปิด 3 ก.ค. — quote GLD เป็นของ 2 ก.ค.; spot ยังเทรด OTC แบบสภาพคล่องบาง gap risk สูง
