// Connect 4 rules and AI, ported from the Java project
// (https://github.com/SergioSimental/Connect4-AI).
//
// The AI is a negamax search with alpha-beta pruning, center-first move ordering, a
// transposition table and iterative deepening, with four difficulty levels. It runs in a
// Web Worker (worker.js) so the page stays responsive while it thinks.
//
// The Java version stores the board as bits in 64-bit numbers. JavaScript's bitwise
// operators only work on 32-bit numbers, so this version keeps the board in a small array
// and identifies positions with Zobrist hash keys instead. The search itself is the same.
//
// Unlike the Java version, there is no perfect solver here, so the strongest level is
// called Expert rather than Impossible: it can be beaten.

export const ROWS = 6;
export const COLS = 7;
export const CELLS = ROWS * COLS;

// Players: 1 = you (blue), 2 = the computer (red). 0 = empty cell.
export const HUMAN = 1;
export const AI = 2;

const WIN_SCORE = 1_000_000;
const WIN_THRESHOLD = WIN_SCORE - 1000;
const INF = 1 << 30;

// Columns from the center outwards. Center moves are usually strongest, and alpha-beta
// prunes far more when good moves are tried first.
const CENTER_FIRST = [3, 2, 4, 1, 5, 0, 6];

//  label         max depth  time (ms)  random moves  score noise  opening book
export const LEVELS = {
  easy:       { label: "Easy",       maxDepth: 2,     timeMs: 1000, randomMoveChance: 0.3, scoreNoise: 40, openingBook: false },
  medium:     { label: "Medium",     maxDepth: 4,     timeMs: 1000, randomMoveChance: 0,   scoreNoise: 25, openingBook: false },
  hard:       { label: "Hard",       maxDepth: 10,    timeMs: 1000, randomMoveChance: 0,   scoreNoise: 0,  openingBook: true },
  expert:     { label: "Expert",     maxDepth: CELLS, timeMs: 2000, randomMoveChance: 0,   scoreNoise: 0,  openingBook: true },
};

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

// Cell index for a column and a row counted from the bottom.
export const cellIndex = (col, row) => col * ROWS + row;

// Small deterministic random number generator (mulberry32), so the Zobrist keys are the
// same on every run and tests can use fixed seeds.
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Zobrist hashing: a random number for every (cell, player). A position's key is the XOR
// of the numbers for its pieces, updated with one XOR per move. Two independent 32-bit
// keys: one picks the table slot, the other checks it's really the same position.
const ZOBRIST_A = new Int32Array(CELLS * 3);
const ZOBRIST_B = new Int32Array(CELLS * 3);
const SIDE_A = 0x3c6ef372 | 0;
const SIDE_B = 0x1b873593 | 0;
{
  const rand = seededRandom(20261127);
  for (let i = 0; i < ZOBRIST_A.length; i++) {
    ZOBRIST_A[i] = (rand() * 4294967296) | 0;
    ZOBRIST_B[i] = (rand() * 4294967296) | 0;
  }
}

// Every line of four cells on the board (69 of them), four cell indexes each.
export const WINDOWS = (() => {
  const list = [];
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]]; // [dCol, dRow]
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      for (const [dc, dr] of dirs) {
        const endC = c + 3 * dc;
        const endR = r + 3 * dr;
        if (endC < 0 || endC >= COLS || endR < 0 || endR >= ROWS) continue;
        for (let k = 0; k < 4; k++) list.push(cellIndex(c + k * dc, r + k * dr));
      }
    }
  }
  return Int8Array.from(list);
})();

export class Board {
  constructor(firstPlayer = HUMAN) {
    this.cells = new Int8Array(CELLS);
    this.heights = new Int8Array(COLS);
    this.moves = 0;
    this.toMove = firstPlayer;
    this.keyA = 0;
    this.keyB = 0;
  }

  static fromMoves(columns, firstPlayer = HUMAN) {
    const b = new Board(firstPlayer);
    for (const col of columns) {
      if (!b.canPlay(col)) throw new Error(`Column ${col} is full`);
      b.play(col);
    }
    return b;
  }

