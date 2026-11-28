// Tests for the Connect 4 engine. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AI, Board, CELLS, COLS, Engine, HUMAN, LEVELS, ROWS, WINDOWS, cellIndex, evaluate,
  scoreAtDepth, seededRandom,
} from "../src/assets/js/connect4/engine.js";

// Plays the columns in order, alternating players, `first` moving first.
const play = (first, ...cols) => Board.fromMoves(cols, first);

test("standard 7x6 board with 69 lines of four", () => {
  assert.equal(COLS, 7);
  assert.equal(ROWS, 6);
  assert.equal(WINDOWS.length / 4, 69);
});

test("pieces fall to the lowest empty cell and players alternate", () => {
  const b = new Board(HUMAN);
  assert.equal(b.play(3), 0);
  assert.equal(b.play(3), 1);
  assert.equal(b.cells[cellIndex(3, 0)], HUMAN);
  assert.equal(b.cells[cellIndex(3, 1)], AI);
  for (let i = 2; i < ROWS; i++) b.play(3);
  assert.equal(b.canPlay(3), false);
});

test("wins in all four directions", () => {
  // AI moves first in each of these.
  assert.equal(play(AI, 0, 6, 1, 6, 2, 6, 3).winningLine().player, AI); // horizontal
  assert.equal(play(AI, 0, 1, 0, 1, 0, 1, 0).winningLine().player, AI); // vertical
  assert.equal(play(AI, 0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3).winningLine().player, AI); // rising
  assert.equal(play(AI, 6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3).winningLine().player, AI); // falling
  assert.equal(play(AI, 0, 6, 1, 6, 2).winningLine(), null);
});

test("wouldWin agrees with a full board scan over many random games", () => {
  const rand = seededRandom(7);
  for (let game = 0; game < 1000; game++) {
    const b = new Board(game % 2 ? HUMAN : AI);
    while (!b.isFull() && !b.winningLine()) {
      for (let col = 0; col < COLS; col++) {
        if (!b.canPlay(col)) continue;
        const expected = (() => {
          const copy = b.clone();
          copy.play(col);
          return copy.winningLine() !== null;
        })();
        assert.equal(b.wouldWin(col), expected);
      }
      const playable = [...Array(COLS).keys()].filter((c) => b.canPlay(c));
      b.play(playable[Math.floor(rand() * playable.length)]);
    }
  }
});

test("undo restores the board and its hash key exactly", () => {
  const b = play(HUMAN, 3, 3, 2, 4);
  const before = b.clone();
  b.play(5);
  b.undo(5);
  assert.deepEqual([...b.cells], [...before.cells]);
  assert.equal(b.keyA, before.keyA);
  assert.equal(b.keyB, before.keyB);
  assert.equal(b.toMove, before.toMove);
});

test("search with the transposition table matches plain negamax exactly", () => {
  const rand = seededRandom(11);
  let checked = 0;
  while (checked < 60) {
    const b = new Board(rand() < 0.5 ? HUMAN : AI);
    const target = CELLS - (9 + Math.floor(rand() * 2));
    while (!b.isFull() && !b.winningLine() && b.moves < target) {
      const playable = [...Array(COLS).keys()].filter((c) => b.canPlay(c));
      b.play(playable[Math.floor(rand() * playable.length)]);
    }
    if (b.winningLine() || b.isFull()) continue;
    const depth = CELLS - b.moves;
    assert.equal(scoreAtDepth(b, depth, new Engine({ tableBits: 16 })), plainNegamax(b.clone(), depth, 0));
    checked++;
  }
});

// Reference search: no pruning, no ordering, no table.
function plainNegamax(b, depth, ply) {
  if (b.isFull()) return 0;
  for (let c = 0; c < COLS; c++) if (b.canPlay(c) && b.wouldWin(c)) return 1_000_000 - (ply + 1);
  if (depth === 0) return evaluate(b);
  let best = -Infinity;
  for (let c = 0; c < COLS; c++) {
    if (!b.canPlay(c)) continue;
    b.play(c);
    best = Math.max(best, -plainNegamax(b, depth - 1, ply + 1));
    b.undo(c);
  }
  return best;
}

