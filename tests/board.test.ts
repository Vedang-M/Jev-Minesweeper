import assert from "node:assert";
import {
    createBoard,
    createEmptyBoard,
    placeMines,
    calculateAdjacentMines,
    difficulties,
} from "../src/game/boards";

console.log("Testing board generation and mechanics...");

// 1. Difficulty dimensions & empty board creation
for (const diff of ["easy", "medium", "hard"] as const) {
    const config = difficulties[diff];
    const board = createBoard(diff);
    assert.strictEqual(board.length, config.rows, `${diff} row count mismatch`);
    assert.strictEqual(board[0].length, config.cols, `${diff} col count mismatch`);
    assert.strictEqual(
        board.flat().every((c) => !c.isRevealed && !c.isFlagged && !c.isMine && c.adjacentMines === 0),
        true,
        `${diff} empty board should have pristine unrevealed cells`
    );
}
console.log("  ✓ Empty boards generate with correct rows, cols, and initialized cells");

// 2. Safe first click mine placement
const rows = 9;
const cols = 9;
const mines = 10;
const safeRow = 4;
const safeCol = 4;

const emptyBoard = createEmptyBoard(rows, cols);
const minedBoard = placeMines(emptyBoard, rows, cols, mines, safeRow, safeCol);

const placedMinesCount = minedBoard.flat().filter((c) => c.isMine).length;
assert.strictEqual(placedMinesCount, mines, "Expected exact number of placed mines");
assert.strictEqual(minedBoard[safeRow][safeCol].isMine, false, "First click cell must never be a mine");
console.log("  ✓ Mine placement ensures first click cell is safe and exact mine count placed");

// 3. Adjacent mine counts
const numberedBoard = calculateAdjacentMines(minedBoard, rows, cols);
for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
        if (!numberedBoard[r][c].isMine) {
            let actualAdjacent = 0;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && numberedBoard[nr][nc].isMine) {
                        actualAdjacent++;
                    }
                }
            }
            assert.strictEqual(
                numberedBoard[r][c].adjacentMines,
                actualAdjacent,
                `Mismatch at (${r}, ${c})`
            );
        }
    }
}
console.log("  ✓ calculateAdjacentMines calculates exact neighbor mine count for all safe cells");