  clone() {
    const b = new Board(this.toMove);
    b.cells.set(this.cells);
    b.heights.set(this.heights);
    b.moves = this.moves;
    b.keyA = this.keyA;
    b.keyB = this.keyB;
    return b;
  }

  canPlay(col) {
    return this.heights[col] < ROWS;
  }

  isFull() {
    return this.moves === CELLS;
  }

  // Drops a piece for the player to move. Returns the row it landed in.
  play(col) {
    const row = this.heights[col]++;
    const i = cellIndex(col, row);
    const z = i * 3 + this.toMove;
    this.cells[i] = this.toMove;
    this.keyA ^= ZOBRIST_A[z] ^ SIDE_A;
    this.keyB ^= ZOBRIST_B[z] ^ SIDE_B;
    this.toMove = 3 - this.toMove;
    this.moves++;
    return row;
  }

  undo(col) {
    const row = --this.heights[col];
    const i = cellIndex(col, row);
    this.toMove = 3 - this.toMove;
    const z = i * 3 + this.toMove;
    this.cells[i] = 0;
    this.keyA ^= ZOBRIST_A[z] ^ SIDE_A;
    this.keyB ^= ZOBRIST_B[z] ^ SIDE_B;
    this.moves--;
  }

  // True if `player` would make four in a row by dropping a piece in `col`.
  // Counts matching pieces outward from the landing cell in each of the 4 directions.
  wouldWin(col, player = this.toMove) {
    const row = this.heights[col];
    if (row >= ROWS) return false;
    const cells = this.cells;
    // vertical: only downwards can have pieces
    if (row >= 3 &&
        cells[cellIndex(col, row - 1)] === player &&
        cells[cellIndex(col, row - 2)] === player &&
        cells[cellIndex(col, row - 3)] === player) return true;
    for (let d = 0; d < 3; d++) {
      const dr = d - 1; // -1, 0, 1: falling diagonal, horizontal, rising diagonal
      let count = 0;
      for (let c = col - 1, r = row - dr; c >= 0 && r >= 0 && r < ROWS && cells[cellIndex(c, r)] === player; c--, r -= dr) count++;
      for (let c = col + 1, r = row + dr; c < COLS && r >= 0 && r < ROWS && cells[cellIndex(c, r)] === player; c++, r += dr) count++;
      if (count >= 3) return true;
    }
    return false;
  }

