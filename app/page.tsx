import Board from "@/components/Board";
import { createBoard } from "@/game/boards";

export default function Home() {
  const board = createBoard();

  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-white px-4 py-10 sm:py-16 text-neutral-900">
      {/* Header */}
      <header className="flex flex-col items-center text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-950">
          Think. Deduce. Survive.
        </h1>
        <p className="mt-2 text-sm sm:text-base font-normal text-neutral-500 tracking-normal">
          An AI-powered Minesweeper experiment
        </p>
      </header>

      {/* Main Board & Controls */}
      <Board board={board} />
    </main>
  );
}