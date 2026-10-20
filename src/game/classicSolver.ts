import { Board } from "@/types/games";
import { extractConstraints } from "./constraints";
import { solveConstraints } from "./constraintSolver";
import {
    Solver,
    MoveRecommendation,
    SolverResponse,
} from "./solverTypes";

export class ClassicalSolver implements Solver {
    solve(board: Board): SolverResponse {
        const constraints = extractConstraints(board);
        const result = solveConstraints(constraints);

        if (result.hasContradiction) {
            return {
                recommendations: [],
                hasContradiction: true,
            };
        }

        const recommendations: MoveRecommendation[] = [];

        for (const cell of result.safeCells) {
            const [row, col] = cell.split("-").map(Number);

            recommendations.push({
                row,
                col,
                type: "safe",
                isGuaranteed: true,
                reason: "Constraint analysis proves this cell is guaranteed safe.",
            });
        }

        for (const cell of result.mineCells) {
            const [row, col] = cell.split("-").map(Number);

            recommendations.push({
                row,
                col,
                type: "mine",
                isGuaranteed: true,
                reason: "Constraint analysis proves this cell is a guaranteed mine.",
            });
        }

        return {
            recommendations,
            hasContradiction: false,
        };
    }
}