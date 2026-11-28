// Connect 4 page: draws the board, handles clicks and keys, and asks the AI (in a Web
// Worker) for its moves. The rules and the AI live in engine.js.
import { AI, Board, COLS, Engine, HUMAN, ROWS, cellIndex } from "./engine.js";

const boardEl = document.querySelector("[data-c4-board]");
const statusEl = document.querySelector("[data-c4-status]");
const newGameButton = document.querySelector("[data-c4-new]");

// The fast levels answer in a few milliseconds; a short pause makes the reply easier to follow.
const MIN_THINK_MS = 400;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let board;            // current position
let moves;            // columns played so far
let firstPlayer;      // who moved first in this game
let gameLevel;        // difficulty for this game; changing the setting applies to the next game
let gameOver = false;
let thinking = false;
let gameId = 0;       // ignores AI replies that arrive after a new game started
let focusedCol = 3;   // the column button that Tab lands on
let lastMove = null;  // { col, row } of the most recent piece, for the drop animation and marker
let winningCells = [];

// ---------------------------------------------------------------------------
// AI: a Web Worker when possible, otherwise the engine on the page itself.
// ---------------------------------------------------------------------------

let worker = null;
let fallbackEngine = null;

function startWorker() {
  try {
    worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    worker.onerror = () => {
      worker = null; // e.g. a browser without module workers: use the page instead
    };
  } catch {
    worker = null;
  }
}

function askAi(level) {
  const request = { moves: [...moves], firstPlayer, level };
  if (worker) {
    return new Promise((resolve, reject) => {
      worker.onmessage = (event) => resolve(event.data);
      worker.onerror = (event) => {
        worker = null;
        event.preventDefault();
        askAi(level).then(resolve, reject); // retry on the page
      };
      worker.postMessage(request);
    });
  }
  fallbackEngine ??= new Engine();
  // Give the page a moment to show "Thinking…" before the search blocks it.
  return new Promise((resolve) => setTimeout(() => {
    resolve(fallbackEngine.chooseMove(Board.fromMoves(request.moves, request.firstPlayer), level));
  }, 30));
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

const columnButtons = [];

function buildBoard() {
  boardEl.textContent = "";
  for (let col = 0; col < COLS; col++) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "c4__col";
    button.dataset.col = col;
    // Cells top to bottom, so they read naturally on screen.
    for (let row = ROWS - 1; row >= 0; row--) {
      const cell = document.createElement("span");
      cell.className = "c4__cell";
      cell.dataset.row = row;
      button.append(cell);
    }
    const number = document.createElement("span");
    number.className = "c4__num";
    number.textContent = col + 1;
    number.setAttribute("aria-hidden", "true");
    button.append(number);
    button.addEventListener("click", () => humanMove(col));
    button.addEventListener("keydown", onColumnKey);
    button.addEventListener("focus", () => setFocusedCol(col, false));
    boardEl.append(button);
    columnButtons.push(button);
  }
}

const NAMES = { [HUMAN]: "you", [AI]: "computer" };

function render() {
  const yourTurn = !gameOver && !thinking && board.toMove === HUMAN;
  boardEl.classList.toggle("c4__board--your-turn", yourTurn);
  boardEl.setAttribute("aria-busy", String(thinking));

  columnButtons.forEach((button, col) => {
    const height = board.heights[col];
    button.querySelectorAll(".c4__cell").forEach((cell) => {
      const row = Number(cell.dataset.row);
      const player = board.cells[cellIndex(col, row)];
      cell.className = "c4__cell";
      if (player) cell.classList.add(player === HUMAN ? "c4__cell--human" : "c4__cell--ai");
      if (!player && yourTurn && row === height) cell.classList.add("c4__cell--next");
      if (lastMove && lastMove.col === col && lastMove.row === row) {
        cell.classList.add("c4__cell--last");
        if (!reduceMotion.matches && lastMove.animate) {
          cell.style.setProperty("--fall", ROWS - row);
          cell.classList.add("c4__cell--drop");
        }
      }
      if (winningCells.includes(cellIndex(col, row))) cell.classList.add("c4__cell--win");
    });

    // Name read by screen readers, e.g. "Column 4: you, computer. 4 spaces left".
    const pieces = [];
    for (let row = 0; row < height; row++) pieces.push(NAMES[board.cells[cellIndex(col, row)]]);
    const contents = pieces.length ? `${pieces.join(", ")} (bottom to top)` : "empty";
    const space = height === ROWS ? "Full" : `${ROWS - height} ${ROWS - height === 1 ? "space" : "spaces"} left`;
    button.setAttribute("aria-label", `Column ${col + 1}: ${contents}. ${space}`);
    const unavailable = !yourTurn || height === ROWS;
    button.setAttribute("aria-disabled", String(unavailable));
    button.tabIndex = col === focusedCol ? 0 : -1;
  });
  if (lastMove) lastMove.animate = false; // animate each piece only once
}

