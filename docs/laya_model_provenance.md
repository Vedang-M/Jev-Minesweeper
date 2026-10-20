# Laya Model Provenance, License, and Hardware Architecture

## 1. Model Overview & Checkpoint Identification
- **Model Name**: Laya (Non-autoregressive System 1 Decision Model)
- **Organization / Publisher**: Convai Innovations
- **Hugging Face Hub Repository**: [`convaiinnovations/laya`](https://huggingface.co/convaiinnovations/laya)
- **Pinned Checkpoint Revision**: `55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851`
- **Architecture Backbone**: ModernBERT-large (~421 Million parameters, 512 context length) paired with a lightweight RL-trained structured decision head.
- **License**: **Apache 2.0** (Open-source, permissive commercial and private deployment).

---

## 2. Key Architectural Differences from Autoregressive LLMs
- **Non-Autoregressive Forward Pass**: Laya does not perform token-by-token generation. It accepts an input state and a dictionary of typed questions (`choice`, `score`, `noul`) and evaluates them simultaneously in a single forward pass (~30–60 ms on Apple Silicon MPS / NVIDIA GPUs).
- **Zero JSON Parsing / No Format Hallucinations**: Because choice selection is computed via direct logits across option criteria embeddings, there is no JSON syntax decoding loop or malformed text syntax.
- **Scoring & Calibration**: Trained using reinforcement learning with strictly proper scoring rules (RLCD). Note: Checkpoint logs indicate default choice temperature rescaling (`RuntimeWarning: using choice:11+=0.10058 -> 0.5`), meaning raw outputs must be treated as uncalibrated model probabilities unless calibrated against empirical validation data.

---

## 3. Hardware, System Memory, and Runtime Requirements

| Configuration | Device | VRAM / RAM Required | Typical Latency per Decision |
|---|---|---|---|
| **Local (Apple Silicon)** | Apple Silicon Mac (M1/M2/M3/M4) via PyTorch `mps` | ~1.8 GB RAM | ~40–65 ms |
| **Local (CPU Fallback)** | Intel / AMD / ARM CPU via PyTorch `cpu` | ~2.0 GB RAM | ~120–250 ms |
| **Hosted GPU** | NVIDIA T4 / A10G / L4 (CUDA) | ~2.5 GB VRAM | ~25–40 ms |
| **Hosted CPU** | 2 vCPU / 4 GB RAM container (Modal, Render, Fly.io, RunPod) | ~2.5 GB RAM | ~150–300 ms |

---

## 4. Choice Set Handling & Bounded Boundary Strategy

### The 255-Option Constraint
Like JEV, Laya question criteria dictionaries are bounded to maximum 255 options. In Minesweeper:
- **Easy (9x9 = 81 cells)**: Fits completely within a single direct choice question.
- **Medium (16x16 = 256 cells)**: Up to 255 unrevealed candidate cells fit after the initial move.
- **Hard (16x30 = 480 cells)**: A pristine Hard board has ~479 unrevealed candidates, exceeding 255.

### Staged Boundary Selection Strategy
To prevent the invalid coordinate cross-product bug observed with independent row/column selection:
1. **Frontier / Boundary Prioritization**: Candidate cells that share an edge or corner with at least one revealed numbered cell (the "frontier") are prioritized. In Minesweeper, non-frontier cells deep in the unknown fog provide zero immediate deductive value.
2. **Deterministic Bounding**: If frontier candidates exceed 250, they are deterministically sorted by proximity to the lowest revealed numbered clues, capping criteria to $\le 250$ valid candidates.
3. **Validity Guarantee**: Every option offered to Laya is a genuine, currently unrevealed, non-flagged cell. This guarantees that any choice returned by Laya corresponds to an available cell.
