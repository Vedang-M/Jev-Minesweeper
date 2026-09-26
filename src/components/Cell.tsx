"use client";

import { Cell as CellType } from "@/types/games";

type CellProps = {
    cell: CellType;
    isSuggested?: boolean;
    onClick: () => void;
    onRightClick: () => void;
};

export default function Cell({
    cell,
    isSuggested,
    onClick,
    onRightClick,
}: CellProps) {
    function handleRightClick(
        event: React.MouseEvent<HTMLButtonElement>
    ) {
        event.preventDefault();
        onRightClick();
    }

    return (
        <button
            onClick={onClick}
            onContextMenu={handleRightClick}
            className={`h-10 w-10 border border-gray-400 text-lg font-bold ${cell.isRevealed
                    ? "bg-gray-100 text-black"
                    : "bg-white text-black"
                } ${isSuggested
                    ? "ring-4 ring-purple-500"
                    : ""
                }`}
        >
            {cell.isRevealed
                ? cell.isMine
                    ? "💣"
                    : cell.adjacentMines > 0
                        ? cell.adjacentMines
                        : ""
                : cell.isFlagged
                    ? "🚩"
                    : ""}
        </button>
    );
}