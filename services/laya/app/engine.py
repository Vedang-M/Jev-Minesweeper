import time
from typing import List, Set, Tuple, Dict, Any, Optional
import laya
from .config import settings
from .models import DecisionRequest, DecisionResponse, MoveInfo, CellInput

class LayaEngine:
    def __init__(self):
        self.agent = None
        self.device = settings.DEVICE
        self.model_id = settings.MODEL_ID
        self.ready = False

    def load_model(self):
        if self.agent is not None:
            return
        print(f"[LayaEngine] Loading {self.model_id} on device: {self.device}...")
        self.agent = laya.load(self.model_id, device=self.device)
        self.ready = True
        print(f"[LayaEngine] {self.model_id} successfully loaded and ready.")

    def format_board_state(self, board: List[List[CellInput]], candidates: List[Tuple[int, int]]) -> str:
        rows = len(board)
        cols = len(board[0])
        revealed_cells = []
        for r in range(rows):
            for c in range(cols):
                cell = board[r][c]
                if cell.isRevealed:
                    revealed_cells.append(f"({r},{c})={cell.adjacentMines}")
                elif cell.isFlagged:
                    revealed_cells.append(f"({r},{c})=FLAG")

        board_desc = f"Minesweeper Board {rows}x{cols}. Revealed clues: " + ", ".join(revealed_cells[:80])
        return board_desc

    def select_candidates(
        self,
        board: List[List[CellInput]],
        exclude_set: Set[str]
    ) -> Tuple[List[Tuple[int, int]], str]:
        rows = len(board)
        cols = len(board[0])

        all_candidates = []
        frontier_candidates = []

        for r in range(rows):
            for c in range(cols):
                cell = board[r][c]
                key = f"{r}-{c}"
                if not cell.isRevealed and not cell.isFlagged and key not in exclude_set:
                    all_candidates.append((r, c))
                    # Check if neighbor is revealed numbered cell
                    is_frontier = False
                    for dr in (-1, 0, 1):
                        for dc in (-1, 0, 1):
                            if dr == 0 and dc == 0:
                                continue
                            nr, nc = r + dr, c + dc
                            if 0 <= nr < rows and 0 <= nc < cols:
                                if board[nr][nc].isRevealed and (board[nr][nc].adjacentMines or 0) > 0:
                                    is_frontier = True
                                    break
                        if is_frontier:
                            break
                    if is_frontier:
                        frontier_candidates.append((r, c))

        # Laya choice question option marker capacity:
        # Laya allocates max_len=512 tokens with head_max_len=192 for the prompt,
        # which permits at most ~126 option markers. We safely bound candidate options to <= 100.
        if len(all_candidates) <= 100:
            return all_candidates, "direct"

        # When candidates > 100: bounded boundary selection
        if len(frontier_candidates) > 0:
            selected = frontier_candidates[:100]
        else:
            selected = all_candidates[:100]

        return selected, "staged_boundary"

    def predict(self, req: DecisionRequest) -> DecisionResponse:
        t0 = time.perf_counter()
        if not self.ready or self.agent is None:
            self.load_model()

        board = req.state
        exclude_set = set(req.excludeCells or [])

        candidates, decision_mode = self.select_candidates(board, exclude_set)

        if not candidates:
            return DecisionResponse(
                engine="laya",
                status="no_candidates",
                move=MoveInfo(choice=None, row=None, col=None, valid=False),
                confidence=None,
                latencyMs=round((time.perf_counter() - t0) * 1000, 2),
                model=self.model_id,
                decisionMode=decision_mode,
                error="No candidates remaining."
            )

        state_text = self.format_board_state(board, candidates)

        criteria: Dict[str, str] = {
            f"{r}-{c}": f"Select cell at row {r}, column {c}."
            for (r, c) in candidates
        }

        questions: Dict[str, Any] = {
            "safest_move": {
                "type": "choice",
                "instructions": "Select the single safest unrevealed cell coordinate to reveal on this Minesweeper board.",
                "criteria": criteria
            }
        }

        try:
            prediction = self.agent.predict(state_text, questions)
            latency_ms = round((time.perf_counter() - t0) * 1000, 2)

            answers = prediction.get("answers", {}) if isinstance(prediction, dict) else getattr(prediction, "answers", {})
            choice_data = answers.get("safest_move", {})
            choice_coord = choice_data.get("choice")

            # Model confidence extraction
            raw_conf = choice_data.get("confidence")
            answer_conf = choice_data.get("answer_confidence")
            conf = answer_conf if answer_conf is not None else raw_conf

            is_valid = False
            row, col = None, None
            if choice_coord and isinstance(choice_coord, str) and "-" in choice_coord:
                try:
                    parts = choice_coord.split("-")
                    r, c = int(parts[0]), int(parts[1])
                    if any(cr == r and cc == c for (cr, cc) in candidates):
                        is_valid = True
                        row, col = r, c
                except Exception:
                    is_valid = False

            return DecisionResponse(
                engine="laya",
                status="success" if is_valid else "invalid_decision",
                move=MoveInfo(
                    choice=choice_coord if is_valid else None,
                    row=row,
                    col=col,
                    valid=is_valid,
                    isGuaranteedSafe=False
                ),
                confidence=round(float(conf), 4) if conf is not None else None,
                latencyMs=latency_ms,
                model=self.model_id,
                decisionMode=decision_mode,
                error=None if is_valid else f"Model selected invalid coordinate: {choice_coord}"
            )
        except Exception as e:
            latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            return DecisionResponse(
                engine="laya",
                status="error",
                move=MoveInfo(choice=None, row=None, col=None, valid=False),
                confidence=None,
                latencyMs=latency_ms,
                model=self.model_id,
                decisionMode=decision_mode,
                error=str(e)
            )

laya_engine = LayaEngine()
