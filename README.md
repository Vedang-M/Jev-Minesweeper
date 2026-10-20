# JEV Minesweeper — Three-Way Decision Benchmark & Inference Engine

An experimental Minesweeper research application evaluating three distinct decision-making paradigms on identical, reproducible boards with strict player-visible information encapsulation:

1. **Classical Constraint Solver**: Deterministic baseline applying single-constraint deductions and subset-difference reductions.
2. **JEV**: TypeSafe AI's non-autoregressive decision model (`~typesafe/jev-latest`), accessed via OpenRouter's Decisions API.
3. **Laya**: Convai Innovations' open-weight decision model (`convaiinnovations/laya`), running locally via PyTorch/FastAPI and packaged for containerized deployment.

---

## 1. Architecture & Data Flow

```
                           +----------------------------------------+
                           |           Next.js Frontend             |
                           |     (Board UI, Engine Selector)        |
                           +-------------------+--------------------+
                                               |
                                     POST /api/decision
                                               |
                      +------------------------+------------------------+
                      |                                                 |
             engine === "jev"                                  engine === "laya"
                      |                                                 |
       +--------------v---------------+               +-----------------v---------------+
       |    OpenRouter Decisions      |               |      Laya Inference Service     |
       |  (~typesafe/jev-latest API)  |               |  (services/laya/app on port 8000)|
       +------------------------------+               +-----------------+---------------+
                                                                        |
                                                              +---------v---------+
                                                              |  ModernBERT-Large |
                                                              | 421M Param Agent  |
                                                              | (PyTorch MPS/CUDA)|
                                                              +-------------------+
                      |                                                 |
                      +------------------------+------------------------+
                                               |
                                 +-------------v--------------+
                                 |  Classical Ground-Truth    |
                                 |   isGuaranteedSafe Check   |
                                 +-------------+--------------+
                                               |
                                        Unified Response
```

### Strict Player Information Boundary
- **Zero Hidden Mine Leakage**: The underlying mine coordinates (`isMine`) are never sent across the wire.
- **Masked Neighbor Counts**: Visible numbers are provided only for revealed cells; unrevealed cells report `adjacentMines: null`.
- **Player Flags As Assertions**: Flagged cells are player annotations, not absolute proofs of mines.
- **Zero Silent Substitutions**: If an engine recommends an invalid, already revealed, flagged, or out-of-bounds cell, the application records it strictly as invalid (`isValid: false`) without substituting an arbitrary alternative move.

---

## 2. Decision Engines & Provenance

| Feature / Engine | Classical Constraint Solver | JEV (`~typesafe/jev-latest`) | Laya (`convaiinnovations/laya`) |
| :--- | :--- | :--- | :--- |
| **Paradigm** | Deterministic Propositional Logic | Proprietary Foundation Model | Open-Weight Decision Model |
| **Model Backbone** | N/A (Algorithm) | Unknown (TypeSafe proprietary) | ModernBERT-large (421M params) |
| **License** | MIT (In-repo) | Proprietary (Commercial API) | Apache 2.0 (Permissive) |
| **Hosting Mode** | In-process (TypeScript) | OpenRouter Hosted API | Local (`mps`/`cuda`/`cpu`) & Docker |
| **Candidate Cap** | Unbounded | 255 choice options max | 100 choice options max (ModernBERT limit) |
| **Large Board Strategy**| Full-board evaluation | Decoupled Row & Col (risks invalid pairing)| Staged Frontier Boundary Subsetting |
| **Confidence** | Binary (1.0 safe, null guess) | Calibrated/uncalibrated score | Raw uncalibrated output |
| **Typical Latency** | < 1 ms | 550 - 700 ms | 100 - 300 ms (Apple Silicon `mps`) |
| **Cost** | $0.00 | ~$0.0002 - $0.0009 / call | $0.00 (Self-hosted) |

Detailed model specifications and licensing are documented in [docs/laya_model_provenance.md](docs/laya_model_provenance.md).

---

## 3. Local Installation & Running Laya

### Prerequisites
- Node.js >= 20.0.0
- Python >= 3.10
- PyTorch >= 2.0 (supports Apple Silicon `mps`, NVIDIA `cuda`, or `cpu`)

### Step 1: Install Frontend Dependencies
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```
Configure your keys:
```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
LAYA_SERVICE_URL=http://127.0.0.1:8000
# Optional: LAYA_API_KEY=your_secret_token
```

### Step 3: Install & Start Local Laya Service
```bash
cd services/laya
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Verify readiness:
```bash
curl http://127.0.0.1:8000/health
# Response: {"status":"healthy","model":"convaiinnovations/laya","device":"mps","ready":true}
```

### Step 4: Run Next.js Frontend
In a new terminal window:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to play and select between **JEV** and **Laya**.

---

## 4. Hosted Laya Deployment

The Python service is packaged with a production Docker container located at `services/laya/Dockerfile`.

### Docker Build & Run
```bash
cd services/laya
docker build -t laya-inference:latest .
docker run -d -p 8000:8000 \
  -e LAYA_DEVICE=cpu \
  -e LAYA_PORT=8000 \
  laya-inference:latest
```

### Deploying to Cloud Providers (Fly.io, Render, RunPod, AWS ECS)
1. Push `services/laya` to your container registry.
2. Allocate minimum compute:
   - **GPU (Recommended)**: 1x NVIDIA T4 / A10G (approx. $0.20 - $0.50/hr). Fast inference ~40ms.
   - **CPU**: 4 vCPUs, 8GB RAM. Latency ~400-600ms.