  // The four winning cells if someone has four in a row, otherwise null.
  winningLine() {
    for (let w = 0; w < WINDOWS.length; w += 4) {
      const p = this.cells[WINDOWS[w]];
      if (p !== 0 && p === this.cells[WINDOWS[w + 1]] && p === this.cells[WINDOWS[w + 2]] && p === this.cells[WINDOWS[w + 3]]) {
        return { player: p, cells: [WINDOWS[w], WINDOWS[w + 1], WINDOWS[w + 2], WINDOWS[w + 3]] };
      }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

// Thrown to stop a search pass when time runs out.
class TimeUp extends Error {}

const EXACT = 0;
const LOWER = 1; // real score is at least the stored one
const UPPER = 2; // real score is at most the stored one

// ORDERS[c + 1] = CENTER_FIRST with column c moved to the front (ORDERS[0] = unchanged).
const ORDERS = [CENTER_FIRST, ...CENTER_FIRST.map((first) => [first, ...CENTER_FIRST.filter((c) => c !== first)])];
const orderFor = (first) => ORDERS[first + 1];

export class Engine {
  // tableBits: the transposition table holds 2^tableBits positions (2^19 is about 6 MB).
  constructor({ random = Math.random, tableBits = 19 } = {}) {
    this.random = random;
    this.tableMask = (1 << tableBits) - 1;
    const size = 1 << tableBits;
    this.ttCheck = new Int32Array(size);
    this.ttScore = new Int32Array(size);
    this.ttDepth = new Int8Array(size).fill(-1); // -1 = empty slot
    this.ttFlag = new Int8Array(size);
    this.ttMove = new Int8Array(size);
    this.nodes = 0;
    this.deadline = Infinity;
    this.lastDepth = 0;
  }

  // Picks a column for the player to move. `level` is a key of LEVELS.
  // Returns { col, depth, nodes }.
  chooseMove(board, level = "hard") {
    const settings = LEVELS[level];
    if (!settings) throw new Error(`Unknown level: ${level}`);
    // Work on a copy: the search plays and undoes moves on it, and a search stopped by the
    // time limit leaves moves on it.
    board = board.clone();
    this.nodes = 0;
    this.lastDepth = 0;
    const result = (col) => ({ col, depth: this.lastDepth, nodes: this.nodes });

    // Every level takes a win and blocks an immediate loss, so even Easy doesn't feel broken.
    const win = CENTER_FIRST.find((c) => board.canPlay(c) && board.wouldWin(c));
    if (win !== undefined) return result(win);

    if (this.random() < settings.randomMoveChance) {
      const block = CENTER_FIRST.find((c) => board.canPlay(c) && board.wouldWin(c, 3 - board.toMove));
      if (block !== undefined) return result(block);
      const playable = CENTER_FIRST.filter((c) => board.canPlay(c));
      return result(playable[Math.floor(this.random() * playable.length)]);
    }

    const depth = Math.min(settings.maxDepth, CELLS - board.moves);
    if (settings.scoreNoise > 0) {
      return result(this.noisyChoice(board, depth, settings.scoreNoise, settings.timeMs));
    }
    // Connect 4 is solved: the first player can force a win only by starting in the center.
    if (settings.openingBook && board.moves === 0) return result(3);
    return result(this.bestMove(board, depth, settings.timeMs));
  }

  // Iterative deepening: one move deeper each pass, until the depth or time limit.
  // Uses the best move from the deepest pass that finished.
  bestMove(board, maxDepth, timeMs) {
    this.deadline = Date.now() + timeMs;
    let best = CENTER_FIRST.find((c) => board.canPlay(c));
    for (let depth = 1; depth <= maxDepth; depth++) {
      try {
        const { col, score } = this.searchRoot(board, depth, best);
        best = col;
        this.lastDepth = depth;
        if (Math.abs(score) >= WIN_THRESHOLD) break; // a forced win or loss is proven
      } catch (e) {
        if (e instanceof TimeUp) break;
        throw e;
      }
    }
    return best;
  }

  searchRoot(board, depth, previousBest) {
    let alpha = -INF;
    let best = -INF;
    let bestCol = previousBest;
    for (const col of orderFor(previousBest)) {
      if (!board.canPlay(col)) continue;
      board.play(col);
      const value = -this.negamax(board, depth - 1, -INF, -alpha, 1);
      board.undo(col);
      if (value > best) {
        best = value;
        bestCol = col;
      }
      alpha = Math.max(alpha, value);
    }
    return { col: bestCol, score: best };
  }

  // Score of the position for the player to move, looking `depth` moves ahead.
  // `ply` = moves from the root, so faster wins score higher.
  negamax(board, depth, alpha, beta, ply) {
    if ((++this.nodes & 1023) === 0 && Date.now() > this.deadline) throw new TimeUp();
    if (board.isFull()) return 0;
    for (let col = 0; col < COLS; col++) {
      if (board.canPlay(col) && board.wouldWin(col)) return WIN_SCORE - (ply + 1);
    }
    if (depth === 0) return evaluate(board);

    // Transposition table
    const slot = board.keyA & this.tableMask;
    let ttMove = -1;
    if (this.ttDepth[slot] >= 0 && this.ttCheck[slot] === board.keyB) {
      ttMove = this.ttMove[slot];
      if (this.ttDepth[slot] >= depth) {
        const stored = fromTable(this.ttScore[slot], ply);
        const flag = this.ttFlag[slot];
        if (flag === EXACT) return stored;
        if (flag === LOWER) alpha = Math.max(alpha, stored);
        else beta = Math.min(beta, stored);
        if (alpha >= beta) return stored;
      }
    }

    const originalAlpha = alpha;
    let best = -INF;
    let bestCol = -1;
    for (const col of orderFor(ttMove)) {
      if (!board.canPlay(col)) continue;
      board.play(col);
      const value = -this.negamax(board, depth - 1, -beta, -alpha, ply + 1);
      board.undo(col);
      if (value > best) {
        best = value;
        bestCol = col;
      }
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }

    this.ttCheck[slot] = board.keyB;
    this.ttScore[slot] = toTable(best, ply);
    this.ttDepth[slot] = depth;
    this.ttFlag[slot] = best <= originalAlpha ? UPPER : best >= beta ? LOWER : EXACT;
    this.ttMove[slot] = bestCol;
    return best;
  }

  // Scores every move at a fixed depth, adds random noise up to +/- `noise`, and picks the
  // highest. Proven wins are always taken and proven losses avoided when possible, so the
  // randomness only chooses between reasonable moves.
  noisyChoice(board, depth, noise, timeMs) {
    this.deadline = Date.now() + timeMs;
    const untouched = board.clone(); // a search stopped by TimeUp leaves pieces on `board`
    const scores = new Array(COLS).fill(null);
    try {
      for (const col of CENTER_FIRST) {
        if (!board.canPlay(col)) continue;
        board.play(col);
        scores[col] = -this.negamax(board, depth - 1, -INF, INF, 1);
        board.undo(col);
        if (scores[col] >= WIN_THRESHOLD) {
          this.lastDepth = depth;
          return col;
        }
      }
    } catch (e) {
      if (!(e instanceof TimeUp)) throw e;
      return this.bestMove(untouched, depth, 100);
    }
    this.lastDepth = depth;
    const anyNotLosing = scores.some((s) => s !== null && s > -WIN_THRESHOLD);
    let bestCol = -1;
    let bestNoisy = -Infinity;
    for (const col of CENTER_FIRST) {
      const s = scores[col];
      if (s === null || (anyNotLosing && s <= -WIN_THRESHOLD)) continue;
      const noisy = s + Math.floor(this.random() * (2 * noise + 1)) - noise;
      if (noisy > bestNoisy) {
        bestNoisy = noisy;
        bestCol = col;
      }
    }
    return bestCol;
  }
}

// Win scores depend on distance from the root; the table stores them relative to the
// position itself so they stay right when it's reached at a different depth.
function toTable(score, ply) {
  if (score >= WIN_THRESHOLD) return score + ply;
  if (score <= -WIN_THRESHOLD) return score - ply;
  return score;
}

function fromTable(score, ply) {
  if (score >= WIN_THRESHOLD) return score - ply;
  if (score <= -WIN_THRESHOLD) return score + ply;
  return score;
}

const CENTER_COL = 3;

// Heuristic score for the player to move: every line of four holding only one player's
// pieces could still become a win for them. Opponent lines weigh slightly more.
export function evaluate(board) {
  const me = board.toMove;
  const cells = board.cells;
  let total = 0;
  for (let w = 0; w < WINDOWS.length; w += 4) {
    let mine = 0;
    let theirs = 0;
    for (let k = 0; k < 4; k++) {
      const p = cells[WINDOWS[w + k]];
      if (p === me) mine++;
      else if (p !== 0) theirs++;
    }
    if (mine > 0 && theirs > 0) continue;
    if (mine === 3) total += 50;
    else if (mine === 2) total += 10;
    else if (mine === 1) total += 1;
    else if (theirs === 3) total -= 60;
    else if (theirs === 2) total -= 12;
    else if (theirs === 1) total -= 1;
  }
  for (let r = 0; r < ROWS; r++) {
    const p = cells[cellIndex(CENTER_COL, r)];
    if (p === me) total += 3;
    else if (p !== 0) total -= 3;
  }
  return total;
}

// For tests: score of the position for the player to move at a fixed depth, no time limit.
export function scoreAtDepth(board, depth, engine = new Engine({ tableBits: 16 })) {
  engine.deadline = Infinity;
  return engine.negamax(board.clone(), depth, -INF, INF, 0);
}
