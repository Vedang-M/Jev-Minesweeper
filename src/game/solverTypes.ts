import { Board } from "@/types/games";

export type MoveRecommendation = {
    row: number;
    col: number;
    type: "safe" | "mine";
    reason: string;
};

export interface Solver {
    solve(board: Board): MoveRecommendation[];
}