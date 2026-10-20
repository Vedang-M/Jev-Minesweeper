# Model and Engine Provenance

This document records the exact verifiable model checkpoints, software versions, licenses, inference environments, and API contracts used in the JEV Minesweeper benchmark.

---

## 1. Classical Baseline Solver

- **Implementation**: Deterministic propositional logic engine (`src/lib/solver.ts`).
- **Deduction Rules**:
  - Single-point constraint reduction (cells where clue equals unrevealed neighbors $\to$ all mines; cells where clue equals flagged neighbors $\to$ all safe).
  - Pairwise subset difference deductions ($A \subset B \implies B \setminus A$ has $k_B - k_A$ mines).
- **Runtime Environment**: Node.js v24.10.0 (in-process TypeScript via transpile execution).
- **Hardware**: Apple M-series CPU.
- **License**: MIT (Internal project code).
- **Determinism**: 100% deterministic given identical seed and starting click.

---

## 2. Laya Decision Model

- **Model Identifier**: [`convaiinnovations/laya`](https://huggingface.co/convaiinnovations/laya)
- **Publisher / Organization**: Convai Innovations
- **Pinned Git Commit Revision**: `55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851`
- **Architecture Backbone**: ModernBERT-large (~421M parameters, 512 context length) with lightweight non-autoregressive decision classification heads.
- **Decision Head Interface**: Direct logit evaluation over structured questions (`choice`, `score`, `noul`).
- **License**: **Apache 2.0** (Open-weights, permissive).
- **Local Service Architecture**:
  - Framework: FastAPI 0.115+, Uvicorn, PyTorch 2.6+.
  - Inference Device: Apple Silicon Metal Performance Shaders (`mps`). Fallback tested on `cpu`.
  - Service Location: Local daemon at `http://127.0.0.1:8000/decide`.
- **Calibration Note**: Checkpoint issues a runtime warning during initialization:
  `RuntimeWarning: laya: this checkpoint ships invalid temperatures or values outside [0.5, 5]; using choice:11+=0.10058 -> 0.5.`
  Consequently, raw model confidence scores are treated as uncalibrated decision rankings rather than calibrated mathematical probabilities.

---

## 3. TypeSafe JEV Decisions API

- **Model Identifier**: `~typesafe/jev-latest` (OpenRouter API)
- **Publisher**: TypeSafe / OpenRouter
- **Interface**: Structured decision schema over OpenRouter chat/completions endpoint.
- **Protocol**: REST HTTP POST with server-side API key authentication (`OPENROUTER_API_KEY`).
- **Prompt Format**: Markdown-encoded player-visible board grid with explicit numbered candidate indices.
- **License / Terms**: Commercial proprietary hosted API service.
- **Operational Status**: Offline candidate validation and schema parsing are verified. Full empirical live game scaling was halted due to upstream HTTP 402 Insufficient Credits on the user's OpenRouter account.

---

## 4. Software Dependencies & Environment

- **Node.js**: v24.10.0
- **Next.js**: 16.3.6 (App Router)
- **TypeScript**: 5.9.3
- **Python**: 3.13.9
- **PyTorch**: 2.6.0
- **Laya SDK**: 0.1.0+ (`laya` Python package)
- **FastAPI**: 0.115.11
- **Operating System**: macOS (Darwin 24.3.0, arm64)
