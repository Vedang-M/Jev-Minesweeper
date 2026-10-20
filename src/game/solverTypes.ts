import { Board } from "@/types/games";

export type MoveRecommendation = {
    row: number;
    col: number;
    type: "safe" | "mine" | "guess";
    isGuaranteed: boolean;
    reason: string;
};

export type SolverResponse = {
    recommendations: MoveRecommendation[];
    hasContradiction?: boolean;
};

export interface Solver {
    solve(board: Board): SolverResponse;
}