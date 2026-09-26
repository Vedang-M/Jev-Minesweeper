import { Board } from "@/types/games";
import { findSafeMoves } from "./solver";

const board: Board = [
    [
        {
            row: 0,
            col: 0,
            isMine: false,
            isRevealed: true,
            isFlagged: false,
            adjacentMines: 1,
        },
        {
            row: 0,
            col: 1,
            isMine: true,
            isRevealed: false,
            isFlagged: true,
            adjacentMines: 0,
        },
        {
            row: 0,
            col: 2,
            isMine: false,
            isRevealed: false,
            isFlagged: false,
            adjacentMines: 0,
        },
    ],
    [
        {
            row: 1,
            col: 0,
            isMine: false,
            isRevealed: false,
            isFlagged: false,
            adjacentMines: 0,
        },
        {
            row: 1,
            col: 1,
            isMine: false,
            isRevealed: true,
            isFlagged: false,
            adjacentMines: 1,
        },
        {
            row: 1,
            col: 2,
            isMine: false,
            isRevealed: false,
            isFlagged: false,
            adjacentMines: 0,
        },
    ],
];

const safeMoves = findSafeMoves(board);

console.log("Safe moves:", safeMoves);