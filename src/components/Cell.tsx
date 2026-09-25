import { Cell as CellType } from "@/types/games";

type CellProps = {
    cell: CellType;
    onClick: () => void;
    onRightClick: () => void;
};

export default function Cell({
    cell,
    onClick,
    onRightClick,
}: CellProps) {
    function handleRightClick(event: React.MouseEvent) {
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
                }`}
        >
            {cell.isRevealed
                ? cell.isMine
                    ? "💣"
                    : cell.adjacentMines
                : cell.isFlagged
                    ? "🚩"
                    : ""}
        </button>
    );
}