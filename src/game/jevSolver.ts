import { Board } from "@/types/games";
import {
    Solver,
    SolverResponse,
} from "./solverTypes";

export class JevSolver implements Solver {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    solve(_board: Board): SolverResponse {
        // JEV reasoning is performed via API calls in route /api/jev.
        return {
            recommendations: [],
            hasContradiction: false,
        };
    }
}