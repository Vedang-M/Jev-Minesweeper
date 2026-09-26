import { Board } from "@/types/games";

export type SuggestedMove = {
    row: number;
    col: number;
    reason: string;
};

export function findSafeMoves(
    board: Board
): SuggestedMove[] {
    const safeMoves: SuggestedMove[] = [];

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

            const flaggedMines = neighbors.filter(
                (neighbor) => neighbor.isFlagged
            );

            const unknownCells = neighbors.filter(
                (neighbor) =>
                    !neighbor.isRevealed &&
                    !neighbor.isFlagged
            );

            /*
             * If the number of flagged mines around this
             * cell equals its adjacent mine count,
             * every other unknown neighbor is safe.
             */
            if (
                flaggedMines.length ===
                cell.adjacentMines
            ) {
                for (const unknown of unknownCells) {
                    safeMoves.push({
                        row: unknown.row,
                        col: unknown.col,
                        reason:
                            "All mines around this number are already flagged.",
                    });
                }
            }
        }
    }

    return safeMoves;
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