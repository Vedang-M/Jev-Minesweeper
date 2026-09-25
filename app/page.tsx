import { createBoard } from "@/game/boards";

export default function Home() {
  const board = createBoard();
  return <h1>Minesweeper</h1>;
}