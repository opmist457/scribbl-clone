import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';

import { initDb, getDb, closeDb, saveDb } from './database/db';
import { Room } from './models/Room';
import { wordManager } from './models/WordManager';
import { registerRoomHandlers } from './handlers/RoomHandler';
import { registerGameHandlers } from './handlers/GameHandler';
import { registerDrawHandlers } from './handlers/DrawHandler';
import { registerChatHandlers } from './handlers/ChatHandler';

const PORT = parseInt(process.env.PORT || '3001', 10);

// ---- Express Setup ----
const app = express();
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST'],
  credentials: true,
}));
app.use(express.json());

// ---- HTTP Server ----
const server = http.createServer(app);

// ---- Socket.IO Setup ----
const io = new SocketIOServer(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ---- Room Storage ----
const rooms = new Map<string, Room>();

// ---- REST Endpoints ----
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    rooms: rooms.size,
    connections: io.engine.clientsCount,
  });
});

app.get('/api/rooms', (_req, res) => {
  try {
    const roomList = Array.from(rooms.values()).map(room => ({
      id: room.id,
      playerCount: room.getPlayerCount(),
      maxPlayers: room.settings.maxPlayers,
      hostName: room.host?.name || 'Unknown',
      status: room.game ? room.game.phase : 'LOBBY',
      rounds: room.settings.rounds,
      drawTime: room.settings.drawTime,
    }));

    res.json({ rooms: roomList });
  } catch (err) {
    console.error('Error listing rooms:', err);
    res.status(500).json({ error: 'Failed to list rooms' });
  }
});

app.get('/api/rooms/:id', (req, res) => {
  try {
    const room = rooms.get(req.params.id.toUpperCase());
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
      id: room.id,
      playerCount: room.getPlayerCount(),
      maxPlayers: room.settings.maxPlayers,
      status: room.game ? room.game.phase : 'LOBBY',
      players: Array.from(room.players.values()).map(p => ({
        name: p.name,
        score: p.score,
        avatarColor: p.avatarColor,
      })),
    });
  } catch (err) {
    console.error('Error getting room:', err);
    res.status(500).json({ error: 'Failed to get room' });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// ---- Socket.IO Connection Handler ----
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  registerRoomHandlers(io, socket, rooms);
  registerGameHandlers(io, socket, rooms);
  registerDrawHandlers(io, socket, rooms);
  registerChatHandlers(io, socket, rooms);

  socket.on('ping_server', (callback?: (response: unknown) => void) => {
    if (callback) callback({ pong: true, timestamp: Date.now() });
  });
});

// ---- Room Cleanup Interval ----
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  const staleThreshold = 2 * 60 * 60 * 1000; // 2 hours

  for (const [roomId, room] of rooms) {
    if (room.getPlayerCount() === 0) {
      console.log(`[Cleanup] Removing empty room: ${roomId}`);
      room.cleanup();
      rooms.delete(roomId);
    } else if (now - room.createdAt > staleThreshold && (!room.game || room.game.phase === 'LOBBY')) {
      console.log(`[Cleanup] Removing stale room: ${roomId}`);
      room.broadcast(io, 'room_closed', { reason: 'Room expired due to inactivity' });
      room.cleanup();
      rooms.delete(roomId);
    }
  }
}, 5 * 60 * 1000);

// ---- Async Startup ----
async function start(): Promise<void> {
  console.log('📦 Initializing database...');
  await initDb();

  console.log('📚 Loading word lists...');
  wordManager.loadWords();

  // Check if words are seeded
  try {
    const db = getDb();
    const results = db.exec('SELECT COUNT(*) FROM word_lists');
    const wordCount = results.length > 0 ? (results[0].values[0][0] as number) : 0;

    if (wordCount === 0) {
      console.warn('⚠️  No words found in database! Run "npm run seed" to populate the word list.');
    } else {
      console.log(`✅ Loaded ${wordCount} words from database.`);
    }
  } catch (err) {
    console.warn('⚠️  Could not check word count:', err);
  }

  server.listen(PORT, () => {
    console.log('');
    console.log('🎨 ═══════════════════════════════════════════');
    console.log(`🎨  Skribbl.io Clone Server`);
    console.log(`🎨  Running on http://localhost:${PORT}`);
    console.log(`🎨  WebSocket ready for connections`);
    console.log('🎨 ═══════════════════════════════════════════');
    console.log('');
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// ---- Graceful Shutdown ----
function gracefulShutdown(signal: string): void {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  clearInterval(cleanupInterval);

  io.emit('server_shutdown', { message: 'Server is shutting down' });

  for (const [roomId, room] of rooms) {
    room.cleanup();
    rooms.delete(roomId);
  }

  io.close(() => {
    console.log('Socket.IO server closed');
  });

  server.close(() => {
    console.log('HTTP server closed');
    closeDb();
    console.log('Database closed');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, server, io };
