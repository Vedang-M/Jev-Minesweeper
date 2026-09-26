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
import Cell from "./Cell";

type BoardProps = {
    board: BoardType;
};

export default function Board({ board: initialBoard }: BoardProps) {
    const [board, setBoard] = useState(initialBoard);
    const [gameStatus, setGameStatus] =
        useState<GameStatus>("playing");

    const [time, setTime] = useState(0);

    const [difficulty, setDifficulty] =
        useState<Difficulty>("easy");

    const currentMines = difficulties[difficulty].mines;

    const flaggedCount = board.flat().filter(
        (cell) => cell.isFlagged
    ).length;

    const remainingMines = currentMines - flaggedCount;

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

    function changeDifficulty(
        newDifficulty: Difficulty
    ) {
        setDifficulty(newDifficulty);
        setBoard(createBoard(newDifficulty));
        setGameStatus("playing");
        setTime(0);
    }

    function resetGame() {
        setBoard(createBoard(difficulty));
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

        newBoard[row][col].isFlagged =
            !newBoard[row][col].isFlagged;

        setBoard(newBoard);
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

            setBoard(newBoard);
            setGameStatus("lost");

            return;
        }


        if (updatedCell.adjacentMines === 0) {
            newBoard = revealEmptyCells(
                newBoard,
                row,
                col
            );
        } else {
            newBoard[row][col].isRevealed = true;
        }

        setBoard(newBoard);

        if (checkWin(newBoard)) {
            setGameStatus("won");
        }
    }

    return (
        <div className="flex flex-col items-center gap-4">

            <div className="flex gap-2">
                <button
                    onClick={() => changeDifficulty("easy")}
                    className="rounded-md bg-gray-200 px-3 py-1 text-black hover:bg-gray-300"
                >
                    Easy
                </button>

                <button
                    onClick={() => changeDifficulty("medium")}
                    className="rounded-md bg-gray-200 px-3 py-1 text-black hover:bg-gray-300"
                >
                    Medium
                </button>

                <button
                    onClick={() => changeDifficulty("hard")}
                    className="rounded-md bg-gray-200 px-3 py-1 text-black hover:bg-gray-300"
                >
                    Hard
                </button>
            </div>

            <div className="flex gap-6 text-lg font-bold text-black">
                <span>
                    💣 {remainingMines}
                </span>

                <span>
                    ⏱️ {time}s
                </span>
            </div>

            <div
                className="inline-grid"
                style={{
                    gridTemplateColumns: `repeat(${board[0].length}, 40px)`,
                }}
            >
                {board.flat().map((cell) => (
                    <Cell
                        key={`${cell.row}-${cell.col}`}
                        cell={cell}
                        onClick={() =>
                            revealCell(
                                cell.row,
                                cell.col
                            )
                        }
                        onRightClick={() =>
                            toggleFlag(
                                cell.row,
                                cell.col
                            )
                        }
                    />
                ))}
            </div>

            {gameStatus === "lost" && (
                <p className="text-xl font-bold text-red-600">
                    Game Over 💥
                </p>
            )}

            {gameStatus === "won" && (
                <p className="text-xl font-bold text-green-600">
                    You Won! 🎉
                </p>
            )}

            <button
                onClick={resetGame}
                className="rounded-md bg-black px-4 py-2 text-white hover:bg-gray-800"
            >
                New Game
            </button>

        </div>
    );
}