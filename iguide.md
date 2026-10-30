# 📘 Skribbl.io Clone: Comprehensive Technical Whitepaper & Interview Guide

This guide provides an exhaustive, microscopic breakdown of every architectural pattern, design decision, and technical implementation within the Skribbl.io Clone. It is designed to act as your ultimate reference material for defending your codebase in a senior-level technical interview.

---

## 1. System Architecture: The Server-Authoritative Model

When building real-time multiplayer games, the biggest decision is determining who holds the "truth". In this project, we use a **Server-Authoritative** model. 

> [!IMPORTANT]
> **Why Server-Authoritative?**
> If clients controlled the game state (e.g., managing their own timers or validating their own guesses), malicious users could easily manipulate their local JavaScript to grant themselves infinite drawing time, cheat on guesses, or crash the lobby. By keeping the React frontend "dumb" and strictly executing commands sent from the Node.js server, we ensure total security and synchronization.

### The Application Layers
1. **The Presentation Layer (Frontend)**: React 18, Vite, TypeScript. Responsible strictly for capturing input (mouse events, keyboard) and rendering outputs dictated by the server.
2. **The Transport Layer (WebSockets)**: Socket.IO provides a persistent, full-duplex TCP connection, allowing the server to push events (`timer_tick`, `draw_data`) to the client instantly without HTTP polling.
3. **The Business Logic Layer (Backend)**: Node.js (Express). Intercepts socket events, runs validation, and updates the core Object-Oriented Game Models.
4. **The Persistence Layer (Database)**: SQLite (via `better-sqlite3`). A lightweight, synchronous embedded database used to store over 500 categorized words, custom user words, and historical game scores.

---

## 2. Frontend Deep Dive (`client/`)

### 2.1 State Management & React Hooks
To handle complex, rapidly changing game state across dozens of UI components without causing severe prop-drilling or unmanageable re-renders, the project uses the **React Context API combined with heavily optimized Hooks**.

#### The `GameContext.tsx`
This file acts as the central nervous system of the frontend.
- **The State Object**: Holds immutable properties such as `roomId`, `players`, `messages`, and `gameState` (which tracks the phase, hints, and timers).
- **The Reducer (`gameReducer`)**: A massive `switch` statement that processes dispatched actions (e.g., `ROUND_START`, `CHAT_MESSAGE`). 
- **Socket Listeners (`useEffect`)**: Inside a `useEffect` hook, the context registers listeners for every backend socket event.
  ```typescript
  socket.on('round_start', (data) => {
    dispatch({ type: 'ROUND_START', payload: data });
  });
  ```
  Whenever the server emits an event, the reducer intercepts it, clones the state immutably (`...state`), and updates the variables. React then triggers a hyper-efficient re-render of only the components hooked into `useGame()`.

#### Strategic Hook Usage (`useRef` vs `useState`)
In `useCanvas.ts`, the drawing coordinates are stored in a `useRef` rather than `useState`. 
> [!TIP]
> **Why `useRef`?** 
> If we stored the drawing strokes in React state, every tiny mouse movement would trigger a full component re-render, destroying the 60FPS frame rate. By utilizing `useRef`, we maintain a mutable reference to the drawing history that can be updated thousands of times a second *without* triggering a single React render cycle.

### 2.2 The Canvas Engine (`DrawingCanvas.tsx` & `useCanvas.ts`)
The drawing experience must be lag-free and cross-device compatible.

**Resolution Independence via Normalization**
A massive problem with Canvas games is varying screen sizes. 
1. **Capture**: When `mousemove` fires, we get the exact pixel coordinates relative to the canvas (`nativeEvent.offsetX`).
2. **Normalize**: We divide `X` by the canvas width, and `Y` by the canvas height. This produces a float (e.g., `0.5`, dead center).
3. **Emit**: We emit this normalized data to the server.
4. **Scale**: Viewers receive `0.5`, multiply it by *their* specific canvas width, and render the stroke perfectly proportional to their screen size.

