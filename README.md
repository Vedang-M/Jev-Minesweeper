# JEV Minesweeper

An experimental Minesweeper web application evaluating TypeSafe AI's **JEV** decision engine against a **Classical Constraint Solver** using rigorous player-visible information boundaries.

Deployed on Vercel with a clean, responsive interface and an automated benchmarking pipeline.

---

## 1. Overview & Architecture

JEV Minesweeper pairs classic Minesweeper gameplay with real-time decision recommendations from two distinct paradigms:
1. **Classical Constraint Solver**: A deterministic logic engine applying single-constraint deductions and pairwise subset-difference reductions.
2. **JEV Decision Engine**: TypeSafe's JEV model (`~typesafe/jev-latest`) accessed via OpenRouter's Decisions API (`/api/alpha/decisions`).

### Strict Information Boundary
A core engineering requirement of this project is strict player-information encapsulation:
- **No Hidden Mine Information**: The `isMine` layout is completely stripped from server requests.
- **Masked Counts**: Revealed cells report their observed adjacent-mine count; unrevealed cells report `null`.
- **Candidate Filtering**: Decisions are selected only from currently unrevealed, non-flagged cells. Excluded cells are omitted.
- **Zero Hallucinated Move Substitution**: If JEV returns an invalid coordinate or combination, the application records it strictly as invalid without substituting an arbitrary alternative move.

---

## 2. Tech Stack

- **Framework**: Next.js 16 (App Router) with React 19 & TypeScript 5
- **Styling**: Tailwind CSS 4
- **Backend**: Next.js API Routes (`/api/jev`)
- **API Provider**: OpenRouter Decisions API (`~typesafe/jev-latest`)
- **Testing & Benchmarking**: Node.js test suites & PRNG reproducible benchmark engine

---

## 3. Getting Started

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0

### Local Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/jev-minesweeper.git
   cd jev-minesweeper
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```
   Edit `.env.local` and add your OpenRouter API key:
   ```env
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 4. Scripts & Commands

- **Run Dev Server**: `npm run dev`
- **Run Linting**: `npm run lint`
- **Run Unit Tests**: `npm test`
- **Build Production Bundle**: `npm run build`
- **Run Benchmark Smoke Test**:
  ```bash
  node scripts/runTs.js scripts/runBenchmark.ts --smoke
  ```
- **Run Full Benchmark Evaluation**:
  ```bash
  node scripts/runTs.js scripts/runBenchmark.ts --trials 3
  ```

---

## 5. Automated Benchmark & Reproducibility

The project features a reproducible, paired benchmarking suite (`scripts/runBenchmark.ts`):
- **Reproducible PRNG**: Deterministic boards generated using explicit 32-bit seeds.
- **Paired Comparisons**: Both JEV and the Classical Solver receive the exact same board layout and initial move.
- **Diagnostic Snapshot Mode**: Evaluates both systems on identical first-move board states.
- **Metrics Collected**:
  - Valid decision rate
  - Safe-move selection rate (with 95% Wilson score confidence intervals)
  - Mine-hit rate
  - Guaranteed-safe identification rate
  - Average & median latency
  - API usage cost (USD)

Raw decision-level data is saved to `results/decisions_<expId>.jsonl` and `results/decisions_<expId>.csv`. Aggregated summaries are output to `results/benchmark_summary_<expId>.json`.

For detailed experimental design and statistical formulations, see [docs/benchmark_methodology.md](docs/benchmark_methodology.md).

---

## 6. Vercel Deployment Instructions

1. Push your changes to GitHub.
2. Import the repository in [Vercel](https://vercel.com).
3. In Project Settings > **Environment Variables**, set:
   - `OPENROUTER_API_KEY`: Your OpenRouter secret key.
4. Deploy! Next.js will build the application using `npm run build`.

---

## 7. Known Limitations & Research Observations

1. **API Candidate Limits**: OpenRouter choice questions enforce a strict 255-option limit. For boards with >255 unrevealed cells (such as unrevealed Hard boards with 480 cells), the decision is partitioned into row and column questions.
2. **Coordinate Decoupling on Large Boards**: Independent row and column selection on large grids can yield a coordinate that was already revealed or flagged. The backend strictly flags these as invalid decisions rather than silently substituting valid cells.
3. **Minesweeper Guessing**: Minesweeper is an NP-complete problem that regularly creates unsolvable 50/50 guessing states where no deterministic safe move exists. The Classical Solver properly reports uncertainty in such states.
