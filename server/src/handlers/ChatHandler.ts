import { Server as SocketIOServer, Socket } from 'socket.io';
import { Room } from '../models/Room';
import { getSocketRoom } from './RoomHandler';
import { GuessPayload, ChatPayload } from '../types';

export function registerChatHandlers(
  io: SocketIOServer,
  socket: Socket,
  rooms: Map<string, Room>
): void {
  // ---- GUESS ----
  socket.on('guess', (payload: GuessPayload) => {
    try {
      const { roomId, text } = payload;

      if (!text || text.trim().length === 0) return;

      const room = rooms.get(roomId);
      if (!room || !room.game || room.game.phase !== 'DRAWING') return;

      const socketInfo = getSocketRoom(socket.id);
      if (!socketInfo) return;

      const player = room.getPlayerById(socketInfo.playerId);
      if (!player) return;

      // If the player is the drawer, ignore guesses (but they can chat)
      const drawer = room.game.getCurrentDrawer();
      if (player.id === drawer.id) {
        // Drawer's message goes as regular chat
        room.broadcast(io, 'chat_message', {
          playerId: player.id,
          playerName: player.name,
          text: text.trim(),
          type: 'chat',
          timestamp: Date.now(),
        });
        return;
      }

      // If player has already guessed correctly, don't show their messages to non-guessers
      if (player.hasGuessedCorrectly) {
        // Only send to other players who have also guessed correctly and the drawer
        const correctGuessers = Array.from(room.players.values())
          .filter(p => p.hasGuessedCorrectly || p.id === drawer.id);

        for (const guesser of correctGuessers) {
          io.to(guesser.socketId).emit('chat_message', {
            playerId: player.id,
            playerName: player.name,
            text: text.trim(),
            type: 'chat',
            timestamp: Date.now(),
          });
        }
        return;
      }

      // Check the guess
      const result = room.game.checkGuess(socketInfo.playerId, text.trim());

      if (result.correct && result.player) {
        console.log(`[Chat] ${result.player.name} guessed correctly in room ${room.id}`);

        // Send correct guess notification to the guesser
        socket.emit('guess_result', {
          playerId: result.player.id,
          playerName: result.player.name,
          correct: true,
          score: result.score,
          totalScore: result.totalScore,
          message: `You guessed the word! +${result.score} points`,
        });

        // Broadcast to others that someone guessed correctly (without revealing the word)
        socket.to(room.id).emit('chat_message', {
          playerId: result.player.id,
          playerName: result.player.name,
          text: `${result.player.name} guessed the word!`,
          type: 'correct',
          timestamp: Date.now(),
        });

        // Update scoreboard for everyone
        room.broadcast(io, 'scoreboard_update', {
          scores: room.game.getScoreboard(),
        });

        // Check if all players have guessed
        if (room.game.allPlayersGuessed()) {
          console.log(`[Chat] All players guessed in room ${room.id}, ending round early`);

          // Small delay before ending round
          setTimeout(() => {
            if (!room.game) return;

            const roundResult = room.game.endRound();

            room.broadcast(io, 'round_end', {
              word: roundResult.word,
              scores: roundResult.scores,
              round: roundResult.round,
              reason: 'All players guessed correctly!',
            });

            // Start next round after delay
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
                room.broadcast(io, 'game_over', {
                  winner: gameResult.winner,
                  scores: gameResult.scores,
                  word: roundResult.word,
                });
              } else {
                startNextRoundFromChat(io, room);
              }
            }, 5000);
          }, 1000);
        }
      } else if (result.close) {
        // Close guess - only notify the guesser privately
        socket.emit('close_guess', {
          message: 'You are close!',
        });

        // Still broadcast the guess as a normal chat message
        room.broadcast(io, 'chat_message', {
          playerId: socketInfo.playerId,
          playerName: player.name,
          text: text.trim(),
          type: 'guess',
          timestamp: Date.now(),
        });
      } else {
        // Wrong guess - broadcast as normal chat message
        room.broadcast(io, 'chat_message', {
          playerId: socketInfo.playerId,
          playerName: player.name,
          text: text.trim(),
          type: 'guess',
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      console.error('[Chat] Error handling guess:', err);
    }
  });

  // ---- CHAT ----
  socket.on('chat', (payload: ChatPayload) => {
    try {
      const { roomId, text } = payload;

      if (!text || text.trim().length === 0) return;

      const room = rooms.get(roomId);
      if (!room) return;

      const socketInfo = getSocketRoom(socket.id);
      if (!socketInfo) return;

      const player = room.getPlayerById(socketInfo.playerId);
      if (!player) return;

      // During the drawing phase, all messages from non-drawers are treated as guesses
      if (room.game && room.game.phase === 'DRAWING') {
        const drawer = room.game.getCurrentDrawer();
        if (player.id !== drawer.id && !player.hasGuessedCorrectly) {
          // Redirect to guess handler
          socket.emit('redirect_to_guess', { message: 'During drawing phase, your messages are treated as guesses' });
          return;
        }
      }

      // Broadcast chat message
      room.broadcast(io, 'chat_message', {
        playerId: player.id,
        playerName: player.name,
        text: text.trim(),
        type: 'chat',
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('[Chat] Error handling chat:', err);
    }
  });
}

function startNextRoundFromChat(io: SocketIOServer, room: Room): void {
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
}
