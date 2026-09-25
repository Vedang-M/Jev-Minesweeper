import { Board, Cell } from "@/types/games";

export const rows = 9;
export const cols = 9;
export const mines = 10;


export function createEmptyBoard(): Board {
    return Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, col): Cell => ({
            row,
            col,
            isMine: false,
            isRevealed: false,
            isFlagged: false,
            adjacentMines: 0,
        }))
    );
}

export function placeMines(board: Board): Board {
    const positions = Array.from(
        { length: rows * cols },
        (_, index) => index
    );

    for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    for (let i = 0; i < mines; i++) {
        const position = positions[i];
        const row = Math.floor(position / cols);
        const col = position % cols;

        board[row][col].isMine = true;
    }

    return board;
}

function getNeighbors(row: number, col: number) {
    const neighbors: { row: number; col: number }[] = [];

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;

            const newRow = row + dr;
            const newCol = col + dc;

            if (
                newRow >= 0 &&
                newRow < rows &&
                newCol >= 0 &&
                newCol < cols
            ) {
                neighbors.push({
                    row: newRow,
                    col: newCol,
                });
            }
        }
    }

    return neighbors;
}

export function calculateAdjacentMines(board: Board): Board {
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (board[row][col].isMine) continue;

            const neighbors = getNeighbors(row, col);

            board[row][col].adjacentMines = neighbors.filter(
                ({ row: neighborRow, col: neighborCol }) =>
                    board[neighborRow][neighborCol].isMine
            ).length;
        }
    }

    return board;
}

export function createBoard(): Board {
    const board = createEmptyBoard();

    placeMines(board);
    calculateAdjacentMines(board);

    return board;
}

const board = createBoard();
