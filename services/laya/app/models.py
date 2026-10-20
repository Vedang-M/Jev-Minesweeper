from typing import List, Optional, Literal
from pydantic import BaseModel, Field

class CellInput(BaseModel):
    row: int
    col: int
    isRevealed: bool
    isFlagged: bool
    adjacentMines: Optional[int] = None

class DecisionRequest(BaseModel):
    engine: Optional[str] = "laya"
    difficulty: Optional[Literal["easy", "medium", "hard"]] = "easy"
    state: List[List[CellInput]]
    excludeCells: Optional[List[str]] = Field(default_factory=list)

class MoveInfo(BaseModel):
    choice: Optional[str] = None
    row: Optional[int] = None
    col: Optional[int] = None
    valid: bool
    isGuaranteedSafe: Optional[bool] = False

class DecisionResponse(BaseModel):
    engine: str = "laya"
    status: Literal["success", "no_candidates", "invalid_decision", "error"]
    move: MoveInfo
    confidence: Optional[float] = None
    confidenceNote: str = "Uncalibrated model output"
    latencyMs: float
    model: str
    decisionMode: Literal["direct", "staged_boundary"]
    error: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    model: str
    device: str
    ready: bool
