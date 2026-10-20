import { NextResponse } from "next/server";

type CellInput = {
    row: number;
    col: number;
    isMine?: boolean;
    isRevealed: boolean;
    isFlagged: boolean;
    adjacentMines?: number;
};

// Limit enforced by OpenRouter JEV choice questions
const MAX_CHOICES_LIMIT = 255;

export async function POST(request: Request) {
    try {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "OPENROUTER_API_KEY is not configured on the server." },
                { status: 500 }
            );
        }

        const body = await request.json();

        const board = body.state as CellInput[][];
        const excludeCells = new Set<string>(
            Array.isArray(body.excludeCells) ? body.excludeCells : []
        );

        if (!Array.isArray(board) || board.length === 0 || !Array.isArray(board[0])) {
            return NextResponse.json(
                { error: "Invalid board state. Expected non-empty 2D array." },
                { status: 400 }
            );
        }

        const rows = board.length;
        const cols = board[0].length;

        // Collect available candidates: strictly unrevealed, unflagged, not excluded, within board
        const availableCells: { row: number; col: number; key: string }[] = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = board[r][c];
                if (!cell || typeof cell.row !== "number" || typeof cell.col !== "number") {
                    continue;
                }
                const key = `${r}-${c}`;
                if (!cell.isRevealed && !cell.isFlagged && !excludeCells.has(key)) {
                    availableCells.push({ row: r, col: c, key });
                }
            }
        }

        if (availableCells.length === 0) {
            return NextResponse.json({
                error: "NO_NEW_MOVE",
                message: "No available candidate cells remain for JEV suggestion.",
            });
        }

        /*
         * STRICT INFORMATION BOUNDARY:
         * Never expose hidden mine information.
         * Revealed cells show their adjacent mine count.
         * Hidden cells have adjacentMines set to null and isMine stripped.
         */
        const visibleBoard = board.map((row) =>
            row.map((cell) => ({
                row: cell.row,
                col: cell.col,
                isRevealed: Boolean(cell.isRevealed),
                isFlagged: Boolean(cell.isFlagged),
                adjacentMines: cell.isRevealed ? (cell.adjacentMines ?? 0) : null,
            }))
        );

        let targetCandidates = availableCells;
        let decisionMode: "direct" | "staged_boundary" = "direct";

        if (availableCells.length > MAX_CHOICES_LIMIT) {
            decisionMode = "staged_boundary";
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
                targetCandidates = frontierCandidates.slice(0, MAX_CHOICES_LIMIT);
            } else {
                targetCandidates = availableCells.slice(0, MAX_CHOICES_LIMIT);
            }
        }

        const questions: Record<string, unknown> = {
            cell: {
                type: "choice",
                instructions:
                    "Choose the single safest unrevealed cell coordinate to reveal on this Minesweeper board.",
                criteria: Object.fromEntries(
                    targetCandidates.map((cell) => [
                        cell.key,
                        `Select cell at row ${cell.row}, column ${cell.col}.`,
                    ])
                ),
            },
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        let response: Response;
        try {
            response = await fetch(
                "https://openrouter.ai/api/alpha/decisions",
                {
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
                    signal: controller.signal,
                }
            );
        } finally {
            clearTimeout(timeoutId);
        }

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                {
                    error: "JEV_API_ERROR",
                    status: response.status,
                    details: data?.error?.message || "OpenRouter JEV API returned an error",
                },
                { status: response.status }
            );
        }

        let selectedKey: string | null = null;
        let confidence: number | null = null;

        const rawChoice = data.answers?.cell?.choice;
        if (typeof rawChoice === "string") {
            selectedKey = rawChoice;
        }
        if (typeof data.answers?.cell?.confidence === "number") {
            confidence = data.answers.cell.confidence;
        }

        /*
         * Validate the selected coordinate strictly:
         * 1. Must be a valid string key
         * 2. Must exist in availableCells (unrevealed, unflagged, not excluded)
         * NEVER silently replace with another cell.
         */
        const isValid = Boolean(
            selectedKey && availableCells.some((cell) => cell.key === selectedKey)
        );

        return NextResponse.json({
            ...data,
            decisionMode,
            answers: {
                ...data.answers,
                move: {
                    choice: selectedKey,
                    confidence,
                    valid: isValid,
                },
            },
        });
    } catch (error: unknown) {
        const isAbort = error instanceof Error && error.name === "AbortError";
        return NextResponse.json(
            {
                error: isAbort ? "JEV_TIMEOUT" : "JEV_REQUEST_FAILED",
                message: isAbort
                    ? "JEV decision request timed out after 15 seconds."
                    : error instanceof Error
                    ? error.message
                    : "Unexpected error during JEV request.",
            },
            { status: 500 }
        );
    }
}