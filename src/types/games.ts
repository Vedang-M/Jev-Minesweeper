export type Cell = {
    row: number;
    col: number;
    isMine: boolean;
    isRevealed: boolean;
    isFlagged: boolean;
    adjacentMines: number;

};

export type GameStatus = "playing" | "won" | "lost";

export type Board = Cell[][];
