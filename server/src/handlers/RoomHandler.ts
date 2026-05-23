import { Server as SocketIOServer, Socket } from 'socket.io';
import { Player } from '../models/Player';
import { Room } from '../models/Room';
import {
  CreateRoomPayload,
  JoinRoomPayload,
  LeaveRoomPayload,
  UpdateSettingsPayload,
  AddCustomWordsPayload,
} from '../types';

// Map socketId -> { roomId, playerId } for quick lookup on disconnect
const socketToRoom = new Map<string, { roomId: string; playerId: string }>();

export function getSocketRoom(socketId: string): { roomId: string; playerId: string } | undefined {
  return socketToRoom.get(socketId);
}

export function setSocketRoom(socketId: string, roomId: string, playerId: string): void {
  socketToRoom.set(socketId, { roomId, playerId });
}

export function removeSocketRoom(socketId: string): void {
  socketToRoom.delete(socketId);
}

export function registerRoomHandlers(
  io: SocketIOServer,
  socket: Socket,
  rooms: Map<string, Room>
): void {
  // ---- CREATE ROOM ----
  socket.on('create_room', (payload: CreateRoomPayload, callback?: (response: unknown) => void) => {
    try {
      const { playerName, avatarColor } = payload;

      if (!playerName || playerName.trim().length === 0) {
        const error = { success: false, error: 'Player name is required' };
        if (callback) callback(error);
        socket.emit('error_event', { message: 'Player name is required' });
        return;
      }

      // Cleanup any existing session for this socket to prevent duplicates
      const existingInfo = getSocketRoom(socket.id);
      if (existingInfo) {
        handlePlayerLeave(io, socket, rooms, existingInfo.roomId);
      }

      // Create host player
      const host = new Player(socket.id, playerName.trim(), avatarColor || '#4A90D9', true);

      // Create room
      const room = new Room(host);

      // Ensure unique room code
      let attempts = 0;
      while (rooms.has(room.id) && attempts < 10) {
        (room as any).id = require('../models/Room').generateRoomCode?.() ||
          Math.random().toString(36).substring(2, 8).toUpperCase();
        attempts++;
      }

      rooms.set(room.id, room);

      // Join socket.io room
      socket.join(room.id);

      // Track socket -> room mapping
      setSocketRoom(socket.id, room.id, host.id);

      console.log(`[Room] ${host.name} created room ${room.id}`);

      const response = {
        success: true,
        roomId: room.id,
        playerId: host.id,
        room: room.toJSON(),
      };

      if (callback) callback(response);
      socket.emit('room_created', { roomId: room.id, playerId: host.id, room: room.toJSON() });
    } catch (err) {
      console.error('[Room] Error creating room:', err);
      const error = { success: false, error: 'Failed to create room' };
      if (callback) callback(error);
      socket.emit('error_event', { message: 'Failed to create room' });
    }
  });

  // ---- JOIN ROOM ----
  socket.on('join_room', (payload: JoinRoomPayload, callback?: (response: unknown) => void) => {
    try {
      const { roomId, playerName, avatarColor } = payload;

      if (!playerName || playerName.trim().length === 0) {
        const error = { success: false, error: 'Player name is required' };
        if (callback) callback(error);
        socket.emit('error_event', { message: 'Player name is required' });
        return;
      }

      // Cleanup any existing session for this socket to prevent duplicates
      const existingInfo = getSocketRoom(socket.id);
      if (existingInfo) {
        handlePlayerLeave(io, socket, rooms, existingInfo.roomId);
      }

      const room = rooms.get(roomId?.toUpperCase());
      if (!room) {
        const error = { success: false, error: 'Room not found' };
        if (callback) callback(error);
        socket.emit('error_event', { message: 'Room not found', code: 'ROOM_NOT_FOUND' });
        return;
      }

      // Create player
      const player = new Player(socket.id, playerName.trim(), avatarColor || '#4A90D9', false);

      // Try to add player
      const addResult = room.addPlayer(player);
      if (!addResult.success) {
        const error = { success: false, error: addResult.error };
        if (callback) callback(error);
        socket.emit('error_event', { message: addResult.error || 'Cannot join room' });
        return;
      }

      // Join socket.io room
      socket.join(room.id);

      // Track socket -> room mapping
      setSocketRoom(socket.id, room.id, player.id);

      console.log(`[Room] ${player.name} joined room ${room.id}`);

      const roomState = room.toJSON();
      const response = {
        success: true,
        roomId: room.id,
        playerId: player.id,
        room: roomState,
      };

      if (callback) callback(response);

      // Notify the joining player
      socket.emit('room_joined', { roomId: room.id, playerId: player.id, room: roomState });

      // Notify others in the room
      socket.to(room.id).emit('player_joined', {
        player: player.toJSON(),
        room: roomState,
      });

      // If a game is in progress and in drawing phase, send canvas state
      if (room.game && room.game.phase === 'DRAWING') {
        socket.emit('canvas_state', { strokes: (room.game as any).flatStrokes || [] });
        socket.emit('game_state', room.game.toJSON(player.id));
      }
    } catch (err) {
      console.error('[Room] Error joining room:', err);
      const error = { success: false, error: 'Failed to join room' };
      if (callback) callback(error);
      socket.emit('error_event', { message: 'Failed to join room' });
    }
  });

  // ---- LEAVE ROOM ----
  socket.on('leave_room', (payload: LeaveRoomPayload) => {
    try {
      handlePlayerLeave(io, socket, rooms, payload.roomId);
    } catch (err) {
      console.error('[Room] Error leaving room:', err);
    }
  });

  // ---- UPDATE SETTINGS ----
  socket.on('update_settings', (payload: UpdateSettingsPayload, callback?: (response: unknown) => void) => {
    try {
      const { roomId, settings } = payload;

      const room = rooms.get(roomId);
      if (!room) {
        const error = { success: false, error: 'Room not found' };
        if (callback) callback(error);
        return;
      }

      const socketInfo = getSocketRoom(socket.id);
      if (!socketInfo) {
        const error = { success: false, error: 'You are not in this room' };
        if (callback) callback(error);
        return;
      }

      const result = room.updateSettings(settings, socketInfo.playerId);
      if (!result.success) {
        const error = { success: false, error: result.error };
        if (callback) callback(error);
        socket.emit('error_event', { message: result.error || 'Cannot update settings' });
        return;
      }

      console.log(`[Room] Settings updated in room ${room.id}`);

      if (callback) callback({ success: true });
      room.broadcast(io, 'settings_updated', { settings: room.settings });
    } catch (err) {
      console.error('[Room] Error updating settings:', err);
      const error = { success: false, error: 'Failed to update settings' };
      if (callback) callback(error);
    }
  });

  // ---- ADD CUSTOM WORDS ----
  socket.on('add_custom_words', (payload: AddCustomWordsPayload, callback?: (response: unknown) => void) => {
    try {
      const { roomId, words } = payload;

      const room = rooms.get(roomId);
      if (!room) {
        const error = { success: false, error: 'Room not found' };
        if (callback) callback(error);
        return;
      }

      const socketInfo = getSocketRoom(socket.id);
      if (!socketInfo) {
        const error = { success: false, error: 'You are not in this room' };
        if (callback) callback(error);
        return;
      }

      const result = room.addCustomWords(words, socketInfo.playerId);
      if (!result.success) {
        const error = { success: false, error: result.error };
        if (callback) callback(error);
        socket.emit('error_event', { message: result.error || 'Cannot add custom words' });
        return;
      }

      console.log(`[Room] ${words.length} custom words added to room ${room.id}`);

      if (callback) callback({ success: true, wordCount: room.settings.customWords.length });
      room.broadcast(io, 'custom_words_added', {
        count: room.settings.customWords.length,
      });
    } catch (err) {
      console.error('[Room] Error adding custom words:', err);
      const error = { success: false, error: 'Failed to add custom words' };
      if (callback) callback(error);
    }
  });

  // ---- DISCONNECT ----
  socket.on('disconnect', () => {
    try {
      const socketInfo = getSocketRoom(socket.id);
      if (socketInfo) {
        handlePlayerLeave(io, socket, rooms, socketInfo.roomId);
      }
    } catch (err) {
      console.error('[Room] Error handling disconnect:', err);
    }
  });
}

