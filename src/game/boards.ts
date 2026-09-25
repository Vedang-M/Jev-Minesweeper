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