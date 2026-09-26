import Board from "@/components/Board";
import { createBoard } from "@/game/boards";

export default function Home() {
  const board = createBoard();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white">
      <h1 className="text-5xl font-extrabold tracking-tight text-black">
        MineMind
      </h1>

      <p className="mt-2 text-lg text-gray-500">
        Think. Deduce. Survive.
      </p>

      <Board board={board} />
    </main>
  );
}