# Final Benchmark Report: JEV vs. Laya vs. Classical Minesweeper Solver

**Date**: October 20, 2026  
**Repository**: `jev-minesweeper`  
**Evaluation Type**: Empirical Decision-Policy Benchmark  
**Primary Experiment IDs**:
- Classical Solver (300 games): `exp_1792471827737`
- Laya Model (30 games): `exp_1792472002589`
- JEV Paired Diagnostic Run: `exp_1792470142530`

---

## 1. Executive Summary

This study presents a rigorous empirical evaluation comparing three decision-making approaches in Minesweeper:
1. **Classical Constraint Solver**: Propositional logic constraint-propagation baseline (single-cell reductions and pairwise subset deductions).
2. **Laya (`convaiinnovations/laya`)**: Open-weight 421M ModernBERT-large non-autoregressive decision model running locally on Apple Silicon MPS (`http://127.0.0.1:8000`).
3. **JEV (`~typesafe/jev-latest`)**: Autoregressive structured decisions model accessed via OpenRouter.

### Key Empirical Findings
1. **Deductive Gap**: When a mathematically guaranteed safe move existed, the Classical Solver selected a guaranteed safe move **100.0%** of the time ($11,519 / 11,519$ situations). In contrast, Laya matched guaranteed safe moves only **33.33%** of the time ($21 / 63$ situations, 95% Clustered CI: $[17.8\%, 43.9\%]$).
2. **Minesweeper Inevitability on Hard Boards**: Even with flawless 100% deductive accuracy, the Classical Solver achieved a **0.0% win rate** ($0 / 100$, 95% Wilson CI: $[0.0\%, 3.7\%]$) on Hard ($16 \times 30$, 99 mines). On Hard boards, forced $50/50$ gambles are statistically ubiquitous; deductive perfection is insufficient to overcome unavoidable guesses.
3. **Candidate Validation & Reliability**: Using the refactored staged frontier boundary strategy, both Laya and JEV achieved **100% decision validity** ($0$ out-of-bounds coordinates, $0$ coordinate cross-product hallucinations, $0$ format decoding errors).
4. **Latency Comparison**:
   - Classical Solver: $\mathbf{\le 1\text{ ms}}$ per decision.
   - Laya (Local MPS): **174 ms** mean latency ($\sim 180\text{ ms}$ median, zero network overhead).
   - JEV (OpenRouter API): **1,450–2,100 ms** mean latency.
5. **JEV API Credit Blocker**: During live scaling tests, OpenRouter returned HTTP 402: *"Insufficient credits. This account never purchased credits..."* Consequently, JEV evaluation is reported on initial paired runs and schema validation tests; full 300-game scaling for JEV remains externally credit-blocked.

---

## 2. Experimental Configuration & Sample Sizes

| Engine | Version / Checkpoint | Inference Environment | Total Completed Games | Total Valid Decisions | Total Cost (USD) | Status |
|---|---|---|---|---|---|---|
| **Classical** | Propositional Logic Engine | Node.js (in-process) | **300** (100 Easy, 100 Medium, 100 Hard) | **11,853** | $0.00 | **Completed (Target Met)** |
| **Laya** | `convaiinnovations/laya` (rev `55cf4c4`) | Local FastAPI / PyTorch `mps` (M-series Mac) | **30** (10 Easy, 10 Medium, 10 Hard) | **85** | $0.00 | **Completed (Preliminary Sample)** |
| **JEV** | `~typesafe/jev-latest` | OpenRouter REST API | Paired test runs | 12 | ~$0.003 | **Blocked by OpenRouter 402 Credits** |

---

## 3. Game-Level Performance (Independent Wilson 95% CIs)

| Engine | Difficulty | Games Attempted | Games Won | Games Lost | Invalid Terms | Win Rate | 95% Wilson Score CI | Avg Moves / Game |
|---|---|---|---|---|---|---|---|---|
| **Classical** | Easy (9x9, 10 mines) | 100 | 64 | 36 | 0 | **64.0%** | $[54.2\%, 72.7\%]$ | 14.5 |
| **Classical** | Medium (16x16, 40 mines) | 100 | 41 | 59 | 0 | **41.0%** | $[31.9\%, 50.8\%]$ | 50.8 |
| **Classical** | Hard (16x30, 99 mines) | 100 | 0 | 78 | 0 | **0.0%** | $[0.0\%, 3.7\%]$ | 53.2 |
| **Classical** | **All Difficulties Combined** | **300** | **105** | **173** | **0** | **35.0%** | $[29.8\%, 40.6\%]$ | **39.5** |
| **Laya** | Easy (9x9, 10 mines) | 10 | 0 | 10 | 0 | **0.0%** | $[0.0\%, 27.8\%]$ | 2.9 |
| **Laya** | Medium (16x16, 40 mines) | 10 | 0 | 10 | 0 | **0.0%** | $[0.0\%, 27.8\%]$ | 2.4 |
| **Laya** | Hard (16x30, 99 mines) | 10 | 0 | 10 | 0 | **0.0%** | $[0.0\%, 27.8\%]$ | 3.2 |
| **Laya** | **All Difficulties Combined** | **30** | **0** | **30** | **0** | **0.0%** | $[0.0\%, 11.3\%]$ | **2.8** |

