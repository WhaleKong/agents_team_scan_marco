Run a **Portfolio Review** -- evaluate all open positions.

## Instructions

You are running a full portfolio review using all 4 agents.

### Process

1. **Read Portfolio State** from `data/portfolio/portfolio-state.json`
2. For each open position, evaluate:

#### Thesis Check (macro-researcher)
- Is the original macro thesis still intact?
- Has the regime changed since entry?
- Any new data that invalidates the thesis?

#### Signal Check (quant-signal)
- Have technical signals changed?
- Is momentum still supporting the position?
- Any divergences forming?

#### Catalyst Check (news-scanner)
- Any new catalysts or risks?
- Upcoming events that could impact the position?
- Sentiment shift for/against the position?

#### Risk Check (risk-manager)
- Current P&L vs entry
- Distance to stop loss
- Portfolio-level heat
- Correlation with other positions

### For Each Position, Recommend:
- **ADD** -- Thesis strengthening, increase size
- **HOLD** -- Thesis intact, maintain position
- **REDUCE** -- Partial profit taking or thesis weakening
- **CUT** -- Thesis invalidated, exit immediately

### Output Format

```markdown
## Portfolio Review -- {date}

### POSITION REVIEW
| Trade | Direction | Size | Entry | Current | P&L   | Status | Action       |
|-------|-----------|------|-------|---------|-------|--------|--------------|
| ...   | ...       | ...  | ...   | ...     | +/-X% | ...    | ADD/HOLD/CUT |

### DETAILED REVIEW

#### {Position 1}
- **Original Thesis:** {thesis}
- **Thesis Status:** INTACT / WEAKENING / INVALIDATED
- **Signal Score:** {current score} (was {entry score})
- **Action:** {ADD/HOLD/REDUCE/CUT} -- {reason}

### PORTFOLIO SUMMARY
- NAV: $XXXXX
- Gross Exposure: XX%
- Net Exposure: XX%
- Portfolio Heat: X.X%
- MTD P&L: +/-X.X%

### ADJUSTMENTS NEEDED
- {list any stop moves, size changes, new trades}

### UPCOMING RISKS
- {events or conditions to watch}
```

Apply Druckenmiller discipline: **Cut immediately when wrong. Add when right. Never average down on a losing thesis.**