**The Eraser Tool (Canvas Compositing)**
To implement an eraser, we do not simply "draw white lines". If the canvas had a custom background color, a white line would look broken. Instead, we use the HTML5 Canvas property `globalCompositeOperation = 'destination-out'`. This literally erases the pixels, revealing whatever is underneath the canvas.

### 2.3 True Multi-Undo System
Most junior developers implement "Undo" by taking a Base64 image snapshot of the canvas (`canvas.toDataURL()`) every time the user lifts their mouse, storing it in an array. This causes massive memory leaks and crashes the browser after 50+ strokes.

**Our Vector-Based Approach:**
1. Every continuous stroke (mouse down -> drag -> mouse up) is captured as a "batch" of `(X, Y)` coordinates.
2. The server stores these batches in an array (`flatStrokes`).
3. When the user hits Undo, the server pops the last batch off the array and broadcasts a `draw_undo` event.
4. Clients `ctx.clearRect` their entire canvas, and instantly loop through the remaining JSON array, redrawing thousands of vectors in less than 5 milliseconds.

---

## 3. Backend Deep Dive (`server/`)

The Node.js backend abandons the messy approach of writing raw spaghetti code inside socket listeners. Instead, it uses a highly structured **Object-Oriented Programming (OOP)** methodology.

### 3.1 The OOP Models
- **`Room.ts`**: Encapsulates a lobby. Holds a `Map<string, Player>` to guarantee O(1) lookups for player actions. Handles Host migrations (if the Host disconnects, it promotes the next oldest player).
- **`Game.ts`**: The core Phase Machine (`LOBBY` -> `CHOOSING_WORD` -> `DRAWING` -> `ROUND_END`). It manages the `setInterval` loop that drives the game timer, ensuring no client can spoof the clock.
- **`WordManager.ts`**: Interfaces with the SQLite database. It merges default database words with the Host's injected `customWords` into a unified pool.

### 3.2 The WebSocket Handlers
Handlers act as the controllers, sitting between the raw incoming socket events and the OOP models. They provide a vital security layer.

> [!CAUTION]
> **Preventing Cheating in `DrawHandler.ts`**
> We must assume the client can be hacked. If a viewer opens Chrome DevTools and emits a `draw` event manually, they could ruin the canvas. The `DrawHandler` prevents this:
> ```typescript
> socket.on('draw', (payload) => {
>   const room = rooms.get(payload.roomId);
>   // 1. Verify game is actually in drawing phase
>   if (room.game.phase !== 'DRAWING') return;
>   
>   // 2. VERIFY SENDER IS THE AUTHORIZED DRAWER
>   if (room.game.getCurrentDrawer().id !== player.id) return; 
>   
>   // 3. Process the stroke
>   room.game.addStroke(payload);
>   socket.to(roomId).emit('draw_data', payload);
> });
> ```

### 3.3 Synchronous SQLite (`better-sqlite3`)
Instead of using complex ORMs or asynchronous drivers (`sqlite3`), this project deliberately uses `better-sqlite3`. Node.js is inherently single-threaded, but `better-sqlite3` runs synchronous C++ bindings that are so incredibly fast they out-perform asynchronous queries for lightweight local tasks (like fetching a few words). This simplifies the backend architecture by eliminating unnecessary Promises and `async/await` overhead during critical real-time game loops.

---

## 4. Advanced Core Lifecycles

### 4.1 The Scoring Algorithm & Levenshtein Distance
When a user types a guess into the chat, the server intercepts it via `ChatHandler.ts` and passes it to `WordManager.checkGuess()`.

**The Algorithm Steps:**
1. Both the guess and target word are `.trim().toLowerCase()`.
2. If it's an exact match:
   - The user's score increases based on their guess order (1st = 100pts, 2nd = 80pts, 3rd = 60pts, 4th+ = 40pts).
   - **Time Bonus**: `Math.floor(50 * (timeRemaining / totalTime))`. A fast guesser gets up to +50 bonus points.
   - The Drawer gets +25 points for rewarding a good drawing.
