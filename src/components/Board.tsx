"use client";

import { useState } from "react";
import { Board as BoardType, GameStatus } from "@/types/games";
import Cell from "./Cell";

type BoardProps = {
    board: BoardType;
};

export default function Board({ board: initialBoard }: BoardProps) {
    const [board, setBoard] = useState(initialBoard);
    const [gameStatus, setGameStatus] = useState<GameStatus>("playing");

    function revealCell(row: number, col: number) {
        if (gameStatus !== "playing") return;

        const clickedCell = board[row][col];

        if (clickedCell.isRevealed) return;

        const newBoard = board.map((currentRow) =>
            currentRow.map((cell) => ({ ...cell }))
        );

        newBoard[row][col].isRevealed = true;

        if (clickedCell.isMine) {
            setBoard(newBoard);
            setGameStatus("lost");
            return;
        }

        setBoard(newBoard);
    }

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="inline-grid grid-cols-9">
                {board.flat().map((cell) => (
                    <Cell
                        key={`${cell.row}-${cell.col}`}
                        cell={cell}
                        onClick={() => revealCell(cell.row, cell.col)}
                    />
                ))}
            </div>

            {gameStatus === "lost" && (
                <p className="text-xl font-bold text-red-600">
                    Game Over 💥
                </p>
            )}
        </div>
    );
}