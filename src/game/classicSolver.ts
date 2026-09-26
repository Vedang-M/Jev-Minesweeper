import { Board } from "@/types/games";
import { extractConstraints } from "./constraints";
import { solveConstraints } from "./constraintSolver";
import {
    Solver,
    MoveRecommendation,
} from "./solverTypes";

export class ClassicalSolver implements Solver {
    solve(board: Board): MoveRecommendation[] {
        const constraints = extractConstraints(board);
        const result = solveConstraints(constraints);

        const recommendations: MoveRecommendation[] = [];

        for (const cell of result.safeCells) {
            const [row, col] = cell.split("-").map(Number);

            recommendations.push({
                row,
                col,
                type: "safe",
                reason: "Constraint analysis proves this cell is safe.",
            });
        }

        for (const cell of result.mineCells) {
            const [row, col] = cell.split("-").map(Number);

            recommendations.push({
                row,
                col,
                type: "mine",
                reason: "Constraint analysis proves this cell is a mine.",
            });
        }

        return recommendations;
    }
}