3. If it's NOT an exact match:
   - The server runs a **Levenshtein Distance** algorithm, which calculates the exact number of single-character edits (insertions, deletions, substitutions) required to change the guess into the target word.
   - If the distance is `<= 2` (e.g., typing "Apples" instead of "Apple"), the server realizes it's a minor typo.
   - The server emits a `close_guess` event *privately* to that user's socket, displaying a yellow "That's close!" warning in their chat box without revealing to other players that the word is almost guessed.

### 4.2 Handling Late Joiners & Disconnects
Multiplayer games must handle users dropping connection, refreshing the page, or joining mid-game via an invite link.

**The Solution:**
1. The frontend `Lobby` and `GameBoard` components check if `myPlayerId` exists. If a user refreshes the page, React loses all memory. The frontend traps them and redirects them to the Home screen to enter their name.
2. They enter the Room Code and hit Join.
3. `Room.ts` `addPlayer()` safely pushes them into the active game without crashing.
4. The server sees the game is in the `DRAWING` phase, so it emits a `room_joined` event containing the active `GameState`.
5. `GameContext.tsx` instantly navigates the user straight to `/game/:id` instead of the lobby.
6. The `useCanvas` hook mounts and emits an aggressive `request_canvas_state` event to the server.
7. The server replies with the massive `flatStrokes` array, and the client instantly renders the entire drawing history up to that exact second.

---

## 5. Potential Interview Questions & Answers

**Q: Why didn't you use Tailwind CSS or a UI library like Material-UI?**
*A: I chose Vanilla CSS to demonstrate deep mastery of modern CSS features. By utilizing CSS Grid for the fluid layout, CSS Custom Properties (Variables) for the Japanese-themed design system, and raw `@keyframes` for the cherry blossom micro-animations, I maintained an extremely lightweight bundle size while keeping total control over the DOM.*

**Q: What would you change if you had to scale this to 100,000 players?**
*A: Currently, all `Room` and `Game` state lives in the Node.js process memory (RAM). If the server restarts, all active games drop. To scale horizontally, I would extract the state out into a high-speed, in-memory datastore like **Redis**. Additionally, I would use the **Socket.IO Redis Adapter** so that multiple Node.js instances behind a load balancer could securely broadcast drawing events to users connected across entirely different servers.*

**Q: How did you optimize the WebSocket payload sizes for drawing?**
*A: Emitting a socket event for every single pixel movement would instantly choke the network. Instead, the frontend `mousemove` event throttles the collection of `StrokePoint` data, batching multiple `(X, Y)` pairs together into an array and firing a single `draw` event every few milliseconds. This drastically reduces network overhead while maintaining perfect visual fidelity via `ctx.lineTo()` vector interpolation.*

**Q: Why did you use SQLite instead of MongoDB or PostgreSQL?**
*A: For this specific application, the database is primarily used as a read-heavy dictionary (fetching random words) and tracking lightweight endgame score records. Setting up an entirely separate PostgreSQL cluster or relying on MongoDB's cloud latency would introduce unnecessary network overhead for dictionary lookups. The `better-sqlite3` embedded engine executes queries directly within the Node.js process in microseconds, providing unmatched performance for this specific use case.*

**Q: How do you prevent XSS (Cross-Site Scripting) vulnerabilities in the ChatBox?**
*A: React protects against XSS out-of-the-box by aggressively escaping all text content rendered via JSX (`{message.text}`). However, the Node.js backend also acts as a primary firewall, stripping or rejecting payloads from the `chat` event that violate the string-type schema before they are ever broadcasted to other clients.*

**Q: How do you handle React's Strict Mode double-rendering the canvas?**
*A: React Strict Mode double-invokes `useEffect` on mount to test component resilience. For WebSockets, this can cause multiple connections. We solve this by lifting the Socket initialization out of the component mount cycle entirely (or utilizing a `useRef` to track initialization status), ensuring `io()` is only ever executed once during the application's lifespan.*
