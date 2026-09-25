import Board from "@/components/Board";
import { createBoard } from "@/game/boards";

export default function Home() {
  const board = createBoard();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white">
      <h1 className="text-3xl font-bold">Minesweeper</h1>

      <Board board={board} />
    </main>
  );
}