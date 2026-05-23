import { Server as SocketIOServer, Socket } from 'socket.io';
import { Room } from '../models/Room';
import { getSocketRoom } from './RoomHandler';
import {
  DrawPayload,
  CanvasClearPayload,
  DrawUndoPayload,
} from '../types';

export function registerDrawHandlers(
  io: SocketIOServer,
  socket: Socket,
  rooms: Map<string, Room>
): void {
  // ---- DRAW (Flat event from client) ----
  socket.on('draw', (payload: any) => {
    try {
      const { roomId, ...strokeData } = payload;
      const room = rooms.get(roomId);

      if (!room || !room.game || room.game.phase !== 'DRAWING') return;

      const socketInfo = getSocketRoom(socket.id);
      if (!socketInfo) return;

      // Only the drawer can draw
      const drawer = room.game.getCurrentDrawer();
      if (drawer.id !== socketInfo.playerId) return;

      // Store stroke data (push to flat array)
      (room.game as any).flatStrokes = (room.game as any).flatStrokes || [];
      (room.game as any).flatStrokes.push(strokeData);

      // Broadcast to others in the room
      socket.to(room.id).emit('draw_data', strokeData);
    } catch (err) {
      console.error('[Draw] Error handling draw:', err);
    }
  });

  // ---- CANVAS CLEAR ----
  socket.on('clear_canvas', (payload: CanvasClearPayload) => {
    try {
      const { roomId } = payload;
      const room = rooms.get(roomId);

      if (!room || !room.game || room.game.phase !== 'DRAWING') return;

      const socketInfo = getSocketRoom(socket.id);
      if (!socketInfo) return;

      // Only the drawer can clear
      const drawer = room.game.getCurrentDrawer();
      if (drawer.id !== socketInfo.playerId) return;

      // Clear stored strokes
      room.game.clearStrokes();
      (room.game as any).flatStrokes = [];

      // Broadcast to all in room
      room.broadcast(io, 'canvas_cleared', {
        playerId: socketInfo.playerId,
      });

      console.log(`[Draw] Canvas cleared in room ${room.id}`);
    } catch (err) {
      console.error('[Draw] Error handling canvas_clear:', err);
    }
  });

  // ---- DRAW UNDO ----
  socket.on('draw_undo', (payload: DrawUndoPayload) => {
    try {
      const { roomId, count } = payload;
      const room = rooms.get(roomId);

      if (!room || !room.game || room.game.phase !== 'DRAWING') return;

      const socketInfo = getSocketRoom(socket.id);
      if (!socketInfo) return;

      // Only the drawer can undo
      const drawer = room.game.getCurrentDrawer();
      if (drawer.id !== socketInfo.playerId) return;

      // Undo last strokes
      if ((room.game as any).flatStrokes && (room.game as any).flatStrokes.length > 0) {
        (room.game as any).flatStrokes.splice(-count);
        room.broadcast(io, 'draw_undo', { count });
      }
    } catch (err) {
      console.error('[Draw] Error handling draw_undo:', err);
    }
  });

  // ---- CANVAS STATE REQUEST (for late joiners) ----
  socket.on('request_canvas_state', (payload: { roomId: string }) => {
    try {
      const { roomId } = payload;
      const room = rooms.get(roomId);

      if (!room || !room.game) return;

      // Send full stroke history to the requesting socket
      socket.emit('canvas_state', {
        strokes: (room.game as any).flatStrokes || [],
      });
    } catch (err) {
      console.error('[Draw] Error sending canvas state:', err);
    }
  });
}
