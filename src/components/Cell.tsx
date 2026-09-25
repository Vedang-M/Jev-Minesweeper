import { Cell as CellType } from "@/types/games";

type CellProps = {
    cell: CellType;
    onClick: () => void;
};

export default function Cell({ cell, onClick }: CellProps) {
    return (
        <button
            onClick={onClick}
            className={`h-10 w-10 border border-gray-400 text-lg font-bold ${cell.isRevealed ? "bg-gray-100 text-black" : "bg-white text-black"
                }`}
        >
            {cell.isRevealed
                ? cell.isMine
                    ? "💣"
                    : cell.adjacentMines
                : ""}
        </button>
    );
}