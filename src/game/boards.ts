import { Board, Cell } from "@/types/games";

export type Difficulty = "easy" | "medium" | "hard";

export const difficulties = {
    easy: {
        rows: 9,
        cols: 9,
        mines: 10,
    },
    medium: {
        rows: 16,
        cols: 16,
        mines: 40,
    },
    hard: {
        rows: 16,
        cols: 30,
        mines: 99,
    },
};


export function createEmptyBoard(
    rows: number,
    cols: number
): Board {
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

export function placeMines(
    board: Board,
    rows: number,
    cols: number,
    mines: number
): Board {
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

function getNeighbors(
    row: number,
    col: number,
    rows: number,
    cols: number
) {
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

export function calculateAdjacentMines(
    board: Board,
    rows: number,
    cols: number
): Board {
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (board[row][col].isMine) continue;

            const neighbors = getNeighbors(row, col, rows, cols);

            board[row][col].adjacentMines = neighbors.filter(
                ({ row: neighborRow, col: neighborCol }) =>
                    board[neighborRow][neighborCol].isMine
            ).length;
        }
    }

    return board;
}

export function createBoard(
    difficulty: Difficulty = "easy"
): Board {
    const { rows, cols, mines } = difficulties[difficulty];

    const board = createEmptyBoard(rows, cols);

    placeMines(board, rows, cols, mines);
    calculateAdjacentMines(board, rows, cols);

    return board;
}

const board = createBoard();
