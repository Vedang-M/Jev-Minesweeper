import { Board } from "@/types/games";
import {
    Solver,
    MoveRecommendation,
} from "./solverTypes";

export class JevSolver implements Solver {
    solve(board: Board): MoveRecommendation[] {
        // JEV reasoning will be implemented here.
        return [];
    }
}