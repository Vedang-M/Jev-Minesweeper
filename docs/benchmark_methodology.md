# Benchmark Methodology: JEV vs. Laya vs. Classical Constraint Solver

## 1. Overview and Research Question
This benchmark empirically evaluates decision accuracy, safety, game completion win rate, latency, and cost across three distinct decision-making paradigms in Minesweeper:
1. **Classical Constraint Solver**: A deterministic logic baseline applying single-point constraint propagation and pairwise subset deductions.
2. **Laya (`convaiinnovations/laya`)**: An open-weight 421M ModernBERT-large non-autoregressive decision model running locally via Python/FastAPI (`mps`/`cpu`).
3. **JEV (`~typesafe/jev-latest`)**: An external structured decision API accessed via OpenRouter.

### Core Research Questions
- Can neural/learned decision models reliably detect logically guaranteed safe moves without explicit constraint deduction rules?
- When forced to guess under uncertainty, do model policies outperform or underperform probabilistic heuristics?
- How do non-autoregressive models (Laya) compare to autoregressive APIs (JEV) in terms of latency, schema validity, and cost?

---

## 2. Strict Information Parity & Game Correctness
Minesweeper offers an objective, mathematically verifiable benchmark because all player moves must be deduced solely from player-visible observations.

### Information Boundary Contract
- **No Ground-Truth Leakage**: Neither hidden mine locations (`isMine: true`), hidden adjacent mine counts, nor future board states are ever provided to any engine.
- **Unrevealed Cells**: Clue counts are strictly hidden (`adjacentMines: 0`, `isRevealed: false`).
- **Flags**: Flags represent player annotations, never ground-truth mine proof.
- **Identical Initial Board States**: Boards are generated deterministically using a 32-bit linear congruential generator (LCG) seed. For any seed $S$ and difficulty $D$, all three engines receive the exact same hidden mine distribution and the identical starting click at cell `(0, 0)` with standard Minesweeper flood-fill.
- **Evaluation Isolation**: The game simulator alone checks whether a proposed coordinate hit a mine or opened a safe cell.

---

## 3. Experimental Design: Paired-Start, Divergent-Trajectory
Sequential Minesweeper is not an independent repeated-choice task: every decision modifies the visible board topology and opens new clues.

### Two-Phase Separation
To prevent conflating distinct experimental conditions, this study separates two distinct phases:

1. **Phase 1: Controlled First-Move Diagnostic Snapshot**
   - **Condition**: All three engines receive the *identical visible board state* immediately following the opening click at `(0, 0)` on seed $S$.
   - **Purpose**: Direct paired comparison of the first decision under identical observable constraints.
   - **Denominator**: Total diagnostic snapshots evaluated ($N_{\text{snapshots}}$).

2. **Phase 2: Complete-Game Sequential Evaluation**
   - **Condition**: Each engine plays a complete game starting from seed $S$. Because engines make different decisions, their trajectories rapidly diverge.
   - **Design**: Paired-start, divergent-trajectory benchmark.
   - **Denominator**: Total game attempts ($N_{\text{games}}$) for game-level metrics; total valid moves ($N_{\text{valid}}$) for decision-level metrics. Diagnostic snapshots are **never** pooled into full-game denominators.

---

## 4. Candidate Selection & Validity Rules

### The 255-Option Constraint
Both JEV and Laya operate under choice-count limits ($\le 255$ options per query). On Easy (81 cells) and Medium (256 cells), unrevealed cells fit naturally after initial reveal. On Hard ($16 \times 30 = 480$ cells), unrevealed cells initially exceed 255.

