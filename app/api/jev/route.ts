import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const availableCells = body.state
            .flat()
            .filter(
                (cell: {
                    isRevealed: boolean;
                    isFlagged: boolean;
                }) => !cell.isRevealed && !cell.isFlagged
            )
            .map(
                (cell: {
                    row: number;
                    col: number;
                }) => `${cell.row}-${cell.col}`
            );

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
                    state: body.state,

                    questions: {
                        move: {
                            type: "choice",
                            instructions:
                                "Choose the single best unrevealed cell to reveal next. Choose exactly one cell from the available cells.",
                            criteria: Object.fromEntries(
                                availableCells.map((cell: string) => [
                                    cell,
                                    `Reveal cell ${cell}.`,
                                ])
                            ),
                        },
                    },
                }),
            }
        );

        const data = await response.json();

        console.log("JEV response:", data);

        return NextResponse.json(data, {
            status: response.status,
        });
    } catch (error) {
        console.error("JEV error:", error);

        return NextResponse.json(
            { error: "JEV request failed" },
            { status: 500 }
        );
    }
}