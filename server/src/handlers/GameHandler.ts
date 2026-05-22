import { Server as SocketIOServer, Socket } from 'socket.io';
import { Room } from '../models/Room';
import { getSocketRoom } from './RoomHandler';
import {
  StartGamePayload,
  WordChosenPayload,
  PlayAgainPayload,
} from '../types';

export function registerGameHandlers(
  io: SocketIOServer,
  socket: Socket,
  rooms: Map<string, Room>
): void {
  // ---- START GAME ----
  socket.on('start_game', (payload: StartGamePayload, callback?: (response: unknown) => void) => {
    try {
      const { roomId } = payload;
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

      // Only host can start the game
      if (room.host?.id !== socketInfo.playerId) {
        const error = { success: false, error: 'Only the host can start the game' };
        if (callback) callback(error);
        socket.emit('error_event', { message: 'Only the host can start the game' });
        return;
      }

      // Start the game
      const startResult = room.startGame();
      if (!startResult.success) {
        const error = { success: false, error: startResult.error };
        if (callback) callback(error);
        socket.emit('error_event', { message: startResult.error || 'Cannot start game' });
        return;
      }

      console.log(`[Game] Game started in room ${room.id}`);

      if (callback) callback({ success: true });

      // Emit game_started to everyone
      room.broadcast(io, 'game_started', {
        game: room.game!.toJSON(),
      });

      // Start first round
      const roundInfo = room.game!.startRound();

      if (room.game!.phase === 'GAME_OVER') {
        const gameResult = room.game!.endGame();
        room.saveScores();
        room.broadcast(io, 'game_over', {
          winner: gameResult.winner,
          scores: gameResult.scores,
          word: '',
        });
        return;
      }

      // Send round_start to everyone
      room.broadcast(io, 'round_start', {
        round: roundInfo.round,
        totalRounds: room.game!.totalRounds,
        drawerId: roundInfo.drawerId,
        drawerName: roundInfo.drawerName,
      });

      // Send word options only to the drawer
      const drawer = room.game!.getCurrentDrawer();
      io.to(drawer.socketId).emit('word_options', {
        words: roundInfo.wordOptions,
      });

      // Auto-select word timeout (15 seconds to choose)
      setupWordChoiceTimeout(io, room);
    } catch (err) {
      console.error('[Game] Error starting game:', err);
      const error = { success: false, error: 'Failed to start game' };
      if (callback) callback(error);
    }
  });

  // ---- WORD CHOSEN ----
  socket.on('word_chosen', (payload: WordChosenPayload, callback?: (response: unknown) => void) => {
    try {
      const { roomId, word } = payload;
      const room = rooms.get(roomId);

      if (!room || !room.game) {
        const error = { success: false, error: 'Room or game not found' };
        if (callback) callback(error);
        return;
      }

      const socketInfo = getSocketRoom(socket.id);
      if (!socketInfo) {
        const error = { success: false, error: 'You are not in this room' };
        if (callback) callback(error);
        return;
      }

      // Only the current drawer can choose a word
      const drawer = room.game.getCurrentDrawer();
      if (drawer.id !== socketInfo.playerId) {
        const error = { success: false, error: 'Only the drawer can choose a word' };
        if (callback) callback(error);
        return;
      }

      if (room.game.phase !== 'CHOOSING_WORD') {
        const error = { success: false, error: 'Not in word choosing phase' };
        if (callback) callback(error);
        return;
      }

      // Select the word
      room.game.selectWord(word);

      console.log(`[Game] Word chosen in room ${room.id}: ${word}`);

      if (callback) callback({ success: true });

      // Set up timer callbacks
      setupTimerCallbacks(io, room);

      // Emit drawing phase to all players
      const hint = room.game.getInitialHint();

      // Send to drawer (with the actual word)
      io.to(drawer.socketId).emit('drawing_phase', {
        drawerId: drawer.id,
        drawerName: drawer.name,
        wordLength: word.length,
        word: word, // Drawer gets the actual word
        hint: word,
        drawTime: room.settings.drawTime,
      });

      // Send to everyone else (with hint only)
      socket.to(room.id).emit('drawing_phase', {
        drawerId: drawer.id,
        drawerName: drawer.name,
        wordLength: word.length,
        hint: hint,
        drawTime: room.settings.drawTime,
      });
    } catch (err) {
      console.error('[Game] Error choosing word:', err);
      const error = { success: false, error: 'Failed to choose word' };
      if (callback) callback(error);
    }
  });

  // ---- PLAY AGAIN ----
  socket.on('play_again', (payload: PlayAgainPayload, callback?: (response: unknown) => void) => {
    try {
      const { roomId } = payload;
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

      // Only host can trigger play again
      if (room.host?.id !== socketInfo.playerId) {
        const error = { success: false, error: 'Only the host can restart the game' };
        if (callback) callback(error);
        return;
      }

      console.log(`[Game] Play again in room ${room.id}`);

      // Reset the game
      room.resetForNewGame();

      if (callback) callback({ success: true });

      // Notify all players
      room.broadcast(io, 'return_to_lobby', {
        room: room.toJSON(),
      });
    } catch (err) {
      console.error('[Game] Error restarting game:', err);
      const error = { success: false, error: 'Failed to restart game' };
      if (callback) callback(error);
    }
  });
}

