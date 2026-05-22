# 🌸 Skribbl.io Clone — 描く & 当てる

A real-time multiplayer drawing and guessing game (Pictionary) built with a beautiful Japanese-inspired aesthetic.

![Made with React](https://img.shields.io/badge/React-18-blue)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![SQLite](https://img.shields.io/badge/SQLite-3-lightgrey)

## ✨ Features

### Core Gameplay
- **Multiplayer rooms** — Create or join rooms; support for private rooms via room code
- **Turn-based drawing** — One drawer per round; others guess
- **Real-time drawing** — Canvas updates in real time via WebSocket
- **Word system** — Drawer picks a word from choices; others see hints/blanks
- **Scoring** — Points for correct guesses; time bonus; leaderboard
- **Chat & guessing** — Integrated chat with guess checking

### Drawing Tools
- 🖌️ Brush with 20 colors (including Japanese-inspired palette)
- 📏 5 brush sizes (Tiny, Small, Medium, Large, Huge)
- 🧹 Eraser tool
- ↩️ True multi-undo system (undo multiple continuous strokes flawlessly)
- 🗑️ Clear canvas (with confirmation)
- ✨ Smooth continuous drawing with smart line interpolation

### Room Settings (Host-configurable)
- Max players: 2–20
- Rounds: 2–10
- Draw time: 15–240 seconds
- Word count: 1–5 choices per round
- Hints: 0–5 letter reveals
- Word mode: Normal / Hidden
- ✏️ **Custom words** — Host can add custom words via the UI

### Design
- 🌸 Japanese aesthetic (和風デザイン)
- Cherry blossom animations
- Washi paper textures
- Deep indigo & sakura color palette
- Responsive design

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ and **npm** 9+
- Git

### Installation

```bash
# 1. Clone / navigate to the project
cd skribbl-clone

# 2. Install all dependencies (server + client + root)
npm run setup

# OR install manually:
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# 3. Seed the database with 500+ words
npm run seed
```

### Running the Application

```bash
# Start both server and client concurrently
npm run dev
```

This starts:
- **Server**: http://localhost:3001 (Express + Socket.IO)
- **Client**: http://localhost:5173 (Vite dev server)

Open **http://localhost:5173** in your browser. Open multiple tabs to test multiplayer!

### Testing Multiplayer Locally

1. Open tab 1 → Enter a name → **Create Room**
2. Copy the room code
3. Open tab 2 → Enter a different name → **Join Room** with the code
4. In tab 1 (host), click **Start Game**
5. Draw, guess, and play!

## 🏗️ Architecture

```
skribbl-clone/
├── client/                  # React + Vite + TypeScript frontend
│   ├── src/
│   │   ├── components/      # UI components (Home, Lobby, Game, Chat, Canvas)
│   │   ├── context/         # React contexts (Socket, Game state)
│   │   ├── hooks/           # Custom hooks (useCanvas, useGameState)
│   │   ├── types/           # TypeScript interfaces
│   │   └── utils/           # Constants, helpers
│   └── ...
├── server/                  # Node.js + Express + Socket.IO backend
│   ├── src/
│   │   ├── models/          # OOP classes (Room, Game, Player, WordManager)
│   │   ├── handlers/        # WebSocket event handlers
│   │   ├── database/        # SQLite setup + seed script
│   │   └── types.ts         # Server-side type definitions
│   └── ...
└── package.json             # Root scripts
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + TypeScript + Vite | UI, canvas, game screens |
| Canvas | HTML5 Canvas API | Drawing with real-time stroke sync |
| Backend | Node.js + Express + TypeScript | API, game logic, WebSocket server |
| Real-time | Socket.IO | Drawing sync, guesses, chat, game state |
| Database | SQLite (better-sqlite3) | Rooms, users, word lists, scores |
| Styling | Vanilla CSS | Japanese-themed design system |

### OOP Backend

The backend uses an **OOP architecture** with the following classes:
- **`Room`** — Manages players, settings, game lifecycle
- **`Game`** — Core game engine (rounds, scoring, word matching, hints)
- **`Player`** — Player state (score, round state, identity)
- **`WordManager`** — Word retrieval from SQLite, custom words, hint generation

### WebSocket Flow

```
Client                          Server
  │                               │
  ├── create_room ───────────────►│
  │◄─────────────── room_created ─┤
  │                               │
  ├── join_room ─────────────────►│
  │◄──────────────── room_joined ─┤
  │◄─────────────── player_joined ┤ (broadcast)
  │                               │
  ├── start_game ────────────────►│
  │◄────────────── game_started ──┤
  │◄────────────── choosing_word ─┤ (to drawer)
  │                               │
  ├── choose_word ───────────────►│
  │◄───────────── round_started ──┤
  │                               │
  ├── draw ──────────────────────►│
  │◄──────────────── draw_data ───┤ (broadcast)
  │                               │
  ├── send_message ──────────────►│ (guess)
  │◄────────────── correct_guess ─┤ (or chat_message)
  │                               │
  │◄──────────────── round_ended ─┤
  │◄───────────────── game_over ──┤
```

### Database Schema

```sql
-- Rooms table
CREATE TABLE rooms (id, host_id, settings, created_at, status)

-- Players table  
CREATE TABLE players (id, room_id, socket_id, name, avatar_color, score)

-- Word lists (500+ categorized words)
CREATE TABLE word_lists (id, word, category, difficulty)

-- Game scores history
CREATE TABLE scores (id, player_name, room_id, score, played_at)

-- Custom words per room
CREATE TABLE custom_words (id, room_id, word)
```

## 📝 Code Understanding

### How Drawing Strokes Work
1. **Capture**: Mouse/touch events on HTML5 Canvas capture coordinates, normalized to 0-1 range for screen independence
2. **Local render**: Strokes are drawn immediately on the drawer's canvas (client-side prediction)
3. **Emit**: Stroke data (start/end coordinates, color, size, tool) is emitted via Socket.IO
4. **Broadcast**: Server validates the sender is the current drawer, then broadcasts to all other players in the room
5. **Render**: Other clients receive `draw_data` events and render strokes on their canvases
6. **History**: Server stores stroke history for true multi-undo support and late joiners

### Game State Management
- **Server-authoritative**: The server is the single source of truth for all game state
- **Phase machine**: `LOBBY → CHOOSING_WORD → DRAWING → ROUND_END → (next round) → GAME_OVER`
- **Timer sync**: Server sends `timer_update` events; clients display remaining time
- **Scoring**: First guess = 100pts, 2nd = 80, 3rd = 60, rest = 40, drawer = 25/guesser, time bonus up to +50

### Word Matching Logic
- Case-insensitive comparison with trimmed whitespace
- "Close guess" detection via Levenshtein distance (≤ 2 edits)
- Progressive hint reveals based on elapsed time

## 🎯 Deployment to Render

This project is fully configured for production deployment. The Node.js server automatically serves the built React frontend when running in production mode.

### Step-by-Step Render Deployment:

1. Push your code to a GitHub/GitLab repository.
2. Sign up or log in to [Render](https://render.com/).
3. Click **New +** and select **Web Service**.
4. Connect your GitHub repository.
5. Configure the Web Service settings:
   - **Environment:** `Node`
   - **Build Command:** `npm run setup && npm run build`
   - **Start Command:** `npm start`
6. Scroll down to **Environment Variables** and add:
   - `NODE_ENV`: `production`
7. Click **Create Web Service**.

Render will automatically install dependencies, seed the SQLite database, build both the frontend and backend, and start the unified server. Your application will be live at your `*.onrender.com` URL and WebSocket connections will work out of the box!

## 📄 License

MIT