test("every level takes a win and blocks an immediate loss", () => {
  const canWin = play(AI, 0, 6, 0, 6, 0, 5); // AI to move, wins in column 0
  const mustBlock = play(HUMAN, 6, 0, 6, 1, 6); // AI to move, human threatens column 6
  for (const level of Object.keys(LEVELS)) {
    const runs = LEVELS[level].randomMoveChance > 0 || LEVELS[level].scoreNoise > 0 ? 20 : 1;
    for (let seed = 0; seed < runs; seed++) {
      const engine = new Engine({ random: seededRandom(seed), tableBits: 16 });
      assert.equal(engine.chooseMove(canWin, level).col, 0, `${level} win, seed ${seed}`);
      assert.equal(engine.chooseMove(mustBlock, level).col, 6, `${level} block, seed ${seed}`);
    }
  }
});

test("Hard and Expert open in the center; Easy and Medium vary", () => {
  for (const level of ["hard", "expert"]) {
    assert.equal(new Engine({ tableBits: 16 }).chooseMove(new Board(AI), level).col, 3);
  }
  for (const level of ["easy", "medium"]) {
    const cols = new Set();
    for (let seed = 0; seed < 40; seed++) {
      cols.add(new Engine({ random: seededRandom(seed), tableBits: 16 }).chooseMove(new Board(AI), level).col);
    }
    assert.ok(cols.size >= 3, `${level} only opened in ${[...cols]}`);
  }
});

test("Hard searches deep quickly and stays within its limits", () => {
  const engine = new Engine();
  const start = Date.now();
  const { depth } = engine.chooseMove(play(AI, 3, 3), "hard");
  assert.ok(Date.now() - start < 1500);
  assert.ok(depth >= 8 && depth <= LEVELS.hard.maxDepth, `depth ${depth}`);
});

// Plays a full game; returns the winning player (0 for a draw).
function playGame(pick1, pick2, first = HUMAN) {
  const b = new Board(first);
  while (!b.isFull()) {
    const col = (b.toMove === HUMAN ? pick1 : pick2)(b);
    b.play(col);
    const line = b.winningLine();
    if (line) return line.player;
  }
  return 0;
}

test("each level beats the one below it in most games", () => {
  const ladder = [["medium", "easy"], ["hard", "medium"]];
  for (const [strong, weak] of ladder) {
    let wins = 0;
    const games = 12;
    for (let g = 0; g < games; g++) {
      const s = new Engine({ random: seededRandom(100 + g), tableBits: 18 });
      const w = new Engine({ random: seededRandom(200 + g), tableBits: 18 });
      const strongPlays = g % 2 ? HUMAN : AI;
      const pickStrong = (b) => s.chooseMove(b, strong).col;
      const pickWeak = (b) => w.chooseMove(b, weak).col;
      const winner = strongPlays === HUMAN
        ? playGame(pickStrong, pickWeak, g % 3 ? HUMAN : AI)
        : playGame(pickWeak, pickStrong, g % 3 ? HUMAN : AI);
      if (winner === strongPlays) wins++;
    }
    assert.ok(wins >= 9, `${strong} beat ${weak} only ${wins} of ${games}`);
  }
});

test("Easy beats a player who moves at random", () => {
  const rand = seededRandom(3);
  let wins = 0;
  for (let g = 0; g < 20; g++) {
    const e = new Engine({ random: seededRandom(g), tableBits: 16 });
    const randomPick = (b) => {
      const playable = [...Array(COLS).keys()].filter((c) => b.canPlay(c));
      return playable[Math.floor(rand() * playable.length)];
    };
    if (playGame(randomPick, (b) => e.chooseMove(b, "easy").col, g % 2 ? HUMAN : AI) === AI) wins++;
  }
  assert.ok(wins >= 18, `Easy won only ${wins} of 20`);
});
