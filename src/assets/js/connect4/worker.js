// Runs the Connect 4 AI off the main thread, so the page never freezes while it thinks.
// Message in:  { moves: number[], firstPlayer: 1 | 2, level: "easy" | ... }
// Message out: { col, depth, nodes, ms }
import { Board, Engine } from "./engine.js";

// One engine for the whole visit, so its transposition table is reused between moves.
const engine = new Engine();

self.onmessage = (event) => {
  const { moves, firstPlayer, level } = event.data;
  const start = Date.now();
  const board = Board.fromMoves(moves, firstPlayer);
  const result = engine.chooseMove(board, level);
  self.postMessage({ ...result, ms: Date.now() - start });
};