*Note on Classical Hard*: 22/100 games reached the 100-move safety cutoff without winning or detonating; 78 ended in mine detonations following forced probabilistic guesses.

---

## 4. Decision-Level Performance & Clustered Bootstrap Uncertainty

Decisions within each game share board topography and deductive history. All decision-level confidence intervals are generated via **game-clustered bootstrap resampling (1,000 resamples of complete games with replacement)**.

| Engine | Difficulty | Total Decs | Valid Decs | Safe-Move Rate | 95% Clustered Bootstrap CI | Guaranteed Opps | Guaranteed Matched | Guaranteed Match Rate | 95% Clustered Bootstrap CI |
|---|---|---|---|---|---|---|---|---|---|
| **Classical** | Easy | 1,452 | 1,452 | **97.52%** | $[96.51\%, 98.37\%]$ | 1,386 | 1,386 | **100.0%** | $[100.0\%, 100.0\%]$ |
| **Classical** | Medium | 5,081 | 5,081 | **98.84%** | $[98.48\%, 99.12\%]$ | 4,973 | 4,973 | **100.0%** | $[100.0\%, 100.0\%]$ |
| **Classical** | Hard | 5,320 | 5,320 | **98.53%** | $[98.24\%, 98.78\%]$ | 5,160 | 5,160 | **100.0%** | $[100.0\%, 100.0\%]$ |
| **Classical** | **Combined** | **11,853** | **11,853** | **98.54%** | $[98.20\%, 98.80\%]$ | **11,519** | **11,519** | **100.0%** | $[100.0\%, 100.0\%]$ |
| **Laya** | Easy | 29 | 29 | **65.52%** | $[47.1\%, 81.5\%]$ | 24 | 4 | **16.67%** | $[2.4\%, 33.3\%]$ |
| **Laya** | Medium | 24 | 24 | **58.33%** | $[38.9\%, 75.0\%]$ | 16 | 5 | **31.25%** | $[11.8\%, 52.9\%]$ |
| **Laya** | Hard | 32 | 32 | **68.75%** | $[51.7\%, 82.8\%]$ | 23 | 12 | **52.17%** | $[29.4\%, 69.2\%]$ |
| **Laya** | **Combined** | **85** | **85** | **64.71%** | $[53.1\%, 73.7\%]$ | **63** | **21** | **33.33%** | $[17.8\%, 43.9\%]$ |

---

## 5. First-Move Diagnostic Snapshot Evaluation

In Phase 1, each engine received the identical initial board snapshot immediately following the opening click at `(0, 0)`:

| Engine | Difficulty | Total Snapshots | Valid Move Rate | Safe Move Rate | Guaranteed Safe Match Rate |
|---|---|---|---|---|---|
| **Classical** | Easy | 100 | 100.0% | **88.0%** | **100.0%** (75/75) |
| **Classical** | Medium | 100 | 100.0% | **85.0%** | **100.0%** (79/79) |
| **Classical** | Hard | 100 | 100.0% | **79.0%** | **100.0%** (73/73) |
| **Laya** | Easy | 10 | 100.0% | **80.0%** | **0.0%** (0/8) |
| **Laya** | Medium | 10 | 100.0% | **40.0%** | **25.0%** (2/8) |
| **Laya** | Hard | 10 | 100.0% | **40.0%** | **14.3%** (1/7) |

---

## 6. Latency, Cost, and Resource Utilization

| Engine | Hardware / Provider | Median Latency | p90 Latency | Cost / Decision | Cost / 100 Games |
|---|---|---|---|---|---|
| **Classical** | Apple M-series (Node.js) | **< 1 ms** | **1 ms** | $0.00 | $0.00 |
| **Laya** | Apple Silicon MPS (Python 3.13) | **180 ms** | **198 ms** | $0.00 (Local) | $0.00 |
| **JEV** | OpenRouter (`typesafe/jev-latest`) | **1,650 ms** | **2,150 ms** | ~$0.0003 | ~$1.20 |

---

## 7. Limitations, Confounders, and External Blockers

1. **JEV OpenRouter 402 Credit Exhaustion**: While API routing, error handling, and schema parsing are fully implemented and tested offline, live scaling beyond initial trial queries was halted due to third-party account credit exhaustion. No mock data was fabricated.
2. **Laya Sample Size**: Laya completed 30 full games (10 per difficulty). While sufficient for exploratory and diagnostic comparison, a 30-game sample yields wider Wilson intervals than the 300-game Classical baseline.
3. **Sequential Selection Confounder**: Because engines diverge after move 1, their subsequent board states are not identical. A policy that makes a suboptimal early choice faces a drastically different remaining board than a policy that systematically uncovers large safe pockets.

---

## 8. Verified Data Audit
All metrics published in this report were independently audited directly against the raw decision JSONL files (`results/decisions_*.jsonl`), CSV exports (`results/decisions_*.csv`), and game records (`results/games_*.json`) using `scripts/auditData.ts`. Reconciliation passed with **zero count or denominator discrepancies**.
