import { NextResponse } from "next/server";

type Cell = {
    row: number;
    col: number;
    isMine: boolean;
    isRevealed: boolean;
    isFlagged: boolean;
    adjacentMines: number;
};

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const board = body.state as Cell[][];
        const excludeCells = new Set<string>(
            Array.isArray(body.excludeCells) ? body.excludeCells : []
        );

        if (!Array.isArray(board) || board.length === 0) {
            return NextResponse.json(
                { error: "Invalid board state" },
                { status: 400 }
            );
        }

        const rows = board.length;
        const cols = board[0].length;

        const availableCells = board
            .flat()
            .filter(
                (cell) =>
                    !cell.isRevealed &&
                    !cell.isFlagged &&
                    !excludeCells.has(`${cell.row}-${cell.col}`)
            )
            .map((cell) => ({
                row: cell.row,
                col: cell.col,
                key: `${cell.row}-${cell.col}`,
            }));

        if (availableCells.length === 0) {
            return NextResponse.json({
                error: "NO_NEW_MOVE",
            });
        }

        /*
         * IMPORTANT:
         * Never send isMine to JEV.
         *
         * Revealed cells expose their number.
         * Hidden cells expose no mine information.
         */
        const visibleBoard = board.map((row) =>
            row.map((cell) => ({
                row: cell.row,
                col: cell.col,
                isRevealed: cell.isRevealed,
                isFlagged: cell.isFlagged,
                adjacentMines: cell.isRevealed
                    ? cell.adjacentMines
                    : null,
            }))
        );

        /*
         * JEV has a maximum of 255 choices.
         *
         * Therefore we cannot give every Hard-level cell as a choice.
         * Instead, divide the decision into row and column.
         */
        const rowsWithMoves = [
            ...new Set(availableCells.map((cell) => cell.row)),
        ];

        const colsWithMoves = [
            ...new Set(availableCells.map((cell) => cell.col)),
        ];

        const questions = {
            row: {
                type: "choice",
                instructions:
                    "Choose the row containing the safest unrevealed cell according to the visible Minesweeper board.",
                criteria: Object.fromEntries(
                    rowsWithMoves.map((row) => [
                        String(row),
                        `Choose row ${row}.`,
                    ])
                ),
            },

            col: {
                type: "choice",
                instructions:
                    "Choose the column containing the safest unrevealed cell according to the visible Minesweeper board.",
                criteria: Object.fromEntries(
                    colsWithMoves.map((col) => [
                        String(col),
                        `Choose column ${col}.`,
                    ])
                ),
            },
        };

        const response = await fetch(
            "https://openrouter.ai/api/alpha/decisions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "~typesafe/jev-latest",
                    state: {
                        board: visibleBoard,
                        availableCells,
                    },
                    questions,
                }),
            }
        );

        const data = await response.json();

        console.log("JEV response:", data);

        if (!response.ok) {
            return NextResponse.json(data, {
                status: response.status,
            });
        }

        const selectedRow = Number(data.answers?.row?.choice);
        const selectedCol = Number(data.answers?.col?.choice);

        if (
            !Number.isInteger(selectedRow) ||
            !Number.isInteger(selectedCol)
        ) {
            return NextResponse.json({
                ...data,
                answers: {
                    ...data.answers,
                    move: null,
                },
            });
        }

        const selectedKey = `${selectedRow}-${selectedCol}`;

        /*
         * CRITICAL:
         *
         * Do NOT silently replace JEV's answer with another cell.
         *
         * If JEV chooses an invalid combination, record it as invalid.
         * Otherwise the experiment becomes contaminated because the
         * application is effectively making the decision for JEV.
         */
        const isValid = availableCells.some(
            (cell) => cell.key === selectedKey
        );

        const rowConfidence =
            typeof data.answers?.row?.confidence === "number"
                ? data.answers.row.confidence
                : null;

        const colConfidence =
            typeof data.answers?.col?.confidence === "number"
                ? data.answers.col.confidence
                : null;

        const confidence =
            rowConfidence !== null && colConfidence !== null
                ? rowConfidence * colConfidence
                : rowConfidence ?? colConfidence ?? null;

        return NextResponse.json({
            ...data,

            answers: {
                ...data.answers,

                move: isValid
                    ? {
                        choice: selectedKey,
                        confidence,
                        valid: true,
                    }
                    : {
                        choice: selectedKey,
                        confidence,
                        valid: false,
                    },
            },
        });
    } catch (error) {
        console.error("JEV error:", error);

        return NextResponse.json(
            {
                error: "JEV request failed",
            },
            {
                status: 500,
            }
        );
    }
}