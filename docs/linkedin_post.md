# Benchmarking Decision Models vs. Deterministic Logic in Minesweeper

Can machine learning models learn to deduce guaranteed-safe moves under strict uncertainty, or does classic propositional logic remain untouchable?

To test this empirically, I built a reproducible benchmark in Minesweeper comparing three decision paradigms:
1. **Classical Constraint Solver**: Propositional logic constraint propagation (single-point reductions & pairwise subset deductions).
2. **Laya (`convaiinnovations/laya`)**: Open-weight 421M ModernBERT-large non-autoregressive decision model running locally on Apple Silicon MPS.
3. **JEV (`~typesafe/jev-latest`)**: Autoregressive structured decision model accessed via OpenRouter.

### 1. Information Parity & Game Correctness
Neither the solver nor the models were given hidden mine coordinates, adjacent counts, or future board states. All engines operated strictly on player-visible clues. Games were seeded with a 32-bit PRNG so all engines faced identical starting boards and initial openings.

To prevent coordinate hallucination, candidate selection was restricted to a **staged frontier boundary strategy**: prioritizing cells adjacent to revealed numbers, bounded to $\le 250$ valid candidates with zero silent fallbacks.

### 2. What the Empirical Data Actually Showed

Across **11,853 full-game decisions** and **300 complete games** for the Classical baseline, alongside preliminary runs on Laya (30 games) and JEV:

- **100% Logic vs 33% Neural Deduction**: When a mathematically guaranteed safe move existed, the Classical Solver selected it **100.0%** of the time (11,519/11,519 opportunities). Laya matched guaranteed safe moves only **33.3%** of the time (21/63 opportunities, 95% Clustered Bootstrap CI: [17.8%, 43.9%]).
- **The Inevitability of Minesweeper**: On Hard boards (16x30, 99 mines), even flawless 100% deductive accuracy yielded a **0.0% win rate** across 100 games (95% Wilson CI: [0.0%, 3.7%]). On high-density boards, forced 50/50 gambles are statistically unavoidable—no amount of deductive logic can outrun a forced guess.
- **Inference Speed**: The Classical Solver executed in **< 1 ms** in-process; local Laya inference averaged **174 ms** on Apple Silicon MPS; cloud API calls averaged **1,650 ms**.

### 3. Engineering & Methodology Lessons
1. **Clustered Bootstrap Resampling**: Sequential gameplay decisions within the same game share board topology and deductive history. Treating decisions as $i.i.d.$ produces spuriously narrow confidence intervals. Resampling clusters of whole games via bootstrap is essential for mathematically sound error bars.
2. **Strict Denominators Matter**: Safe-move rate must strictly divide safe valid moves by valid decisions, never by total attempts or combined with win rate.
3. **API Realities**: Full 300-game scaling for JEV was halted by third-party upstream API credit limits (HTTP 402). Rather than mocking or fabricating data, we transparently documented the blocker and verified candidate formatting and schema paths offline.

Full reproducible benchmark runner, raw JSONL/CSV decision logs, and independent reconciliation audit script:
GitHub: https://github.com/Vedang-M/Jev-Minesweeper