function setStatus(text) {
  statusEl.textContent = text;
}

// ---------------------------------------------------------------------------
// Keyboard: one Tab stop for the whole board; arrow keys move between columns.
// ---------------------------------------------------------------------------

function setFocusedCol(col, moveFocus = true) {
  focusedCol = col;
  columnButtons.forEach((b, c) => { b.tabIndex = c === col ? 0 : -1; });
  if (moveFocus) columnButtons[col].focus();
}

function onColumnKey(event) {
  const col = Number(event.currentTarget.dataset.col);
  const keys = { ArrowLeft: col - 1, ArrowRight: col + 1, Home: 0, End: COLS - 1 };
  if (event.key in keys) {
    event.preventDefault();
    setFocusedCol(Math.max(0, Math.min(COLS - 1, keys[event.key])));
  }
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

const checkedLevel = () => document.querySelector('input[name="c4-level"]:checked');
const levelLabel = () => checkedLevel().parentElement.textContent.trim();

function newGame() {
  gameId++;
  if (thinking && worker) {
    // Stop the search for the old game instead of waiting for it.
    worker.terminate();
    startWorker();
  }
  thinking = false;
  firstPlayer = document.querySelector('input[name="c4-first"]:checked').value === "ai" ? AI : HUMAN;
  gameLevel = checkedLevel().value;
  board = new Board(firstPlayer);
  moves = [];
  gameOver = false;
  lastMove = null;
  winningCells = [];
  if (firstPlayer === AI) {
    aiTurn(`New game on ${levelLabel()}. `);
  } else {
    render();
    setStatus(`New game on ${levelLabel()}. Your move: choose a column.`);
  }
}

function place(col) {
  const row = board.play(col);
  moves.push(col);
  lastMove = { col, row, animate: true };
}

// Returns a message if the game just ended, otherwise null.
function checkEnd() {
  const line = board.winningLine();
  if (line) {
    gameOver = true;
    winningCells = line.cells;
    const where = line.cells.map((i) => Math.floor(i / ROWS) + 1);
    const columns = [...new Set(where)];
    const span = columns.length === 1 ? `in column ${columns[0]}` : `across columns ${columns[0]} to ${columns[columns.length - 1]}`;
    return line.player === HUMAN
      ? `You win! Four in a row ${span}. Press New game to play again.`
      : `The computer wins with four in a row ${span}. Press New game to try again.`;
  }
  if (board.isFull()) {
    gameOver = true;
    return "It's a draw: the board is full. Press New game to play again.";
  }
  return null;
}

function humanMove(col) {
  if (gameOver || thinking || board.toMove !== HUMAN) return;
  if (!board.canPlay(col)) {
    setStatus(`Column ${col + 1} is full. Choose another column.`);
    return;
  }
  place(col);
  const end = checkEnd();
  if (end) {
    render();
    setStatus(end);
    return;
  }
  aiTurn(`You played column ${col + 1}. `);
}

async function aiTurn(prefix = "") {
  thinking = true;
  render();
  setStatus(`${prefix}The computer is thinking…`);
  const id = gameId;
  const start = Date.now();
  const reply = await askAi(gameLevel);
  const wait = MIN_THINK_MS - (Date.now() - start);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  if (id !== gameId) return; // a new game started meanwhile

  thinking = false;
  place(reply.col);
  const end = checkEnd();
  render();
  setStatus(end ? `${prefix}Computer played column ${reply.col + 1}. ${end}`
                : `${prefix}Computer played column ${reply.col + 1}. Your move.`);
}

// ---------------------------------------------------------------------------

if (boardEl) {
  startWorker();
  buildBoard();
  newGameButton.addEventListener("click", newGame);
  newGame();
}
