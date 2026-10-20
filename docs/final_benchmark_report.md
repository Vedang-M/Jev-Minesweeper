# Final Benchmark Report: JEV vs. Laya vs. Classical Minesweeper Solver

**Date**: October 20, 2026  
**Repository**: `jev-minesweeper`  
**Evaluation Type**: Empirical Decision-Policy Benchmark  
**Primary Experiments Evaluated**:
- Classical Solver (300 complete games): `exp_1792471827737`
- Laya Model (30 complete games, preliminary): `exp_1792472002589`
- Three-Engine Paired Preliminary Run: `exp_1792470142530`

---

## 1. Executive Summary

This study presents an empirical evaluation comparing three decision-making approaches in Minesweeper:
1. **Classical Constraint Solver**: Propositional logic constraint-propagation baseline (single-cell reductions and pairwise subset deductions).
2. **Laya (`convaiinnovations/laya`)**: Open-weight 421M ModernBERT-large non-autoregressive decision model running locally on Apple Silicon MPS (`http://127.0.0.1:8000`).
3. **JEV (`~typesafe/jev-latest`)**: Autoregressive structured decisions model accessed via OpenRouter.

### Key Empirical Findings
1. **Deductive Gap**: When a mathematically guaranteed safe move existed, the Classical Solver selected a guaranteed safe move **100.0%** of the time ($11,519 / 11,519$ situations). In contrast, Laya matched guaranteed safe moves only **33.33%** of the time ($21 / 63$ situations, 95% Clustered Bootstrap CI: $[17.8\%, 43.9\%]$).
2. **Hard Board Completion Rate**: In the 100-game sample on Hard ($16 \times 30$, 99 mines), the Classical Solver achieved a **0.0% win rate** ($0 / 100$, 95% Wilson CI: $[0.0\%, 3.7\%]$). 78 games terminated in mine detonations following forced guesses where no guaranteed safe moves existed; 22 games reached the 100-move benchmark cutoff without encountering a loss or victory. Zero wins in this sample demonstrates the difficulty of high mine density, though mathematical unavoidability of guesses depends on specific localized board frontiers.
3. **Candidate Validation & Reliability**: Using the refactored staged frontier boundary strategy, both Laya and the Classical Solver achieved **100% decision validity** in recent evaluations ($0$ out-of-bounds coordinates, $0$ coordinate cross-product hallucinations, $0$ format decoding errors). In earlier preliminary runs (`exp_1792470142530`), JEV achieved 83.33% validity due to large-board candidate formatting issues that were subsequently addressed.
4. **Latency Profile**:
   - Classical Solver: $\mathbf{\le 1\text{ ms}}$ in-process algorithm execution time.
   - Laya (Local MPS): **174 ms** mean latency (**201 ms** median, **290 ms** p90, end-to-end HTTP request to local uvicorn daemon).
   - JEV (OpenRouter API): **595 ms** mean latency (**600 ms** median, **696 ms** p90 in paired run `exp_1792470142530`, network round-trip).
5. **JEV API Scaling Blocker**: During live scaling tests beyond initial trials, OpenRouter returned HTTP 402: *"Insufficient credits. This account never purchased credits..."* Consequently, JEV evaluation is reported on initial paired runs (`exp_1792470142530`) and offline schema validation tests; full 300-game scaling for JEV remains externally credit-blocked.

---

## 2. Experimental Configuration & Sample Sizes

| Engine | Version / Checkpoint | Inference Environment | Total Completed Games | Total Valid Decisions | Total Cost (USD) | Status |
|---|---|---|---|---|---|---|
| **Classical** | Propositional Logic Engine | Node.js (in-process) | **300** (100 Easy, 100 Medium, 100 Hard) | **11,853** | $0.00 | **Completed (Target Met)** |
| **Laya** | `convaiinnovations/laya` (rev `55cf4c4`) | Local FastAPI / PyTorch `mps` (M-series Mac) | **30** (10 Easy, 10 Medium, 10 Hard) | **85** | $0.00 | **Completed (Preliminary Sample)** |
| **JEV** | `~typesafe/jev-latest` | OpenRouter REST API | 9 paired games (3/diff in `exp_1792470142530`) | 25 | ~$0.0165 | **Blocked by OpenRouter 402 Credits** |

---

## 3. Game-Level Performance (Independent Wilson 95% CIs)

Game win rates are computed on complete sequential games using two-sided 95% Wilson score intervals:

| Engine | Difficulty | Games Attempted | Games Won | Games Lost | Unresolved (Max Moves) | Win Rate | 95% Wilson Score CI | Avg Moves / Game |
|---|---|---|---|---|---|---|---|---|
| **Classical** | Easy (9x9, 10 mines) | 100 | 64 | 36 | 0 | **64.0%** | $[54.2\%, 72.7\%]$ | 14.5 |
| **Classical** | Medium (16x16, 40 mines) | 100 | 41 | 59 | 0 | **41.0%** | $[31.9\%, 50.8\%]$ | 50.8 |
| **Classical** | Hard (16x30, 99 mines) | 100 | 0 | 78 | 22 | **0.0%** | $[0.0\%, 3.7\%]$ | 53.2 |
| **Classical** | **All Difficulties Combined** | **300** | **105** | **173** | **22** | **35.0%** | $[29.8\%, 40.6\%]$ | **39.5** |
| **Laya** | Easy (9x9, 10 mines) | 10 | 0 | 10 | 0 | **0.0%** | $[0.0\%, 27.8\%]$ | 2.9 |
| **Laya** | Medium (16x16, 40 mines) | 10 | 0 | 10 | 0 | **0.0%** | $[0.0\%, 27.8\%]$ | 2.4 |
| **Laya** | Hard (16x30, 99 mines) | 10 | 0 | 10 | 0 | **0.0%** | $[0.0\%, 27.8\%]$ | 3.2 |
| **Laya** | **All Difficulties Combined** | **30** | **0** | **30** | **0** | **0.0%** | $[0.0\%, 11.3\%]$ | **2.8** |

