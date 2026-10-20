"use client";

import { useEffect, useState } from "react";
import { Board as BoardType, GameStatus } from "@/types/games";
import {
    createBoard,
    difficulties,
    Difficulty,
    placeMines,
    calculateAdjacentMines,
} from "@/game/boards";
import { extractConstraints } from "@/game/constraints";
import { solveConstraints } from "@/game/constraintSolver";
import Cell from "./Cell";

type BoardProps = {
    board: BoardType;
};

// Helper to convert column index to letter (0 -> A, 1 -> B, ...)
function toCoord(row: number, col: number): string {
    const colLetter = String.fromCharCode(65 + col);
    const rowNum = row + 1;
    return `${colLetter}${rowNum}`;
}

export default function Board({ board: initialBoard }: BoardProps) {
    const [board, setBoard] = useState(initialBoard);
    const [gameStatus, setGameStatus] = useState<GameStatus>("playing");

    const [engine, setEngine] = useState<"jev" | "laya" | "classical">("jev");
    const [time, setTime] = useState(0);

    const [classicalSuggestion, setClassicalSuggestion] = useState<{
        row: number;
        col: number;
        reason: string;
        isGuaranteedSafe: boolean;
    } | null>(null);

    const [aiSuggestion, setAiSuggestion] = useState<{
        engine: "jev" | "laya";
        row: number;
        col: number;
        confidence: number | null;
        isGuaranteedSafe: boolean;
        latencyMs: number;
    } | null>(null);

    const [excludedCells, setExcludedCells] = useState<string[]>([]);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const [isRequesting, setIsRequesting] = useState(false);

    const [difficulty, setDifficulty] = useState<Difficulty>("easy");

    const currentMines = difficulties[difficulty].mines;

    const flaggedCount = board.flat().filter(
        (cell) => cell.isFlagged
    ).length;

    const remainingMines = Math.max(0, currentMines - flaggedCount);

    function resetHistory() {
        setExcludedCells([]);
        setAiSuggestion(null);
        setClassicalSuggestion(null);
        setStatusMessage(null);
    }

    function clearSuggestionsOnBoardChange() {
        setClassicalSuggestion(null);
        setAiSuggestion(null);
        setStatusMessage(null);
        setExcludedCells([]);
    }


    useEffect(() => {
        if (gameStatus !== "playing") return;

        const timer = setInterval(() => {
            setTime((currentTime) => currentTime + 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [gameStatus]);

    function revealEmptyCells(
        currentBoard: BoardType,
        startRow: number,
        startCol: number
    ): BoardType {
        const newBoard = currentBoard.map((row) =>
            row.map((cell) => ({ ...cell }))
        );

        const queue: { row: number; col: number }[] = [
            { row: startRow, col: startCol },
        ];

        const visited = new Set<string>();

        while (queue.length > 0) {
            const current = queue.shift()!;
            const { row, col } = current;

            const key = `${row}-${col}`;

            if (visited.has(key)) continue;

            visited.add(key);

            const cell = newBoard[row][col];

            if (cell.isMine) continue;

            cell.isRevealed = true;

            if (cell.adjacentMines !== 0) continue;

            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;

                    const newRow = row + dr;
                    const newCol = col + dc;

                    if (
                        newRow >= 0 &&
                        newRow < newBoard.length &&
                        newCol >= 0 &&
                        newCol < newBoard[0].length
                    ) {
                        queue.push({
                            row: newRow,
                            col: newCol,
                        });
                    }
                }
            }
        }

        return newBoard;
    }

    function checkWin(currentBoard: BoardType): boolean {
        for (const row of currentBoard) {
            for (const cell of row) {
                if (!cell.isMine && !cell.isRevealed) {
                    return false;
                }
            }
        }

        return true;
    }

    function changeDifficulty(newDifficulty: Difficulty) {
        setDifficulty(newDifficulty);
        setBoard(createBoard(newDifficulty));
        resetHistory();
        setGameStatus("playing");
        setTime(0);
    }

    function resetGame() {
        setBoard(createBoard(difficulty));
        resetHistory();
        setGameStatus("playing");
        setTime(0);
    }

    function toggleFlag(row: number, col: number) {
        if (gameStatus !== "playing") return;

        const cell = board[row][col];

        if (cell.isRevealed) return;

        if (!cell.isFlagged && flaggedCount >= currentMines) {
            return;
        }

        const newBoard = board.map((currentRow) =>
            currentRow.map((currentCell) => ({
                ...currentCell,
            }))
        );

        newBoard[row][col].isFlagged = !newBoard[row][col].isFlagged;

        setBoard(newBoard);
        clearSuggestionsOnBoardChange();
    }

    function suggestMove() {
        if (gameStatus !== "playing") return;

        const constraints = extractConstraints(board);
        const result = solveConstraints(constraints);

        if (result.hasContradiction) {
            setClassicalSuggestion({
                row: -1,
                col: -1,
                reason: "Contradiction detected in board flags/constraints.",
                isGuaranteedSafe: false,
            });
            return;
        }

        if (result.safeCells.length > 0) {
            const [row, col] = result.safeCells[0]
                .split("-")
                .map(Number);

            setClassicalSuggestion({
                row,
                col,
                reason: "This cell is proven safe by constraint logic.",
                isGuaranteedSafe: true,
            });

            return;
        }

        if (result.mineCells.length > 0) {
            const [row, col] = result.mineCells[0]
                .split("-")
                .map(Number);

            setClassicalSuggestion({
                row,
                col,
                reason: "This cell is proven to be a mine.",
                isGuaranteedSafe: false,
            });

            return;
        }

        setClassicalSuggestion({
            row: -1,
            col: -1,
            reason: "No guaranteed safe move found. A deduction or guess is required.",
            isGuaranteedSafe: false,
        });
    }

    function revealCell(row: number, col: number) {
        if (gameStatus !== "playing") return;

        const clickedCell = board[row][col];

        if (clickedCell.isRevealed || clickedCell.isFlagged) {
            return;
        }

        const isFirstMove = !board.some((row) =>
            row.some((cell) => cell.isMine)
        );

        let newBoard: BoardType;

        if (isFirstMove) {
            newBoard = board.map((currentRow) =>
                currentRow.map((cell) => ({
                    ...cell,
                }))
            );

            placeMines(
                newBoard,
                newBoard.length,
                newBoard[0].length,
                currentMines,
                row,
                col
            );

            calculateAdjacentMines(
                newBoard,
                newBoard.length,
                newBoard[0].length
            );
        } else {
            newBoard = board.map((currentRow) =>
                currentRow.map((cell) => ({
                    ...cell,
                }))
            );
        }

        const updatedCell = newBoard[row][col];

        if (updatedCell.isMine) {
            updatedCell.isRevealed = true;

            // Reveal all mines on game over with consistent styling
            newBoard.forEach((r) =>
                r.forEach((c) => {
                    if (c.isMine) c.isRevealed = true;
                })
            );

            setBoard(newBoard);
            setGameStatus("lost");
            clearSuggestionsOnBoardChange();
            return;
        }

        if (updatedCell.adjacentMines === 0) {
            newBoard = revealEmptyCells(newBoard, row, col);
        } else {
            newBoard[row][col].isRevealed = true;
        }

        setBoard(newBoard);
        clearSuggestionsOnBoardChange();

        if (checkWin(newBoard)) {
            setGameStatus("won");
        }
    }

    async function askDecision(engineToUse?: "jev" | "laya") {
        const targetEngine = engineToUse || (engine === "classical" ? "jev" : engine);
        if (gameStatus !== "playing" || isRequesting) return;

        setIsRequesting(true);
        setStatusMessage(null);
        try {
            const response = await fetch("/api/decision", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    engine: targetEngine,
                    difficulty,
                    state: board,
                    excludeCells: excludedCells,
                }),
            });

            const result = await response.json();

            if (result.status === "no_candidates") {
                setStatusMessage(`No available candidate moves for ${targetEngine.toUpperCase()}.`);
                return;
            }

            if (!response.ok || result.status === "error") {
                setAiSuggestion(null);
                setStatusMessage(result.error || `${targetEngine.toUpperCase()} request failed.`);
                return;
            }

            const move = result.move;
            const choice = move?.choice;
            const isValid = move?.valid;

            if (!choice || isValid === false || excludedCells.includes(choice)) {
                setAiSuggestion(null);
                setStatusMessage(`${targetEngine.toUpperCase()} returned an invalid or repeated move.`);
                return;
            }

            const [row, col] = choice.split("-").map(Number);

            setAiSuggestion({
                engine: targetEngine,
                row,
                col,
                confidence: typeof result.confidence === "number" ? result.confidence : null,
                isGuaranteedSafe: Boolean(move?.isGuaranteedSafe),
                latencyMs: typeof result.latencyMs === "number" ? result.latencyMs : 0,
            });

            setExcludedCells((prev) =>
                prev.includes(choice) ? prev : [...prev, choice]
            );
        } catch (error: unknown) {
            console.error("Decision request failed:", error);
            setAiSuggestion(null);
            setStatusMessage(`Failed to reach ${targetEngine.toUpperCase()} service.`);
        } finally {
            setIsRequesting(false);
        }

    }



    const difficultiesList: Difficulty[] = ["easy", "medium", "hard"];

    return (
        <div className="flex flex-col items-center w-full max-w-full gap-5">
            {/* 3. Difficulty Selector - Segmented Control */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
                {/* Difficulty Selector */}
                <div className="inline-flex items-center rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 text-xs sm:text-sm font-medium">
                    {difficultiesList.map((d) => {
                        const isActive = difficulty === d;
                        return (
                            <button
                                key={d}
                                type="button"
                                onClick={() => changeDifficulty(d)}
                                className={`rounded-md px-3.5 py-1.5 capitalize transition-all duration-150 focus:outline-none ${
                                    isActive
                                        ? "bg-neutral-900 text-white font-medium shadow-sm"
                                        : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60"
                                }`}
                            >
                                {d}
                            </button>
                        );
                    })}
                </div>

                {/* Engine Selector */}
                <div className="inline-flex items-center rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 text-xs sm:text-sm font-medium">
                    {(["jev", "laya"] as const).map((eng) => {
                        const isActive = engine === eng;
                        return (
                            <button
                                key={eng}
                                type="button"
                                onClick={() => {
                                    setEngine(eng);
                                    setAiSuggestion(null);
                                    setStatusMessage(null);
                                }}
                                className={`rounded-md px-3 py-1.5 uppercase tracking-wide text-xs transition-all duration-150 focus:outline-none ${
                                    isActive
                                        ? "bg-neutral-900 text-white font-semibold shadow-sm"
                                        : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60"
                                }`}
                            >
                                {eng}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 4. Game HUD */}
            <div className="flex items-center justify-between w-full max-w-xs px-2 py-1 text-neutral-800 text-sm sm:text-base font-medium">
                <div className="flex items-center gap-2">
                    <span className="text-base sm:text-lg leading-none select-none">💣</span>
                    <span className="font-semibold tabular-nums text-neutral-900">{remainingMines}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-base sm:text-lg leading-none select-none">⏱</span>
                    <span className="font-semibold tabular-nums text-neutral-900">{time}s</span>
                </div>
            </div>

            {/* 5. Minesweeper Board (Centerpiece with horizontal scroll safeguard on mobile) */}
            <div className="max-w-full overflow-x-auto p-1 flex justify-center">
                <div
                    className="inline-grid border border-neutral-300 bg-neutral-200 rounded-sm overflow-hidden"
                    style={{
                        gridTemplateColumns: `repeat(${board[0].length}, ${
                            difficulty === "hard" ? "24px" : difficulty === "medium" ? "30px" : "36px"
                        })`,
                    }}
                >
                    {board.flat().map((cell) => (
                        <Cell
                            key={`${cell.row}-${cell.col}`}
                            cell={cell}
                            isSuggested={
                                (aiSuggestion?.row === cell.row && aiSuggestion?.col === cell.col) ||
                                (classicalSuggestion?.row === cell.row && classicalSuggestion?.col === cell.col)
                            }
                            onClick={() => revealCell(cell.row, cell.col)}
                            onRightClick={() => toggleFlag(cell.row, cell.col)}
                        />
                    ))}
                </div>
            </div>

            {/* 7. Game Status */}
            {gameStatus !== "playing" && (
                <div className="text-center py-0.5">
                    <p className={`text-base font-semibold tracking-tight ${
                        gameStatus === "lost" ? "text-neutral-800" : "text-neutral-900"
                    }`}>
                        {gameStatus === "lost" ? "Game Over" : "You Won"}
                    </p>
                </div>
            )}

            {/* 8. Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full max-w-xs mt-1">
                {/* Primary: Ask Selected Engine */}
                <button
                    type="button"
                    onClick={() => askDecision()}
                    disabled={gameStatus !== "playing" || isRequesting}
                    className="w-full sm:flex-1 h-9 px-4 rounded-md bg-neutral-900 text-white text-xs sm:text-sm font-medium hover:bg-neutral-800 active:bg-neutral-950 disabled:opacity-50 disabled:pointer-events-none transition-colors focus:outline-none"
                >
                    {isRequesting ? "Thinking..." : `Ask ${engine.toUpperCase()}`}
                </button>

                {/* Secondary: Classical Suggest Move */}
                <button
                    type="button"
                    onClick={suggestMove}
                    disabled={gameStatus !== "playing"}
                    className="w-full sm:flex-1 h-9 px-4 rounded-md bg-white border border-neutral-300 text-neutral-800 text-xs sm:text-sm font-medium hover:bg-neutral-50 active:bg-neutral-100 disabled:opacity-50 disabled:pointer-events-none transition-colors focus:outline-none"
                >
                    Solve Logic
                </button>
            </div>

            {/* 9. AI / Solver Result Panel */}
            <div className="w-full max-w-xs">
                <div className="rounded-md border border-neutral-200 bg-white p-3 text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                            {engine.toUpperCase()} Recommendation
                        </span>
                        {aiSuggestion?.latencyMs ? (
                            <span className="text-[11px] text-neutral-400 font-mono">
                                {aiSuggestion.latencyMs}ms
                            </span>
                        ) : null}
                    </div>

                    {statusMessage ? (
                        <div className="text-xs sm:text-sm text-neutral-600">
                            {statusMessage}
                        </div>
                    ) : aiSuggestion ? (
                        <div className="space-y-1.5 text-xs sm:text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-neutral-500">Suggested move</span>
                                <span className="font-semibold text-neutral-900">
                                    {toCoord(aiSuggestion.row, aiSuggestion.col)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-neutral-500">Confidence</span>
                                <span className="font-semibold text-neutral-900">
                                    {aiSuggestion.confidence !== null
                                        ? `${Math.round(aiSuggestion.confidence <= 1 ? aiSuggestion.confidence * 100 : aiSuggestion.confidence)}%`
                                        : "Not provided"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-neutral-500">Constraint verification</span>
                                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                                    aiSuggestion.isGuaranteedSafe
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}>
                                    {aiSuggestion.isGuaranteedSafe ? "Guaranteed Safe" : "Probabilistic / Unguaranteed"}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-xs sm:text-sm text-neutral-500">
                            {engine.toUpperCase()} is ready
                        </div>
                    )}
                </div>

                {/* Classical Suggestion Info (if present) */}
                {classicalSuggestion && classicalSuggestion.reason && (
                    <div className="mt-2 px-3 py-2 rounded-md border border-neutral-200 bg-neutral-50 text-xs text-neutral-700">
                        {classicalSuggestion.row >= 0 ? (
                            <p>
                                <span className="font-semibold text-neutral-900">
                                    {toCoord(classicalSuggestion.row, classicalSuggestion.col)}:
                                </span>{" "}
                                {classicalSuggestion.reason}
                            </p>
                        ) : (
                            <p className="text-neutral-500">{classicalSuggestion.reason}</p>
                        )}
                    </div>
                )}
            </div>

            {/* Tertiary Action: New Game (Understated below AI panel) */}
            <button
                type="button"
                onClick={resetGame}
                className="text-xs sm:text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors py-1 px-3 rounded focus:outline-none"
            >
                New Game
            </button>
        </div>
    );
}