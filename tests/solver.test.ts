import assert from "node:assert";
import { solveConstraints } from "../src/game/constraintSolver";
import { ClassicalSolver } from "../src/game/classicSolver";
import { Board } from "../src/types/games";

console.log("Testing constraint solver deductions...");

// 1. Guaranteed Safe Cell deduction: remainingMines = 0
{
    const constraints = [
        { cells: ["0-1", "0-2"], mines: 0 },
    ];
    const result = solveConstraints(constraints);
    assert.deepStrictEqual(result.safeCells.sort(), ["0-1", "0-2"]);
    assert.deepStrictEqual(result.mineCells, []);
    assert.strictEqual(result.hasContradiction, false);
    console.log("  ✓ remainingMines = 0 deduces all unknown cells as safe");
}

// 2. Guaranteed Mine deduction: remainingMines = unknownCells.length
{
    const constraints = [
        { cells: ["1-0", "1-1"], mines: 2 },
    ];
    const result = solveConstraints(constraints);
    assert.deepStrictEqual(result.mineCells.sort(), ["1-0", "1-1"]);
    assert.deepStrictEqual(result.safeCells, []);
    assert.strictEqual(result.hasContradiction, false);
    console.log("  ✓ remainingMines = unknownCells.length deduces all cells as mines");
}

// 3. Subset deduction (1-1 pattern and 1-2 pattern)
// Constraint A: {A, B} = 1
// Constraint B: {A, B, C} = 2
// Deduction: {C} = 1 (mine), and if another constraint {C, D} = 1, then D is safe!
{
    const constraints = [
        { cells: ["0-0", "0-1"], mines: 1 },
        { cells: ["0-0", "0-1", "0-2"], mines: 2 },
    ];
    const result = solveConstraints(constraints);
    assert.strictEqual(result.mineCells.includes("0-2"), true, "0-2 should be deduced as mine");
    assert.strictEqual(result.hasContradiction, false);
    console.log("  ✓ Subset deduction derived smaller constraint and deduced mine");
}

// 4. Subset deduction deriving safe cell
{
    const constraints = [
        { cells: ["0-0", "0-1"], mines: 1 },
        { cells: ["0-0", "0-1", "0-2"], mines: 1 },
    ];
    const result = solveConstraints(constraints);
    assert.strictEqual(result.safeCells.includes("0-2"), true, "0-2 should be deduced as safe");
    assert.strictEqual(result.hasContradiction, false);
    console.log("  ✓ Subset deduction derived safe cell");
}

// 5. Contradiction detection
{
    const contradictoryConstraints = [
        { cells: ["0-0", "0-1"], mines: 1 },
        { cells: ["0-0", "0-1"], mines: 2 },
    ];
    const result = solveConstraints(contradictoryConstraints);
    assert.strictEqual(result.hasContradiction, true, "Should flag contradiction for identical cells with conflicting counts");
    console.log("  ✓ Detects contradictory constraints");
}

// 6. Impossible mine count (e.g. mines > cells.length or mines < 0)
{
    const invalidConstraints = [
        { cells: ["0-0"], mines: 2 },
    ];
    const result = solveConstraints(invalidConstraints);
    assert.strictEqual(result.hasContradiction, true, "Should flag contradiction if mines > cells.length");
    console.log("  ✓ Detects impossible mine counts");
}

// 7. Ambiguous 50/50 state where no guaranteed safe move exists
{
    // A 3x3 board where center (1,1) is revealed '1' and has two unrevealed neighbors (0,1) and (2,1)
    const ambiguousBoard: Board = [
        [
            { row: 0, col: 0, isMine: false, isRevealed: true, isFlagged: false, adjacentMines: 0 },
            { row: 0, col: 1, isMine: false, isRevealed: false, isFlagged: false, adjacentMines: 0 },
            { row: 0, col: 2, isMine: false, isRevealed: true, isFlagged: false, adjacentMines: 0 },
        ],
        [
            { row: 1, col: 0, isMine: false, isRevealed: true, isFlagged: false, adjacentMines: 0 },
            { row: 1, col: 1, isMine: false, isRevealed: true, isFlagged: false, adjacentMines: 1 },
            { row: 1, col: 2, isMine: false, isRevealed: true, isFlagged: false, adjacentMines: 0 },
        ],
        [
            { row: 2, col: 0, isMine: false, isRevealed: true, isFlagged: false, adjacentMines: 0 },
            { row: 2, col: 1, isMine: false, isRevealed: false, isFlagged: false, adjacentMines: 0 },
            { row: 2, col: 2, isMine: false, isRevealed: true, isFlagged: false, adjacentMines: 0 },
        ],
    ];
    const solver = new ClassicalSolver();
    const response = solver.solve(ambiguousBoard);
    assert.strictEqual(response.recommendations.length, 0, "No guaranteed safe move should be returned");
    assert.strictEqual(response.hasContradiction, false);
    console.log("  ✓ Correctly reports uncertainty when no guaranteed safe move exists");
}

