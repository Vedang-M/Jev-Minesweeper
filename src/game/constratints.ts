import { Board } from "@/types/games";

export type Constraint = {
    cells: string[];
    mines: number;
};

export function extractConstraints(
    board: Board
): Constraint[] {
    const constraints: Constraint[] = [];

    for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[row].length; col++) {
            const cell = board[row][col];

            if (!cell.isRevealed || cell.adjacentMines === 0) {
                continue;
            }

            const neighbors = getNeighbors(
                board,
                row,
                col
            );

            const unknownCells = neighbors.filter(
                (neighbor) =>
                    !neighbor.isRevealed &&
                    !neighbor.isFlagged
            );

            const flaggedMines = neighbors.filter(
                (neighbor) => neighbor.isFlagged
            );

            const remainingMines =
                cell.adjacentMines -
                flaggedMines.length;

            if (unknownCells.length === 0) {
                continue;
            }

            constraints.push({
                cells: unknownCells.map(
                    (neighbor) =>
                        `${neighbor.row}-${neighbor.col}`
                ),
                mines: remainingMines,
            });
        }
    }

    return constraints;
}

function getNeighbors(
    board: Board,
    row: number,
    col: number
) {
    const neighbors = [];

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;

            const newRow = row + dr;
            const newCol = col + dc;

            if (
                newRow >= 0 &&
                newRow < board.length &&
                newCol >= 0 &&
                newCol < board[0].length
            ) {
                neighbors.push(
                    board[newRow][newCol]
                );
            }
        }
    }

    return neighbors;
}