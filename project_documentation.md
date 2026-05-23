# Intern Assignment Submission: Skribbl.io Clone

Thank you for the opportunity to work on this assignment. Below is an overview of my implementation, detailing how I fulfilled the requirements, the architectural design, and a walkthrough of the core features to demonstrate my understanding of the codebase.

---

## 1. Requirements Checklist

I have implemented a complete end-to-end clone of Skribbl.io. Here is a line-by-line breakdown of how I met the requirements:

### Must Have
- [x] **Create room with configurable settings:** Implemented. Hosts can define max players, rounds, draw time, word count options, hint amounts, and word modes.
- [x] **Join room via link or code:** Implemented. Users can instantly join active games via the 6-character room code.
- [x] **Lobby with player list; host starts game:** Implemented. The lobby displays connected players and their avatars; the host retains exclusive control to start the match.
- [x] **Turn-based rounds: one drawer, others guess:** Implemented. A server-side state machine smoothly rotates the `currentDrawerIndex` every round.
- [x] **Real-time drawing sync (strokes visible to all):** Implemented. High-performance sync using Socket.IO broadcasts (`draw_data`). Supports late-joiners receiving the full canvas state instantly.
- [x] **Word selection for drawer (1–5 choices):** Implemented. Drawer selects from a configurable number of word choices pulled from the SQLite database.
- [x] **Guessing: type word, get points for correct guess:** Implemented. Includes case-insensitive checking and partial match (Levenshtein distance) detection.
- [x] **Scoring and leaderboard:** Implemented. Live scoreboard updates dynamically mid-round, awarding sliding-scale points based on guess speed.
- [x] **Game end with winner:** Implemented. A final podium overlay displays the winner before gracefully returning everyone to the lobby.
- [x] **Basic drawing tools: brush, colors, undo, clear:** Implemented. Includes 20 colors, 5 brush sizes, an eraser, canvas clearing, and a true vector-based multi-undo system.

### Should Have
- [x] **Hints (reveal letters over time):** Implemented. The server runs an interval timer, revealing letters progressively based on elapsed time.
- [x] **Chat (guesses + optional general chat):** Implemented. Handles standard chat and safely intercepts/hides correct guesses.
- [x] **Draw time countdown:** Implemented. Fully synchronized server-to-client countdown timer display.
- [x] **Private rooms (invite link):** Implemented. The 6-character room code isolates sessions, acting natively as a private lobby.

### Bonus Ideas / Nice to Have
- [x] **OOP concepts for WebSocket servers:** Implemented perfectly. My backend is strictly object-oriented, utilizing `Room`, `Game`, `Player`, and `WordManager` classes to cleanly encapsulate logic.
- [x] **Room settings:** Implemented. Extensive configuration UI is available to the host in the lobby.
- [x] **Word categories:** Implemented. SQLite is seeded with over 500 categorized words.
- [x] **Custom word list:** Implemented. Hosts can inject custom words into the database pool for their specific session.
- [x] **Eraser tool & Avatars:** Implemented seamlessly via canvas composite operations and a colorful UI picker.

---

## 2. Architecture Overview

I designed this project using a **Server-Authoritative Architecture** to prevent cheating and ensure perfect synchronization across all clients. 

### How WebSockets, Canvas, and Game Logic Intertwine:
1. **The Canvas (Client-side):** The HTML5 Canvas captures mouse and touch events natively. To ensure that a stroke drawn on a large 4K desktop monitor maps perfectly onto a small mobile phone screen, I immediately normalize the `(x, y)` coordinates into a relative `0.0` to `1.0` ratio. 
2. **Local Prediction:** To provide a fluid, lag-free experience for the drawer, strokes are rendered locally on the drawer's screen the millisecond they move their cursor.
3. **The WebSocket Bridge:** Simultaneously, the client emits a `draw` event (containing the normalized coordinates, color, and size) to the backend via Socket.IO.
4. **Backend Game Loop & Validation:** The Node.js server intercepts the `draw` event. The `Room` class delegates it to the `Game` class, which verifies that the socket emitting the event is actually the authorized drawer for the current round. 
5. **Broadcasting & Late Joiners:** If authorized, the server stores the stroke in a `flatStrokes` array (so that users who refresh the page or join late can instantly receive the full drawing history) and broadcasts `draw_data` to all other viewers. The viewers then scale the normalized coordinates to their own screen resolution and render the stroke.

---

## 3. Code Walkthrough Readiness

Here are the key technical choices I made and a walkthrough of the core data flow, demonstrating my deep understanding of the codebase.

### Tech Stack Choices
- **Frontend (React + Vite):** Chose React for its declarative UI, making it easy to manage complex interfaces like the Chat and Scoreboard, while keeping the Canvas strictly isolated in a custom hook (`useCanvas`) to prevent unnecessary React re-renders during high-frequency drawing events.
- **Backend (Node.js + Express):** Selected Node.js for its native asynchronous event loop, which handles thousands of rapid WebSocket connections efficiently.
- **Real-Time (Socket.IO):** Chosen over raw WebSockets because of its native **Rooms** API. Managing lobbies is incredibly efficient using `socket.join(roomId)` and broadcasting via `socket.to(roomId).emit()`, cleanly abstracting connection mapping.

### Data Flow: Guessing a Word
When a user attempts to guess a word in the chat box, the following flow executes:
1. **Client Emit:** The user types a message and hits enter. The client emits a `guess` event to the server.
2. **Server Routing:** `ChatHandler.ts` intercepts the event and passes it to the active `Game` instance.
3. **Validation:** The `Game.checkGuess()` method confirms the user isn't the drawer and hasn't already guessed correctly.
4. **Matching Algorithm:** 
   - The guess and target word are stripped of whitespace and converted to lowercase.
   - If it's an exact match, the player gets points. Time bonuses are applied dynamically based on the remaining server clock.
   - If it's not an exact match, I implemented a **Levenshtein distance** algorithm. If the guess is off by 2 characters or less (a typo), the server privately emits a `close_guess` event back to the user to encourage them.
5. **State Update & Broadcast:** If correct, the server flags the user as `hasGuessedCorrectly = true`, emits a `guess_result` to the chat (hiding the word but announcing the success), and broadcasts a `SCOREBOARD_UPDATE` so all clients instantly see the point change.
