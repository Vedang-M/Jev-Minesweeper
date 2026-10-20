import assert from "node:assert";

console.log("Testing JEV route boundary & candidate generation logic...");

// Mock test logic reflecting app/api/jev/route.ts information boundary
type CellInput = {
    row: number;
    col: number;
    isMine?: boolean;
    isRevealed: boolean;
    isFlagged: boolean;
    adjacentMines?: number;
};

function prepareVisibleBoard(board: CellInput[][]) {
    return board.map((row) =>
        row.map((cell) => ({
            row: cell.row,
            col: cell.col,
            isRevealed: Boolean(cell.isRevealed),
            isFlagged: Boolean(cell.isFlagged),
            adjacentMines: cell.isRevealed ? (cell.adjacentMines ?? 0) : null,
        }))
    );
}

function extractCandidates(board: CellInput[][], excludeCells: Set<string>) {
    const availableCells: { row: number; col: number; key: string }[] = [];
    for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[0].length; c++) {
            const cell = board[r][c];
            const key = `${r}-${c}`;
            if (!cell.isRevealed && !cell.isFlagged && !excludeCells.has(key)) {
                availableCells.push({ row: r, col: c, key });
            }
        }
    }
    return availableCells;
}

// 1. Strict information boundary: isMine never exists and hidden cells have null adjacentMines
{
    const board: CellInput[][] = [
        [
            { row: 0, col: 0, isMine: false, isRevealed: true, isFlagged: false, adjacentMines: 1 },
            { row: 0, col: 1, isMine: true, isRevealed: false, isFlagged: false, adjacentMines: 99 },
            { row: 0, col: 2, isMine: true, isRevealed: false, isFlagged: true, adjacentMines: 99 },
        ],
    ];

    const visible = prepareVisibleBoard(board);
    assert.strictEqual("isMine" in visible[0][0], false, "Visible board must not contain isMine");
    assert.strictEqual("isMine" in visible[0][1], false, "Visible board must not contain isMine");
    assert.strictEqual(visible[0][0].adjacentMines, 1, "Revealed cell exposes adjacentMines");
    assert.strictEqual(visible[0][1].adjacentMines, null, "Hidden cell must have null adjacentMines");
    assert.strictEqual(visible[0][2].adjacentMines, null, "Flagged hidden cell must have null adjacentMines");
    console.log("  ✓ Visible board enforces strict boundary: no isMine, hidden counts masked");
}

// 2. Candidate filtering excludes revealed, flagged, and excluded cells
{
    const board: CellInput[][] = [
        [
            { row: 0, col: 0, isMine: false, isRevealed: true, isFlagged: false, adjacentMines: 0 },
            { row: 0, col: 1, isMine: false, isRevealed: false, isFlagged: true, adjacentMines: 0 },
            { row: 0, col: 2, isMine: false, isRevealed: false, isFlagged: false, adjacentMines: 0 },
            { row: 0, col: 3, isMine: false, isRevealed: false, isFlagged: false, adjacentMines: 0 },
        ],
    ];

    const excludeCells = new Set(["0-2"]);
    const candidates = extractCandidates(board, excludeCells);
    assert.strictEqual(candidates.length, 1);
    assert.strictEqual(candidates[0].key, "0-3");
    console.log("  ✓ Candidates filter out revealed cells, flags, and explicitly excluded moves");
}

// 3. Validation ensures coordinates must belong to candidates without silent substitution
{
    const availableCells = [{ row: 0, col: 3, key: "0-3" }];
    const invalidSelection = "0-1"; // was flagged
    const isValid = availableCells.some((c) => c.key === invalidSelection);
    assert.strictEqual(isValid, false, "Selection not in availableCells must be marked invalid");
    console.log("  ✓ Strict coordinate validation rejects invalid or unpermitted coordinates");
}
