import { Constraint } from "./constraints";

export type SolverResult = {
    safeCells: string[];
    mineCells: string[];
    hasContradiction?: boolean;
};

/**
 * Subtracts 'first' from 'second' if first.cells is a proper subset of second.cells.
 * E.g., if first is {A, B} = 1 and second is {A, B, C} = 2,
 * then {C} = 1.
 */
function subtractConstraints(
    first: Constraint,
    second: Constraint
): { constraint: Constraint | null; contradiction: boolean } {
    const firstCells = new Set(first.cells);
    const secondCells = new Set(second.cells);

    const firstIsSubset = first.cells.every((cell) =>
        secondCells.has(cell)
    );

    if (!firstIsSubset) {
        return { constraint: null, contradiction: false };
    }

    const remainingCells = second.cells.filter(
        (cell) => !firstCells.has(cell)
    );

    const remainingMines = second.mines - first.mines;

    if (remainingMines < 0 || remainingMines > remainingCells.length) {
        return { constraint: null, contradiction: true };
    }

    if (remainingCells.length === 0) {
        // Equal cell sets but different mine counts => contradiction
        if (remainingMines !== 0) {
            return { constraint: null, contradiction: true };
        }
        return { constraint: null, contradiction: false };
    }

    return {
        constraint: {
            cells: remainingCells,
            mines: remainingMines,
        },
        contradiction: false,
    };
}

export function solveConstraints(
    constraints: Constraint[]
): SolverResult {
    const safeCells = new Set<string>();
    const mineCells = new Set<string>();

    // Clean initial constraints: remove empty or invalid
    const allConstraints: Constraint[] = [];
    for (const c of constraints) {
        if (c.mines < 0 || c.mines > c.cells.length) {
            return {
                safeCells: [],
                mineCells: [],
                hasContradiction: true,
            };
        }
        allConstraints.push({
            cells: [...c.cells],
            mines: c.mines,
        });
    }

    let changed = true;
    let hasContradiction = false;

    while (changed) {
        changed = false;

        // 1. Direct deductions from current constraints
        for (const constraint of allConstraints) {
            // Filter out cells already known to be safe or mines
            const unknownCells = constraint.cells.filter(
                (cell) => !safeCells.has(cell) && !mineCells.has(cell)
            );

            const knownMines = constraint.cells.filter((cell) =>
                mineCells.has(cell)
            ).length;

            const remainingMines = constraint.mines - knownMines;

            // Check validity
            if (remainingMines < 0 || remainingMines > unknownCells.length) {
                hasContradiction = true;
                return {
                    safeCells: [...safeCells],
                    mineCells: [...mineCells],
                    hasContradiction: true,
                };
            }

            // If remainingMines === 0, all unknownCells are safe
            if (remainingMines === 0 && unknownCells.length > 0) {
                for (const cell of unknownCells) {
                    if (!safeCells.has(cell)) {
                        safeCells.add(cell);
                        changed = true;
                    }
                }
            }

            // If remainingMines === unknownCells.length, all unknownCells are mines
            if (remainingMines === unknownCells.length && unknownCells.length > 0) {
                for (const cell of unknownCells) {
                    if (!mineCells.has(cell)) {
                        mineCells.add(cell);
                        changed = true;
                    }
                }
            }
        }

        // 2. Pairwise subset reduction
        // Compare every pair to derive new smaller constraints
        const newDerived: Constraint[] = [];
        for (let i = 0; i < allConstraints.length; i++) {
            for (let j = 0; j < allConstraints.length; j++) {
                if (i === j) continue;

                // Normalize constraints based on known safe and mine cells
                const c1Unknown = allConstraints[i].cells.filter(
                    (c) => !safeCells.has(c) && !mineCells.has(c)
                );
                const c1Mines =
                    allConstraints[i].mines -
                    allConstraints[i].cells.filter((c) => mineCells.has(c)).length;

                const c2Unknown = allConstraints[j].cells.filter(
                    (c) => !safeCells.has(c) && !mineCells.has(c)
                );
                const c2Mines =
                    allConstraints[j].mines -
                    allConstraints[j].cells.filter((c) => mineCells.has(c)).length;

                if (c1Unknown.length === 0 || c2Unknown.length === 0) continue;

                const subResult = subtractConstraints(
                    { cells: c1Unknown, mines: c1Mines },
                    { cells: c2Unknown, mines: c2Mines }
                );

                if (subResult.contradiction) {
                    return {
                        safeCells: [...safeCells],
                        mineCells: [...mineCells],
                        hasContradiction: true,
                    };
                }

                if (subResult.constraint) {
                    const newC = subResult.constraint;
                    const exists = allConstraints.some(
                        (existing) =>
                            existing.mines === newC.mines &&
                            existing.cells.length === newC.cells.length &&
                            existing.cells.every((cell) => newC.cells.includes(cell))
                    ) || newDerived.some(
                        (existing) =>
                            existing.mines === newC.mines &&
                            existing.cells.length === newC.cells.length &&
                            existing.cells.every((cell) => newC.cells.includes(cell))
                    );

                    if (!exists) {
                        newDerived.push(newC);
                        changed = true;
                    }
                }
            }
        }

        if (newDerived.length > 0) {
            allConstraints.push(...newDerived);
        }
    }

    return {
        safeCells: [...safeCells],
        mineCells: [...mineCells],
        hasContradiction,
    };
}