import { Board as BoardType } from "@/types/games";
import Cell from "./Cell";

type BoardProps = {
    board: BoardType;
};

export default function Board({ board }: BoardProps) {
    return (
        <div className="inline-grid grid-cols-9">
            {board.flat().map((cell) => (
                <Cell
                    key={`${cell.row}-${cell.col}`}
                    cell={cell}
                />
            ))}
        </div>
    );
}