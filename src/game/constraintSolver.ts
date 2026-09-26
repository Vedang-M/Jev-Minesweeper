export function solveConstraints(
    constraints: Constraint[]
): SolverResult {
    const safeCells = new Set<string>();
    const mineCells = new Set<string>();

    let changed = true;

    while (changed) {
        changed = false;

        for (const constraint of constraints) {
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

            // All remaining cells are safe
            if (remainingMines === 0) {
                for (const cell of unknownCells) {
                    if (!safeCells.has(cell)) {
                        safeCells.add(cell);
                        changed = true;
                    }
                }
            }

            // All remaining cells are mines
            if (
                remainingMines === unknownCells.length &&
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