*Note on Classical Hard*: All 78 losses occurred on forced guesses when zero guaranteed safe moves were deducible by single-cell or pairwise subset constraints. The 22 unresolved games reached the 100-move benchmark limit without winning or detonating.

---

## 4. Decision-Level Performance & Clustered Bootstrap Uncertainty

Decisions within each game share board topography and deductive history. All decision-level confidence intervals are generated via **game-clustered bootstrap resampling (1,000 resamples of complete games with replacement)**.

| Engine | Difficulty | Total Decs | Valid Decs | Safe-Move Rate | 95% Clustered Bootstrap CI | Guaranteed Opps | Guaranteed Matched | Guaranteed Match Rate | 95% Clustered Bootstrap CI |
|---|---|---|---|---|---|---|---|---|---|
| **Classical** | Easy | 1,452 | 1,452 | **97.52%** | $[96.51\%, 98.37\%]$ | 1,386 | 1,386 | **100.0%** | $[100.0\%, 100.0\%]$ |
| **Classical** | Medium | 5,081 | 5,081 | **98.84%** | $[98.48\%, 99.12\%]$ | 4,973 | 4,973 | **100.0%** | $[100.0\%, 100.0\%]$ |
| **Classical** | Hard | 5,320 | 5,320 | **98.53%** | $[97.89\%, 98.90\%]$ | 5,160 | 5,160 | **100.0%** | $[100.0\%, 100.0\%]$ |
| **Classical** | **Combined** | **11,853** | **11,853** | **98.54%** | $[98.20\%, 98.80\%]$ | **11,519** | **11,519** | **100.0%** | $[100.0\%, 100.0\%]$ |
| **Laya** | Easy | 29 | 29 | **65.52%** | $[44.44\%, 77.27\%]$ | 24 | 4 | **16.67%** | $[0.0\%, 29.73\%]$ |
| **Laya** | Medium | 24 | 24 | **58.33%** | $[41.18\%, 68.75\%]$ | 16 | 5 | **31.25%** | $[0.0\%, 47.62\%]$ |
| **Laya** | Hard | 32 | 32 | **68.75%** | $[41.18\%, 81.82\%]$ | 23 | 12 | **52.17%** | $[30.0\%, 58.33\%]$ |
| **Laya** | **Combined** | **85** | **85** | **64.71%** | $[53.13\%, 73.68\%]$ | **63** | **21** | **33.33%** | $[17.78\%, 43.90\%]$ |

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

### Latency Measurement Methodology
- **Classical Solver**: In-process algorithm execution timer recorded as `1 ms` resolution.
- **Laya**: End-to-end HTTP request duration from the benchmark client to the local FastAPI daemon on `http://127.0.0.1:8000/v1/decision`.
- **JEV**: End-to-end network round-trip time to OpenRouter's REST API endpoint.

| Engine | Experiment Run | Hardware / Environment | Mean Latency | Median Latency | p90 Latency | Cost / Decision | Total Run Cost |
|---|---|---|---|---|---|---|---|
| **Classical** | `exp_1792471827737` | Apple M-series CPU (in-process) | **1 ms** | **1 ms** | **1 ms** | $0.00 | $0.00 |
| **Laya** | `exp_1792472002589` | Apple Silicon MPS (local HTTP) | **174 ms** | **201 ms** | **290 ms** | $0.00 | $0.00 |
| **JEV** | `exp_1792470142530` | OpenRouter REST API (cloud) | **595 ms** | **600 ms** | **696 ms** | ~$0.0005 | $0.0165 |

---

## 7. Limitations, Confounders, and External Blockers

1. **JEV OpenRouter 402 Credit Exhaustion**: While API routing, error handling, and candidate formatting were verified, scaling beyond initial paired trials was halted due to third-party account credit exhaustion. No mock responses or synthetic data were fabricated.
2. **Laya Preliminary Sample Size**: Laya completed 30 full games (10 per difficulty). While sufficient for initial comparison, a 30-game sample yields wider confidence intervals (e.g., $[0.0\%, 27.8\%]$ win rate per difficulty) than the 300-game Classical baseline.
3. **Sequential Trajectory Divergence**: Because engines choose different moves after opening cell `(0, 0)`, their board states diverge. A suboptimal early choice exposes different frontiers than an optimal deductive sequence; comparisons across full games reflect divergent policy paths rather than identical decision states.

---

## 8. Verified Data Audit
All metrics published in this report were independently audited against raw decision JSONL files, CSV exports, and game records using `scripts/auditData.ts`. Experiments `exp_1792471827737`, `exp_1792472002589`, and `exp_1792470142530` passed with **zero reconciliation discrepancies**.
