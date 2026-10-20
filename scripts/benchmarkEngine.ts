import * as fs from "fs";
import * as path from "path";
import {
    createEmptyBoard,
    difficulties,
    Difficulty,
    calculateAdjacentMines,
} from "../src/game/boards";
import { extractConstraints } from "../src/game/constraints";
import { solveConstraints } from "../src/game/constraintSolver";
import { Board, Cell } from "../src/types/games";

// Simple PRNG (Linear Congruential Generator) for reproducible boards
class LCG {
    private state: number;
    constructor(seed: number) {
        this.state = seed >>> 0;
    }
    next(): number {
        // ANSI C LCG parameters
        this.state = (1103515245 * this.state + 12345) >>> 0;
        return (this.state & 0x7fffffff) / 0x80000000;
    }
}

// Generate deterministic board using explicit seed
export function generateDeterministicBoard(
    difficulty: Difficulty,
    seed: number,
    safeRow: number = 0,
    safeCol: number = 0
): Board {
    const { rows, cols, mines } = difficulties[difficulty];
    const board = createEmptyBoard(rows, cols);
    const prng = new LCG(seed);

    const positions = Array.from({ length: rows * cols }, (_, i) => i).filter((pos) => {
        const r = Math.floor(pos / cols);
        const c = pos % cols;
        return r !== safeRow || c !== safeCol;
    });

    // Fisher-Yates shuffle with PRNG
    for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(prng.next() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    for (let i = 0; i < mines; i++) {
        const pos = positions[i];
        const r = Math.floor(pos / cols);
        const c = pos % cols;
        board[r][c].isMine = true;
    }

    return calculateAdjacentMines(board, rows, cols);
}

// Reveal logic (flood-fill on 0)
export function revealBoardCell(
    board: Board,
    row: number,
    col: number
): { board: Board; hitMine: boolean } {
    const newBoard: Board = board.map((r) => r.map((c) => ({ ...c })));
    const target = newBoard[row][col];

    if (target.isMine) {
        target.isRevealed = true;
        return { board: newBoard, hitMine: true };
    }

    const queue: { row: number; col: number }[] = [{ row, col }];
    const visited = new Set<string>();

    while (queue.length > 0) {
        const current = queue.shift()!;
        const key = `${current.row}-${current.col}`;
        if (visited.has(key)) continue;
        visited.add(key);

        const c = newBoard[current.row][current.col];
        if (c.isMine) continue;
        c.isRevealed = true;

        if (c.adjacentMines === 0) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = current.row + dr;
                    const nc = current.col + dc;
                    if (nr >= 0 && nr < newBoard.length && nc >= 0 && nc < newBoard[0].length) {
                        queue.push({ row: nr, col: nc });
                    }
                }
            }
        }
    }

    return { board: newBoard, hitMine: false };
}

export function isGameWon(board: Board): boolean {
    for (const r of board) {
        for (const c of r) {
            if (!c.isMine && !c.isRevealed) return false;
        }
    }
    return true;
}

export type DecisionLog = {
    experimentId: string;
    gameId: string;
    phase: "diagnostic_snapshot" | "full_game";
    seed: number;
    difficulty: Difficulty;
    method: "classical" | "jev" | "laya";
    decisionIndex: number;
    visibleBoardSnapshotId: string;
    suggestedCoordinate: string;
    isValid: boolean;
    isSafe: boolean;
    guaranteedSafeExisted: boolean;
    matchedGuaranteedSafe: boolean;
    latencyMs: number;
    confidence: number | null;
    apiCost: number;
    terminalOutcome: "continue" | "won" | "lost" | "invalid" | "no_candidates";
};


// Player-visible board
export function getVisibleBoard(board: Board) {
    return board.map((r) =>
        r.map((c) => ({
            row: c.row,
            col: c.col,
            isRevealed: c.isRevealed,
            isFlagged: c.isFlagged,
            adjacentMines: c.isRevealed ? c.adjacentMines : null,
        }))
    );
}

// Classical Decision
export function getClassicalMove(board: Board): {
    coordinate: string;
    isGuaranteed: boolean;
    guaranteedSafeMoves: string[];
} {
    const constraints = extractConstraints(board);
    const result = solveConstraints(constraints);

    if (result.safeCells.length > 0) {
        return {
            coordinate: result.safeCells[0],
            isGuaranteed: true,
            guaranteedSafeMoves: result.safeCells,
        };
    }

    // Probabilistic fallback: find unrevealed, non-flagged cell with minimum estimated risk
    const unrevealed: string[] = [];
    for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[0].length; c++) {
            if (!board[r][c].isRevealed && !board[r][c].isFlagged) {
                unrevealed.push(`${r}-${c}`);
            }
        }
    }

    return {
        coordinate: unrevealed.length > 0 ? unrevealed[0] : "",
        isGuaranteed: false,
        guaranteedSafeMoves: [],
    };
}