3. Configure environment variables on your hosting provider:
   - `LAYA_DEVICE`: `cuda` or `cpu`
   - `LAYA_API_KEY`: A secure bearer token to prevent unauthorized access.
4. Update your Vercel or production Next.js environment:
   - `LAYA_SERVICE_URL`: `https://your-laya-deployment.example.com`
   - `LAYA_API_KEY`: matching bearer token

*Note: Frontend browser clients never connect directly to the Laya service URL; all traffic proxies server-side through `/api/decision`, keeping your infrastructure secure.*

---

## 5. Benchmarking: 3-Way Comparative Evaluation

The project features a deterministic, paired benchmarking suite evaluating Classical Solver, JEV, and Laya on identical boards across Easy, Medium, and Hard difficulties.

### Execution Commands
- **Smoke Test (1 trial/difficulty)**:
  ```bash
  node scripts/runTs.js scripts/runBenchmark.ts --smoke --engine all
  ```
- **3-Trial Evaluation (paired seeds 42, 142, 242)**:
  ```bash
  node scripts/runTs.js scripts/runBenchmark.ts --trials 3 --engine all
  ```
- **Classical Only (Zero API Cost)**:
  ```bash
  node scripts/runTs.js scripts/runBenchmark.ts --trials 5 --engine classical
  ```

### Empirical Results (Final Benchmark Summary)

| Metric | Classical Solver (`exp_1792471827737`) | Laya Local MPS (`exp_1792472002589`) | JEV OpenRouter API (`exp_1792470142530`) |
| :--- | :--- | :--- | :--- |
| **Total Games Completed** | **300** (100 Easy, 100 Medium, 100 Hard) | **30** (10 Easy, 10 Medium, 10 Hard) | 9 paired games (3 Easy, 3 Med, 3 Hard) |
| **Overall Game Win Rate** | **35.0%** [29.8%, 40.6%] | **0.0%** [0.0%, 11.3%] | 0.0% (Preliminary) |
| **- Easy Win Rate** | **64.0%** [54.2%, 72.7%] | 0.0% [0.0%, 27.8%] | 0.0% |
| **- Medium Win Rate** | **41.0%** [31.9%, 50.8%] | 0.0% [0.0%, 27.8%] | 0.0% |
| **- Hard Win Rate** | **0.0%** [0.0%, 3.7%] | 0.0% [0.0%, 27.8%] | 0.0% |
| **Total Decisions Evaluated** | **11,853** | **85** | 30 |
| **Valid Decision Rate** | **100.0%** (11,853/11,853) | **100.0%** (85/85) | 83.33% (25/30) |
| **Safe Move Rate** | **98.54%** [98.20%, 98.80%] | **64.71%** [53.1%, 73.7%] | 64.00% [44.5%, 79.8%] |
| **Guaranteed Safe Match Rate**| **100.0%** (11,519/11,519) | **33.33%** (21/63) | 14.29% (2/14) |
| **Median Decision Latency** | **< 1 ms** (algorithm) | **201 ms** (local HTTP to MPS) | 600 ms (cloud API) |
| **p90 Latency** | **1 ms** | **290 ms** | 696 ms |
| **Total Cost** | **$0.00** | **$0.00** (Local) | ~$0.0165 |

*Note on JEV Live Scaling*: Real API queries were verified, but scaling beyond initial trials is halted due to upstream account credit exhaustion (HTTP 402 from OpenRouter).

### Detailed Documentation
- [Benchmark Methodology](docs/benchmark_methodology.md): Experimental design, two-phase diagnostic vs. full-game separation, paired seeds, and game-clustered bootstrap math.
- [Final Benchmark Report](docs/final_benchmark_report.md): Complete analysis tables, breakdown by difficulty, latency distributions, and empirical conclusions.
- [Model Provenance](docs/model_provenance.md): Pinned checkpoint hashes, licenses, hardware specs, and runtime requirements.
- [Experiment Manifest](results/manifest.json): Machine-readable index of all raw JSONL/CSV runs.

---

## 6. Testing, Quality Verification & Data Audit

### 1. Run Automated Unit & Metric Tests
```bash
npm test
```
Runs 5 automated unit suites covering:
1. `tests/board.test.ts`: Deterministic board generation, PRNG seeds, and flood-fill mechanics.
2. `tests/solver.test.ts`: Single-constraint and subset-reduction deductions.
3. `tests/jevRoute.test.ts`: Information boundaries (stripping `isMine`, masking counts).
4. `tests/decisionRoute.test.ts`: Shared decision contract schema and safety tagging.
5. `tests/metrics.test.ts`: Game-clustered bootstrap estimators and Wilson score intervals.

### 2. Run Python Service Tests
```bash
PYTHONPATH=services/laya pytest services/laya/tests
```

### 3. Run Independent Data Audit
Mathematically reconciles every summary statistic directly against the raw JSONL and CSV records:
```bash
node scripts/runTs.js scripts/auditData.ts
```

### 4. Build Production Bundle
```bash
npm run build
```

---

## 7. Security Best Practices
- `OPENROUTER_API_KEY` and `LAYA_API_KEY` remain strictly server-side.
- The Next.js frontend interacts only with internal routes (`/api/decision`).
- Docker containers run as non-root users (`appuser`) with explicit health probes.
- Model checkpoints and large cache directories are excluded from Git tracking via `.gitignore`.

