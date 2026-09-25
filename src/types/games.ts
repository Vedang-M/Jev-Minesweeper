export type Cell = {
    row: number;
    col: number;
    isMine: boolean;
    isRevealed: boolean;
    isFlagged: boolean;
    adjacentMines: number;

};

export type GameStatus = "Playing" | "Won" | "Lost";

export type Board = Cell[][];