function handlePlayerLeave(
  io: SocketIOServer,
  socket: Socket,
  rooms: Map<string, Room>,
  roomId: string
): void {
  const socketInfo = getSocketRoom(socket.id);
  if (!socketInfo || socketInfo.roomId !== roomId) return;

  const room = rooms.get(roomId);
  if (!room) {
    removeSocketRoom(socket.id);
    return;
  }

  const result = room.removePlayer(socketInfo.playerId);
  if (!result.removed) {
    removeSocketRoom(socket.id);
    return;
  }

  // Leave socket.io room
  socket.leave(roomId);
  removeSocketRoom(socket.id);

  console.log(`[Room] ${result.playerName} left room ${roomId}`);

  // If room is empty, clean up
  if (result.isEmpty) {
    console.log(`[Room] Room ${roomId} is empty, cleaning up`);
    room.cleanup();
    rooms.delete(roomId);
    return;
  }

  // If the drawer left during a game, end the round
  if (result.wasDrawer && room.game && room.game.phase === 'DRAWING') {
    console.log(`[Room] Drawer left, ending round in room ${roomId}`);
    const roundResult = room.game.endRound();

    room.broadcast(io, 'player_left', {
      playerId: socketInfo.playerId,
      playerName: result.playerName,
      newHostId: result.newHost?.id || null,
      room: room.toJSON(),
    });

    room.broadcast(io, 'round_end', {
      word: roundResult.word,
      scores: roundResult.scores,
      round: roundResult.round,
      reason: 'Drawer left the game',
    });

    // Start next round after delay
    setTimeout(() => {
      if (room.game && room.players.size >= 2) {
        if (room.game.shouldEndGame()) {
          const gameResult = room.game.endGame();
          room.saveScores();
          room.broadcast(io, 'game_over', {
            winner: gameResult.winner,
            scores: gameResult.scores,
            word: room.game.currentWord,
          });
        } else {
          startNextRound(io, room);
        }
      } else if (room.game && room.players.size < 2) {
        room.game.destroy();
        room.game = null;
        room.broadcast(io, 'game_ended', {
          reason: 'Not enough players to continue',
          room: room.toJSON(),
        });
      }
    }, 3000);

    return;
  }

  // Broadcast player left
  room.broadcast(io, 'player_left', {
    playerId: socketInfo.playerId,
    playerName: result.playerName,
    newHostId: result.newHost?.id || null,
    room: room.toJSON(),
  });

  // If in game and too few players, end the game
  if (room.game && room.game.phase !== 'LOBBY' && room.game.phase !== 'GAME_OVER' && room.players.size < 2) {
    room.game.destroy();
    room.game = null;
    room.broadcast(io, 'game_ended', {
      reason: 'Not enough players to continue',
      room: room.toJSON(),
    });
  }
}

function startNextRound(io: SocketIOServer, room: Room): void {
  if (!room.game) return;

  const roundInfo = room.game.startRound();

  if (room.game.phase === 'GAME_OVER') {
    const gameResult = room.game.endGame();
    room.saveScores();
    room.broadcast(io, 'game_over', {
      winner: gameResult.winner,
      scores: gameResult.scores,
      word: room.game.currentWord,
    });
    return;
  }

  // Send word options only to the drawer
  const drawer = room.game.getCurrentDrawer();

  // Send round start to everyone
  room.broadcast(io, 'round_start', {
    round: roundInfo.round,
    totalRounds: room.game.totalRounds,
    drawerId: roundInfo.drawerId,
    drawerName: roundInfo.drawerName,
  });

  // Send word options only to the drawer
  io.to(drawer.socketId).emit('word_options', {
    words: roundInfo.wordOptions,
  });
}
