import { Cell as CellType } from "@/types/games";

type CellProps = {
    cell: CellType;
};

export default function Cell({ cell }: CellProps) {
    return (
        <button
            className="h-10 w-10 border border-gray-400 bg-white text-lg font-bold text-black"
        >
            {cell.isMine ? "💣" : cell.adjacentMines}
        </button>
    );
}