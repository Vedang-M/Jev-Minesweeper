# Benchmark Methodology: JEV vs. Classical Constraint Solver

## 1. Overview and Objectives
This benchmark rigorously compares the decision accuracy, game completion win rate, mine-hit rate, latency, and cost of **JEV** (`~typesafe/jev-latest` on OpenRouter Decisions API) against a **Classical Constraint Solver** implementing single-point and subset constraint deduction logic.

Neither method is given access to hidden mine locations (`isMine`). Both methods receive equivalent, player-visible board snapshots containing only revealed numbers and flagged coordinates.

## 2. Experimental Design
- **Reproducible Board Generation**: Pseudo-random number generator (PRNG) using explicit 32-bit linear congruential generator (LCG) seeds.
- **Identical Initial Board States**: For every board seed and difficulty, both JEV and the Classical Constraint Solver are evaluated on the exact same hidden board layout and identical starting click (cell `(0, 0)`).
- **Separation of Difficulties**:
  - **Easy**: 9x9 grid, 10 mines (~12.3% mine density)
  - **Medium**: 16x16 grid, 40 mines (~15.6% mine density)
  - **Hard**: 16x30 grid, 99 mines (~20.6% mine density)
- **First-Move Diagnostic Snapshots**: In addition to full games, a controlled first-move snapshot benchmark evaluates both systems on the identical first branching state after opening cell `(0,0)`.
- **Decision Policies**:
  - **Classical Constraint Solver**: Applies deterministic single-constraint reductions and pairwise subset deductions. When guaranteed safe moves exist, it selects the first one. When no guaranteed safe move exists, it selects an unrevealed, non-flagged cell with minimum estimated local mine risk (or randomly among the safest candidates), clearly recorded as a probabilistic guess (`isGuaranteed: false`).
  - **JEV Solver**: Queries OpenRouter Decisions API. Cells are presented as unrevealed candidate choices. Coordinates are strictly validated against available unrevealed, unflagged cells. Excluded cells (previously queried on the same board) are removed from candidates. No candidate substitution is ever performed.
- **Terminal States**:
  - **Won**: All non-mine cells are revealed.
  - **Lost**: A mine cell is selected and revealed.
  - **Max Decisions Reached**: Safety stop preventing infinite loops.

## 3. Metric Definitions & Formulas
1. **Games Attempted & Completed**: Count of board instances run to completion.
2. **Win Rate**: `gamesWon / gamesAttempted`
3. **Loss Rate**: `gamesLost / gamesAttempted`
4. **Valid Decision Rate**: `validDecisions / totalDecisionsAttempted`
5. **Safe-Move Rate**: `safeMovesSelected / validDecisions`
6. **Mine-Hit Rate**: `mineCellsSelected / validDecisions`
7. **Guaranteed-Safe Opportunity Rate**: `decisionsWhereGuaranteedSafeExisted / totalDecisions`
8. **Guaranteed-Safe Match Rate**: `decisionsMatchingGuaranteedSafe / decisionsWhereGuaranteedSafeExisted`
9. **Decision Latency**: Average and median time per decision (ms).
10. **API Errors & Invalid Rates**: Frequency of non-200 HTTP responses, timeouts, or coordinate parsing failures.
11. **Actual API Cost**: Sum of OpenRouter usage cost in USD.
12. **Confidence Calibration**: Mean predicted confidence vs. observed empirical safe rate across confidence buckets.

## 4. Execution Modes
- **Smoke Mode (`--smoke`)**: Fast execution (1 seed per difficulty) to verify pipeline integrity, data formatting, and end-to-end telemetry.
- **Evaluation Mode (`--trials <N>`)**: Configurable trial count per difficulty for statistical comparisons with 95% Wilson score confidence intervals.
