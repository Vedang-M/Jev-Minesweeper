# Shared Decision Contract: Player-Visible Minesweeper Decision Protocol
Version: 1.0.0

## 1. Information Boundary Principles
To guarantee experimental integrity and prevent information leakage across all solvers (Classical, JEV, and Laya):
- **Hidden Mine Masking**: The `isMine` layout is strictly excluded from all decision requests.
- **Adjacent Mine Numbers**: Exposed only for cells where `isRevealed === true`. For unrevealed cells, `adjacentMines` is strictly `null`.
- **Flags as Assertions**: Player-placed flags are treated strictly as player hypotheses, not ground truth proof of mines.
- **Candidate Pool**: Solvers may only select coordinates from the set of currently unrevealed, non-flagged cells that have not been explicitly excluded.
- **Zero Silent Substitution**: If a solver selects an invalid coordinate (e.g. out of bounds, already revealed, or flagged), the backend flags the response as invalid. It must never substitute a random or alternative cell.

---

## 2. API Endpoints

### `POST /api/decision` (Unified Next.js Proxy)
Proxies requests to the selected engine:
- `engine: "jev"` -> OpenRouter Decisions API (`~typesafe/jev-latest`)
- `engine: "laya"` -> Laya inference service (Local or Hosted via `LAYA_SERVICE_URL`)
- `engine: "classical"` -> In-process Classical Constraint Solver

### `POST /v1/decision` (Laya Service Contract)
Direct endpoint exposed by `services/laya/app/main.py`.

---

## 3. Request Schema (JSON)

```json
{
  "engine": "laya", // "jev" | "laya" | "classical"
  "difficulty": "easy", // "easy" | "medium" | "hard"
  "state": [
    [
      { "row": 0, "col": 0, "isRevealed": true, "isFlagged": false, "adjacentMines": 1 },
      { "row": 0, "col": 1, "isRevealed": false, "isFlagged": false, "adjacentMines": null }
    ]
  ],
  "excludeCells": ["0-1"] // Optional list of coordinates already suggested on this unchanged board
}
```

### Request Fields:
| Field | Type | Description |
|---|---|---|
| `engine` | string | Target decision engine (`"jev"`, `"laya"`, or `"classical"`). |
| `difficulty` | string | Board difficulty preset (`"easy"`, `"medium"`, `"hard"`). |
| `state` | array[array[Cell]] | 2D player-visible board. `isMine` omitted. Hidden cells have `adjacentMines: null`. |
| `excludeCells` | array[string] | Optional list of `"row-col"` coordinates to exclude from candidate consideration. |

---

## 4. Response Schema (JSON)

```json
{
  "engine": "laya",
  "status": "success", // "success" | "no_candidates" | "invalid_decision" | "error"
  "move": {
    "choice": "0-1", // "row-col" string or null
    "row": 0,
    "col": 1,
    "valid": true,
    "isGuaranteedSafe": false // Verified by classical constraint deductions
  },
  "confidence": 0.744, // Genuine probability/confidence or null if omitted
  "confidenceNote": "Uncalibrated model output", // Clarification on calibration status
  "latencyMs": 48,
  "model": "convaiinnovations/laya",
  "decisionMode": "direct", // "direct" (<=255 choices) | "staged_boundary" (>255 choices)
  "error": null
}
```

### Response Fields:
| Field | Type | Description |
|---|---|---|
| `engine` | string | The engine that handled the decision. |
| `status` | string | Result status code (`"success"`, `"no_candidates"`, `"invalid_decision"`, `"error"`). |
| `move.choice` | string \| null | The suggested cell coordinate `"row-col"`. |
| `move.row` | number \| null | Row index (0-indexed). |
| `move.col` | number \| null | Column index (0-indexed). |
| `move.valid` | boolean | Strictly verifies whether the coordinate was an available unrevealed candidate. |
| `move.isGuaranteedSafe`| boolean | True if the Classical Constraint Solver proves this cell is guaranteed safe. |
| `confidence` | number \| null | Genuine model-reported probability/confidence. Null if omitted. |
| `confidenceNote` | string | Explicit note stating that raw model confidence is uncalibrated unless measured. |
| `latencyMs` | number | Decision turnaround time in milliseconds. |
| `model` | string | Checkpoint or algorithm identifier. |
| `decisionMode` | string | Selection strategy applied (`"direct"` or `"staged_boundary"`). |
| `error` | string \| null | Error message if status is `"error"`. |
