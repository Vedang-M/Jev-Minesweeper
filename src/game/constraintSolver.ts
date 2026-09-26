import { Constraint } from "./constraints";

export type SolverResult = {
    safeCells: string[];
    mineCells: string[];
};

export function solveConstraints(
    constraints: Constraint[]
): SolverResult {
    const safeCells = new Set<string>();
    const mineCells = new Set<string>();

    // Basic deductions
    for (const constraint of constraints) {
        if (constraint.mines === 0) {
            for (const cell of constraint.cells) {
                safeCells.add(cell);
            }
        }

        if (
            constraint.mines ===
            constraint.cells.length
        ) {
            for (const cell of constraint.cells) {
                mineCells.add(cell);
            }
        }
    }

    // Compare pairs of constraints
    for (let i = 0; i < constraints.length; i++) {
        for (let j = 0; j < constraints.length; j++) {
            if (i === j) continue;

            const first = constraints[i];
            const second = constraints[j];

            const firstCells = new Set(first.cells);
            const secondCells = new Set(second.cells);

            // Check whether first is a subset of second
            const isSubset = first.cells.every((cell) =>
                secondCells.has(cell)
            );

            if (!isSubset) continue;

            const remainingCells = second.cells.filter(
                (cell) => !firstCells.has(cell)
            );

            const remainingMines =
                second.mines - first.mines;

            if (remainingCells.length === 0) continue;

            // No mines in the remaining cells
            if (remainingMines === 0) {
                for (const cell of remainingCells) {
                    safeCells.add(cell);
                }
            }

            // Every remaining cell is a mine
            if (
                remainingMines ===
                remainingCells.length
            ) {
                for (const cell of remainingCells) {
                    mineCells.add(cell);
                }
            }
        }
    }

    return {
        safeCells: [...safeCells],
        mineCells: [...mineCells],
    };
}