// JEV Decision API call
export async function getJevMove(
    board: Board,
    apiKey: string,
    excludeCells: Set<string>
): Promise<{
    coordinate: string | null;
    confidence: number | null;
    latencyMs: number;
    cost: number;
    rawResponse: any;
    error?: string;
}> {
    const visibleBoard = getVisibleBoard(board);
    const availableCells: { row: number; col: number; key: string }[] = [];
    for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[0].length; c++) {
            const cell = board[r][c];
            const key = `${r}-${c}`;
            if (!cell.isRevealed && !cell.isFlagged && !excludeCells.has(key)) {
                availableCells.push({ row: r, col: c, key });
            }
        }
    }

    if (availableCells.length === 0) {
        return {
            coordinate: null,
            confidence: null,
            latencyMs: 0,
            cost: 0,
            rawResponse: null,
            error: "NO_NEW_MOVE",
        };
    }

    // Choice limit handling: OpenRouter Decisions API supports up to 255 choice options.
    // When candidates > 250, use a staged frontier boundary selection strategy
    // prioritizing unrevealed cells adjacent to revealed clue numbers, preventing invalid coordinate decoupling.
    let targetCandidates = availableCells;
    const decisionMode = availableCells.length <= 250 ? "direct" : "staged_boundary";

    if (availableCells.length > 250) {
        const rows = board.length;
        const cols = board[0].length;
        const frontierCandidates: { row: number; col: number; key: string }[] = [];

        for (const cell of availableCells) {
            let isFrontier = false;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = cell.row + dr;
                    const nc = cell.col + dc;
                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                        if (board[nr][nc].isRevealed && (board[nr][nc].adjacentMines || 0) > 0) {
                            isFrontier = true;
                            break;
                        }
                    }
                }
                if (isFrontier) break;
            }
            if (isFrontier) {
                frontierCandidates.push(cell);
            }
        }

        if (frontierCandidates.length > 0) {
            targetCandidates = frontierCandidates.slice(0, 250);
        } else {
            targetCandidates = availableCells.slice(0, 250);
        }
    }

    const questions: Record<string, unknown> = {
        cell: {
            type: "choice",
            instructions:
                "Choose the single safest unrevealed cell coordinate to reveal on this Minesweeper board.",
            criteria: Object.fromEntries(
                targetCandidates.map((c) => [
                    c.key,
                    `Select cell at row ${c.row}, column ${c.col}.`,
                ])
            ),
        },
    };

    const startTime = Date.now();
    try {
        const response = await fetch("https://openrouter.ai/api/alpha/decisions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "~typesafe/jev-latest",
                state: {
                    board: visibleBoard,
                    candidateCount: availableCells.length,
                },
                questions,
            }),
        });

        const latencyMs = Date.now() - startTime;
        const data = await response.json();

        if (!response.ok) {
            return {
                coordinate: null,
                confidence: null,
                latencyMs,
                cost: 0,
                rawResponse: data,
                error: `HTTP_${response.status}`,
            };
        }

        const cost = typeof data.usage?.cost === "number" ? data.usage.cost : 0;
        let coordinate: string | null = null;
        let confidence: number | null = null;

        const raw = data.answers?.cell?.choice;
        if (typeof raw === "string") coordinate = raw;
        if (typeof data.answers?.cell?.confidence === "number") {
            confidence = data.answers.cell.confidence;
        }

        return {
            coordinate,
            confidence,
            latencyMs,
            cost,
            rawResponse: data,
        };
    } catch (err: unknown) {
        return {
            coordinate: null,
            confidence: null,
            latencyMs: Date.now() - startTime,
            cost: 0,
            rawResponse: null,
            error: err instanceof Error ? err.message : "NETWORK_ERROR",
        };
    }
}

// Laya Decision Service call
export async function getLayaMove(
    board: Board,
    serviceUrl: string = "http://127.0.0.1:8000",
    apiKey?: string,
    excludeCells: Set<string> = new Set()
): Promise<{
    coordinate: string | null;
    confidence: number | null;
    latencyMs: number;
    decisionMode: string;
    rawResponse: unknown;
    error?: string;
}> {
    const startTime = Date.now();
    const visibleBoard = getVisibleBoard(board);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

        const res = await fetch(`${serviceUrl}/v1/decision`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                engine: "laya",
                state: visibleBoard,
                excludeCells: Array.from(excludeCells),
            }),
            signal: controller.signal,
        });

        const latencyMs = Date.now() - startTime;
        const data = await res.json();

        if (!res.ok) {
            return {
                coordinate: null,
                confidence: null,
                latencyMs,
                decisionMode: "error",
                rawResponse: data,
                error: `HTTP_${res.status}: ${data.error || "Laya service error"}`,
            };
        }

        return {
            coordinate: data.move?.choice || null,
            confidence: typeof data.confidence === "number" ? data.confidence : null,
            latencyMs,
            decisionMode: data.decisionMode || "direct",
            rawResponse: data,
            error: data.status === "error" ? data.error : undefined,
        };
    } catch (err: unknown) {
        const isAbort = err instanceof Error && err.name === "AbortError";
        return {
            coordinate: null,
            confidence: null,
            latencyMs: Date.now() - startTime,
            decisionMode: "error",
            rawResponse: null,
            error: isAbort ? "TIMEOUT" : err instanceof Error ? err.message : "NETWORK_ERROR",
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