function setupWordChoiceTimeout(io: SocketIOServer, room: Room): void {
  if (!room.game) return;

  const choiceTimeout = setTimeout(() => {
    if (!room.game || room.game.phase !== 'CHOOSING_WORD') return;

    // Auto-select the first word
    const options = room.game.wordOptions;
    if (options.length > 0) {
      const autoWord = options[0].word;
      room.game.selectWord(autoWord);

      console.log(`[Game] Auto-selected word in room ${room.id}: ${autoWord}`);

      setupTimerCallbacks(io, room);

      const drawer = room.game.getCurrentDrawer();
      const hint = room.game.getInitialHint();

      // Send to drawer
      io.to(drawer.socketId).emit('drawing_phase', {
        drawerId: drawer.id,
        drawerName: drawer.name,
        wordLength: autoWord.length,
        word: autoWord,
        hint: autoWord,
        drawTime: room.settings.drawTime,
      });

      // Send to everyone else
      io.to(room.id).except(drawer.socketId).emit('drawing_phase', {
        drawerId: drawer.id,
        drawerName: drawer.name,
        wordLength: autoWord.length,
        hint: hint,
        drawTime: room.settings.drawTime,
      });
    }
  }, 15000); // 15 seconds to choose

  // Store the timeout so we can clear it if word is chosen
  (room.game as any)._wordChoiceTimeout = choiceTimeout;
}

function setupTimerCallbacks(io: SocketIOServer, room: Room): void {
  if (!room.game) return;

  // Clear word choice timeout if it exists
  if ((room.game as any)._wordChoiceTimeout) {
    clearTimeout((room.game as any)._wordChoiceTimeout);
    (room.game as any)._wordChoiceTimeout = null;
  }

  room.game.onTimerTick = (timeRemaining: number) => {
    room.broadcast(io, 'timer_tick', { timeRemaining });
  };

  room.game.onHintUpdate = (hint: string) => {
    if (!room.game) return;
    const drawer = room.game.getCurrentDrawer();

    // Send hint to everyone except the drawer
    io.to(room.id).except(drawer.socketId).emit('hint_update', { hint });
  };

  room.game.onRoundEnd = () => {
    handleRoundEnd(io, room);
  };
}

function handleRoundEnd(io: SocketIOServer, room: Room): void {
  if (!room.game) return;

  const roundResult = room.game.endRound();

  console.log(`[Game] Round ${roundResult.round} ended in room ${room.id}. Word was: ${roundResult.word}`);

  room.broadcast(io, 'round_end', {
    word: roundResult.word,
    scores: roundResult.scores,
    round: roundResult.round,
  });

  // Wait 5 seconds then start next round or end game
  setTimeout(() => {
    if (!room.game || room.players.size < 2) {
      if (room.game) {
        room.game.destroy();
        room.game = null;
      }
      room.broadcast(io, 'game_ended', {
        reason: 'Not enough players',
        room: room.toJSON(),
      });
      return;
    }

    if (room.game.shouldEndGame()) {
      const gameResult = room.game.endGame();
      room.saveScores();

      console.log(`[Game] Game over in room ${room.id}. Winner: ${gameResult.winner.playerName}`);

      room.broadcast(io, 'game_over', {
        winner: gameResult.winner,
        scores: gameResult.scores,
        word: roundResult.word,
      });
    } else {
      // Start next round
      const roundInfo = room.game.startRound();

      if (room.game.phase === 'GAME_OVER') {
        const gameResult = room.game.endGame();
        room.saveScores();
        room.broadcast(io, 'game_over', {
          winner: gameResult.winner,
          scores: gameResult.scores,
          word: roundResult.word,
        });
        return;
      }

      // Broadcast round start
      room.broadcast(io, 'round_start', {
        round: roundInfo.round,
        totalRounds: room.game.totalRounds,
        drawerId: roundInfo.drawerId,
        drawerName: roundInfo.drawerName,
      });

      // Send word options only to the drawer
      const drawer = room.game.getCurrentDrawer();
      io.to(drawer.socketId).emit('word_options', {
        words: roundInfo.wordOptions,
      });

      // Setup word choice timeout
      setupWordChoiceTimeout(io, room);
    }
  }, 5000);
}
