---
title: Connect 4 vs. AI
order: 2
badge: CS 3520 · team project
summary: >-
  Connect 4 against an AI opponent that searches the game tree with minimax and
  alpha-beta pruning. Started as a class project; I later fixed its search, made it
  much faster and added difficulty levels, a perfect solver and Monte Carlo Tree Search.
highlights:
  - Playable in the browser, with four difficulty levels
  - Searches 18–32 moves ahead in the Java version, using a bitboard and a transposition table
  - In the Java version, plays perfectly from move 8 with an exact solver, tested against brute force
tech: [Java, JavaFX, JavaScript, Alpha-beta pruning, MCTS]
links:
  - label: Play in browser
    href: /projects/connect-4/
    primary: true
  - label: Source code
    href: https://github.com/SergioSimental/Connect4-AI
  - label: Original team project
    href: https://github.com/AlexZ98/CS3520_Connect4
media:
  kind: board
  alt: Connect 4 board mid-game, red AI pieces versus blue player pieces
  background: "#1A1D22"
  rows: 6
  cols: 7
  # "row,col" with row 0 at the top: b = blue (you), r = red (AI)
  pieces: { "5,2": r, "5,3": b, "5,4": r, "5,5": b, "4,2": r, "4,3": r, "4,4": b, "3,3": b }
  video: /assets/media/connect4-demo.mp4
  videoBackground: "#F3F3F3"
  duration: "0:28"
  # Read by screen readers with the Play button (WCAG 1.2.1). Describe what happens.
  videoDescription: The original class version. You (blue) and the AI (red) take turns placing pieces on an 8 by 8 board, and the AI answers each move after a short pause.
---
