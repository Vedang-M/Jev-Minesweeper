"use client";

import React from "react";
import { Cell as CellType } from "@/types/games";

type CellProps = {
    cell: CellType;
    isSuggested?: boolean;
    onClick: () => void;
    onRightClick: () => void;
};

// Subtle, highly readable text colors for numbers on light neutral background
const NUMBER_COLORS: Record<number, string> = {
    1: "text-blue-600",
    2: "text-emerald-700",
    3: "text-rose-600",
    4: "text-indigo-950",
    5: "text-amber-800",
    6: "text-teal-700",
    7: "text-neutral-900",
    8: "text-neutral-500",
};

export default function Cell({
    cell,
    isSuggested,
    onClick,
    onRightClick,
}: CellProps) {
    function handleRightClick(event: React.MouseEvent<HTMLButtonElement>) {
        event.preventDefault();
        onRightClick();
    }

    return (
        <button
            type="button"
            onClick={onClick}
            onContextMenu={handleRightClick}
            className={`relative flex items-center justify-center w-full h-full aspect-square text-xs sm:text-sm font-semibold select-none border border-neutral-200 transition-colors focus:outline-none ${
                cell.isRevealed
                    ? "bg-neutral-100 text-neutral-900 cursor-default"
                    : "bg-white text-neutral-900 hover:bg-neutral-50 cursor-pointer active:bg-neutral-100"
            } ${
                isSuggested
                    ? "ring-2 ring-neutral-900 ring-inset z-10 font-bold"
                    : ""
            }`}
        >
            {cell.isRevealed ? (
                cell.isMine ? (
                    <span className="text-sm sm:text-base leading-none">💣</span>
                ) : cell.adjacentMines > 0 ? (
                    <span
                        className={`leading-none font-bold ${
                            NUMBER_COLORS[cell.adjacentMines] || "text-neutral-900"
                        }`}
                    >
                        {cell.adjacentMines}
                    </span>
                ) : null
            ) : cell.isFlagged ? (
                <span className="text-xs sm:text-sm leading-none">🚩</span>
            ) : null}
        </button>
    );
}