### Staged Frontier Boundary Policy
- **Anti-Pattern (Prohibited)**: Decoupled independent row and column predictions ($P(\text{row}) \times P(\text{col})$) frequently hallucinate already-revealed or flagged cells when combined.
- **Implemented Policy**: Every candidate offered to JEV and Laya is an explicit, valid, unrevealed, non-flagged cell.
- **Frontier Prioritization**: Cells sharing an edge or corner with at least one revealed numbered clue (the "frontier") are prioritized. Cells isolated in deep unrevealed fog provide zero immediate deductive value.
- **Deterministic Bounding**: If frontier candidates exceed 250, they are deterministically sorted by proximity to revealed clues, capping options to $\le 250$.
- **No Frontier Fallback**: If the board contains no frontier cells (e.g. initial state before any reveal), legal unrevealed cells are selected via deterministic grid ordering.
- **Zero Silent Substitution**: If any engine returns an invalid coordinate, out-of-bounds index, or empty output, the move is recorded as `isValid: false`, immediately terminating the game as an invalid loss. No fallback move is substituted.

---

## 5. Statistical Estimators & Clustered Bootstrap Math

### Game-Level Uncertainty: Wilson Score Intervals
For game win rates ($\hat{p} = W / N$), observations across distinct board seeds are statistically independent. We report two-sided 95% Wilson score intervals:
$$CI_{95\%} = \frac{\hat{p} + \frac{z^2}{2N} \pm z \sqrt{\frac{\hat{p}(1-\hat{p})}{N} + \frac{z^2}{4N^2}}}{1 + \frac{z^2}{N}}, \quad z = 1.96$$

### Decision-Level Uncertainty: Game-Clustered Bootstrap
In sequential gameplay, decisions within the same game are **not** independent and identically distributed ($i.i.d.$)—they share board topology, mine density, and prior deductive history. Treating decisions as independent artificially shrinks standard errors by $\sqrt{M}$, generating spuriously narrow confidence intervals.

**Algorithm (Clustered Resampling)**:
1. Let $G = \{g_1, g_2, \dots, g_K\}$ be the set of complete games for an engine-difficulty pair.
2. For $b = 1$ to $B = 1000$:
   - Draw $K$ games with replacement: $G^{*b} = \{g_{i_1}^{*b}, \dots, g_{i_K}^{*b}\}$.
   - Pool all decision records from the resampled games: $D^{*b} = \bigcup_{j=1}^K \text{decisions}(g_{i_j}^{*b})$.
   - Compute the metric of interest:
     $$\hat{\theta}^{*b} = \frac{\sum_{d \in D^{*b}} \mathbb{I}(\text{isValid} \land \text{isSafe})}{\sum_{d \in D^{*b}} \mathbb{I}(\text{isValid})}$$
3. The 95% bootstrap confidence interval is the $[2.5\text{th}, 97.5\text{th}]$ empirical percentiles of $\{\hat{\theta}^{*b}\}_{b=1}^B$.

---

## 6. Strict Metric Denominators

| Metric | Numerator | Denominator | Notes |
|---|---|---|---|
| **Game Win Rate** | Games won | Total completed games | Independent Wilson 95% CI |
| **Valid Decision Rate** | Valid moves | Total decision attempts | Measures schema and candidate adherence |
| **Safe-Move Rate** | Safe valid moves | Valid decisions | Invalid moves excluded from denominator |
| **Mine-Hit Rate** | Mine hits | Valid decisions | $\text{MineHitRate} = 1 - \text{SafeRate}$ |
| **Guaranteed Match Rate** | Guaranteed safe moves chosen | Situations where $\ge 1$ guaranteed safe move existed | Measures deductive compliance |

---

## 7. Reproduction Instructions

### Running the Benchmark
```bash
# Classical baseline (300 games: 100 Easy, 100 Medium, 100 Hard)
node scripts/runTs.js scripts/runBenchmark.ts --engine classical --trials 100

# Laya local service (requires uvicorn running on port 8000)
node scripts/runTs.js scripts/runBenchmark.ts --engine laya --trials 10

# All engines (smoke mode: 1 trial per difficulty)
node scripts/runTs.js scripts/runBenchmark.ts --smoke
```

### Auditing Summary Against Raw Logs
```bash
# Independent mathematical reconciliation audit
node scripts/runTs.js scripts/auditData.ts
```
