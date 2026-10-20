import { NextResponse } from "next/server";
import { extractConstraints } from "@/game/constraints";
import { solveConstraints } from "@/game/constraintSolver";

type CellInput = {
    row: number;
    col: number;
    isMine?: boolean;
    isRevealed: boolean;
    isFlagged: boolean;
    adjacentMines?: number;
};

// Limit enforced by OpenRouter JEV / choice questions
const MAX_CHOICES_LIMIT = 255;

export async function POST(request: Request) {
    const startTime = Date.now();
    try {
        const body = await request.json();
        const engine = body.engine || "jev"; // "jev" | "laya" | "classical"
        const board = body.state as CellInput[][];
        const excludeCells = new Set<string>(
            Array.isArray(body.excludeCells) ? body.excludeCells : []
        );

        if (!Array.isArray(board) || board.length === 0 || !Array.isArray(board[0])) {
            return NextResponse.json(
                {
                    engine,
                    status: "error",
                    error: "Invalid board state. Expected non-empty 2D array.",
                },
                { status: 400 }
            );
        }

        const rows = board.length;
        const cols = board[0].length;

        // 1. Collect strictly unrevealed, non-flagged, non-excluded candidate cells
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
                engine,
                status: "no_candidates",
                move: { choice: null, row: null, col: null, valid: false, isGuaranteedSafe: false },
                confidence: null,
                confidenceNote: "No candidate cells available",
                latencyMs: Date.now() - startTime,
                model: engine,
                decisionMode: "direct",
                error: "No available candidate cells remain for decision.",
            });
        }

        // 2. Compute classical constraint ground truth to evaluate isGuaranteedSafe
        const fullCellsBoard = board.map((r) =>
            r.map((c) => ({
                row: c.row,
                col: c.col,
                isMine: false, // evaluator/solver has no hidden mine info
                isRevealed: Boolean(c.isRevealed),
                isFlagged: Boolean(c.isFlagged),
                adjacentMines: c.isRevealed ? (c.adjacentMines ?? 0) : 0,
            }))
        );
        const classicalConstraints = extractConstraints(fullCellsBoard);
        const classicalResult = solveConstraints(classicalConstraints);
        const guaranteedSafeSet = new Set(classicalResult.safeCells);

        // 3. Engine Dispatch
        if (engine === "classical") {
            const hasGuaranteed = classicalResult.safeCells.length > 0;
            const choice = hasGuaranteed
                ? classicalResult.safeCells.find((c) => !excludeCells.has(c)) || classicalResult.safeCells[0]
                : availableCells[0].key;

            const [cr, cc] = choice.split("-").map(Number);
            return NextResponse.json({
                engine: "classical",
                status: "success",
                move: {
                    choice,
                    row: cr,
                    col: cc,
                    valid: availableCells.some((c) => c.key === choice),
                    isGuaranteedSafe: guaranteedSafeSet.has(choice),
                },
                confidence: hasGuaranteed ? 1.0 : null,
                confidenceNote: hasGuaranteed ? "Deductively proven safe" : "Probabilistic guess",
                latencyMs: Date.now() - startTime,
                model: "classical-constraint-solver",
                decisionMode: "direct",
                error: null,
            });
        }

        if (engine === "laya") {
            // Check Laya service URL (local or hosted)
            const layaServiceUrl = process.env.LAYA_SERVICE_URL || "http://127.0.0.1:8000";
            const layaApiKey = process.env.LAYA_API_KEY || "";

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);

            let layaRes: Response;
            try {
                const headers: Record<string, string> = { "Content-Type": "application/json" };
                if (layaApiKey) {
                    headers["Authorization"] = `Bearer ${layaApiKey}`;
                }

                layaRes = await fetch(`${layaServiceUrl}/v1/decision`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        engine: "laya",
                        difficulty: body.difficulty || "easy",
                        state: board,
                        excludeCells: Array.from(excludeCells),
                    }),
                    signal: controller.signal,
                });
            } catch (err: unknown) {
                const isAbort = err instanceof Error && err.name === "AbortError";

                return NextResponse.json(
                    {
                        engine: "laya",
                        status: "error",
                        move: { choice: null, row: null, col: null, valid: false, isGuaranteedSafe: false },
                        confidence: null,
                        confidenceNote: "Service unavailable",
                        latencyMs: Date.now() - startTime,
                        model: "convaiinnovations/laya",
                        decisionMode: "direct",
                        error: isAbort
                            ? "Laya service request timed out after 12s."
                            : `Laya service unreachable at ${layaServiceUrl}. Ensure local service is running or LAYA_SERVICE_URL is configured.`,
                    },
                    { status: 503 }
                );
            } finally {
                clearTimeout(timeoutId);
            }

            const layaData = await layaRes.json();
            if (!layaRes.ok) {
                return NextResponse.json(
                    {
                        engine: "laya",
                        status: "error",
                        move: { choice: null, row: null, col: null, valid: false, isGuaranteedSafe: false },
                        confidence: null,
                        confidenceNote: "Laya service error",
                        latencyMs: Date.now() - startTime,
                        model: "convaiinnovations/laya",
                        decisionMode: layaData.decisionMode || "direct",
                        error: layaData.error || `Laya service returned status ${layaRes.status}`,
                    },
                    { status: layaRes.status }
                );
            }

            const choiceKey = layaData.move?.choice;
            const isValid = Boolean(
                choiceKey && availableCells.some((c) => c.key === choiceKey)
            );

            return NextResponse.json({
                ...layaData,
                move: {
                    ...layaData.move,
                    valid: isValid,
                    isGuaranteedSafe: choiceKey ? guaranteedSafeSet.has(choiceKey) : false,
                },
            });
        }

        // 4. Default / JEV Route
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                {
                    engine: "jev",
                    status: "error",
                    error: "OPENROUTER_API_KEY is not configured on the server.",
                },
                { status: 500 }
            );
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
            response = await fetch("https://openrouter.ai/api/alpha/decisions", {
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
            });
        } finally {
            clearTimeout(timeoutId);
        }

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json(
                {
                    engine: "jev",
                    status: "error",
                    error: data?.error?.message || "OpenRouter JEV API returned an error",
                },
                { status: response.status }
            );
        }

        let selectedKey: string | null = null;
        let confidence: number | null = null;

        const rawChoice = data.answers?.cell?.choice;
        if (typeof rawChoice === "string") selectedKey = rawChoice;
        if (typeof data.answers?.cell?.confidence === "number") {
            confidence = data.answers.cell.confidence;
        }

        const isValid = Boolean(
            selectedKey && availableCells.some((cell) => cell.key === selectedKey)
        );

        let row: number | null = null;
        let col: number | null = null;
        if (selectedKey && isValid) {
            const parts = selectedKey.split("-").map(Number);
            row = parts[0];
            col = parts[1];
        }

        return NextResponse.json({
            engine: "jev",
            status: isValid ? "success" : "invalid_decision",
            move: {
                choice: isValid ? selectedKey : null,
                row,
                col,
                valid: isValid,
                isGuaranteedSafe: selectedKey ? guaranteedSafeSet.has(selectedKey) : false,
            },
            confidence: confidence !== null ? Number(confidence.toFixed(4)) : null,
            confidenceNote: "Uncalibrated model output",
            latencyMs: Date.now() - startTime,
            model: data.model || "~typesafe/jev-latest",
            decisionMode,
            error: isValid ? null : `JEV selected invalid coordinate: ${selectedKey}`,
        });
    } catch (error: unknown) {
        const isAbort = error instanceof Error && error.name === "AbortError";
        return NextResponse.json(
            {
                engine: "jev",
                status: "error",
                error: isAbort
                    ? "JEV decision request timed out after 15 seconds."
                    : error instanceof Error
                    ? error.message
                    : "Unexpected error during decision request.",
            },
            { status: 500 }
        );
    }

}
