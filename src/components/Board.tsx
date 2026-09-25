"use client";

import { useState } from "react";
import { createBoard } from "@/game/boards";
import { Board as BoardType, GameStatus } from "@/types/games";
import Cell from "./Cell";

type BoardProps = {
    board: BoardType;
};

export default function Board({ board: initialBoard }: BoardProps) {
    const [board, setBoard] = useState(initialBoard);
    const [gameStatus, setGameStatus] = useState<GameStatus>("playing");

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

    function resetGame() {
        setBoard(createBoard());
        setGameStatus("playing");
    }

    function toggleFlag(row: number, col: number) {
        if (gameStatus !== "playing") return;

        const cell = board[row][col];

        if (cell.isRevealed) return;

        const newBoard = board.map((currentRow) =>
            currentRow.map((currentCell) => ({ ...currentCell }))
        );

        newBoard[row][col].isFlagged =
            !newBoard[row][col].isFlagged;

        setBoard(newBoard);
    }

    function revealCell(row: number, col: number) {
        if (gameStatus !== "playing") return;

        const clickedCell = board[row][col];

        if (clickedCell.isRevealed || clickedCell.isFlagged) return;

        // If the player clicks a mine
        if (clickedCell.isMine) {
            const newBoard = board.map((currentRow) =>
                currentRow.map((cell) => ({ ...cell }))
            );

            newBoard[row][col].isRevealed = true;

            setBoard(newBoard);
            setGameStatus("lost");

            return;
        }

        let newBoard: BoardType;

        // If the player clicks an empty cell,
        // reveal the connected empty area.
        if (clickedCell.adjacentMines === 0) {
            newBoard = revealEmptyCells(board, row, col);
        } else {
            newBoard = board.map((currentRow) =>
                currentRow.map((cell) => ({ ...cell }))
            );

            newBoard[row][col].isRevealed = true;
        }

        setBoard(newBoard);

        if (checkWin(newBoard)) {
            setGameStatus("won");
        }
    }

    <button
        onClick={resetGame}
        className="rounded-md bg-black px-4 py-2 text-white hover:bg-gray-800"
    >
        New Game
    </button>

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="inline-grid grid-cols-9">
                {board.flat().map((cell) => (
                    <Cell
                        key={`${cell.row}-${cell.col}`}
                        cell={cell}
                        onClick={() => revealCell(cell.row, cell.col)}
                        onRightClick={() =>
                            toggleFlag(cell.row, cell.col)
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