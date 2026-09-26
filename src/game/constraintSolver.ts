import { Constraint } from "./constraints";

export type SolverResult = {
    safeCells: string[];
    mineCells: string[];
};

function subtractConstraints(
    first: Constraint,
    second: Constraint
): Constraint | null {
    const firstCells = new Set(first.cells);
    const secondCells = new Set(second.cells);

    const firstIsSubset = first.cells.every((cell) =>
        secondCells.has(cell)
    );

    if (!firstIsSubset) {
        return null;
    }

    const remainingCells = second.cells.filter(
        (cell) => !firstCells.has(cell)
    );

    const remainingMines =
        second.mines - first.mines;

    if (
        remainingCells.length === 0 ||
        remainingMines < 0 ||
        remainingMines > remainingCells.length
    ) {
        return null;
    }

    return {
        cells: remainingCells,
        mines: remainingMines,
    };
}

export function solveConstraints(
    constraints: Constraint[]
): SolverResult {
    const safeCells = new Set<string>();
    const mineCells = new Set<string>();

    const allConstraints = [...constraints];

    let changed = true;

    while (changed) {
        changed = false;

        // Generate new constraints by comparing
        // overlapping existing constraints.
        for (let i = 0; i < allConstraints.length; i++) {
            for (let j = 0; j < allConstraints.length; j++) {
                if (i === j) continue;

                const newConstraint = subtractConstraints(
                    allConstraints[i],
                    allConstraints[j]
                );

                if (!newConstraint) continue;

                const alreadyExists = allConstraints.some(
                    (constraint) =>
                        constraint.mines ===
                        newConstraint.mines &&
                        constraint.cells.length ===
                        newConstraint.cells.length &&
                        constraint.cells.every((cell) =>
                            newConstraint.cells.includes(cell)
                        )
                );

                if (!alreadyExists) {
                    allConstraints.push(newConstraint);
                    changed = true;
                }
            }
        }

        // Analyze every known constraint.
        for (const constraint of allConstraints) {
            const unknownCells = constraint.cells.filter(
                (cell) =>
                    !safeCells.has(cell) &&
                    !mineCells.has(cell)
            );

            const knownMines = constraint.cells.filter(
                (cell) => mineCells.has(cell)
            ).length;

            const remainingMines =
                constraint.mines - knownMines;

            // No mines remain in these cells.
            if (remainingMines === 0) {
                for (const cell of unknownCells) {
                    if (!safeCells.has(cell)) {
                        safeCells.add(cell);
                        changed = true;
                    }
                }
            }

            // Every remaining cell must be a mine.
            if (
                remainingMines ===
                unknownCells.length &&
                unknownCells.length > 0
            ) {
                for (const cell of unknownCells) {
                    if (!mineCells.has(cell)) {
                        mineCells.add(cell);
                        changed = true;
                    }
                }
            }
        }
    }

    return {
        safeCells: [...safeCells],
        mineCells: [...mineCells],
    };
}