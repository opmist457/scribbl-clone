import { v4 as uuidv4 } from 'uuid';
import { Server as SocketIOServer } from 'socket.io';
import { Player } from './Player';
import { Game } from './Game';
import { wordManager } from './WordManager';
import { getDb, saveDb } from '../database/db';
import { RoomSettings, RoomState } from '../types';

const DEFAULT_SETTINGS: RoomSettings = {
  maxPlayers: 8,
  rounds: 3,
  drawTime: 80,
  wordCount: 3,
  hintsCount: 2,
  wordMode: 'normal',
  customWords: [],
};

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export class Room {
  public id: string;
  public players: Map<string, Player>;
  public host: Player | null;
  public settings: RoomSettings;
  public game: Game | null;
  public createdAt: number;

  constructor(host: Player, settings?: Partial<RoomSettings>) {
    this.id = generateRoomCode();
    this.players = new Map();
    this.host = host;
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.game = null;
    this.createdAt = Date.now();

    this.players.set(host.id, host);
    this.saveToDb();
  }

  private saveToDb(): void {
    try {
      const db = getDb();
      db.run(
        'INSERT OR REPLACE INTO rooms (id, host_id, settings, status) VALUES (?, ?, ?, ?)',
        [this.id, this.host?.id || '', JSON.stringify(this.settings), this.game ? 'playing' : 'lobby']
      );
      saveDb();
    } catch (err) {
      console.error('Error saving room to DB:', err);
    }
  }

  private savePlayerToDb(player: Player): void {
    try {
      const db = getDb();
      db.run(
        'INSERT OR REPLACE INTO players (id, room_id, socket_id, name, avatar_color, score) VALUES (?, ?, ?, ?, ?, ?)',
        [player.id, this.id, player.socketId, player.name, player.avatarColor, player.score]
      );
      saveDb();
    } catch (err) {
      console.error('Error saving player to DB:', err);
    }
  }

  private removePlayerFromDb(playerId: string): void {
    try {
      const db = getDb();
      db.run('DELETE FROM players WHERE id = ?', [playerId]);
      saveDb();
    } catch (err) {
      console.error('Error removing player from DB:', err);
    }
  }

  addPlayer(player: Player): { success: boolean; error?: string } {
    if (this.players.size >= this.settings.maxPlayers) {
      return { success: false, error: 'Room is full' };
    }

    this.players.set(player.id, player);
    this.savePlayerToDb(player);

    if (this.game && this.game.phase !== 'LOBBY' && this.game.phase !== 'GAME_OVER') {
      this.game.players.push(player);
    }

    return { success: true };
  }

  removePlayer(playerId: string): {
    removed: boolean;
    wasHost: boolean;
    newHost: Player | null;
    wasDrawer: boolean;
    isEmpty: boolean;
    playerName: string;
  } {
    const player = this.players.get(playerId);
    if (!player) {
      return { removed: false, wasHost: false, newHost: null, wasDrawer: false, isEmpty: false, playerName: '' };
    }

    const wasHost = player.isHost;
    const playerName = player.name;
    let wasDrawer = false;

    if (this.game && this.game.phase !== 'LOBBY' && this.game.phase !== 'GAME_OVER') {
      const result = this.game.removePlayer(playerId);
      wasDrawer = result.wasDrawer;
    }

    this.players.delete(playerId);
    this.removePlayerFromDb(playerId);

    let newHost: Player | null = null;
    if (wasHost && this.players.size > 0) {
      const firstPlayer = this.players.values().next().value as Player;
      firstPlayer.isHost = true;
      this.host = firstPlayer;
      newHost = firstPlayer;
      this.saveToDb();
    }

    if (this.players.size === 0) {
      this.host = null;
    }

    return {
      removed: true,
      wasHost,
      newHost,
      wasDrawer,
      isEmpty: this.players.size === 0,
      playerName,
    };
  }

  updateSettings(settings: Partial<RoomSettings>, requesterId: string): { success: boolean; error?: string } {
    if (this.host?.id !== requesterId) {
      return { success: false, error: 'Only the host can update settings' };
    }

    if (this.game && this.game.phase !== 'LOBBY') {
      return { success: false, error: 'Cannot update settings during a game' };
    }

    const newSettings = { ...this.settings };

    if (settings.maxPlayers !== undefined) {
      newSettings.maxPlayers = Math.max(2, Math.min(20, settings.maxPlayers));
    }
    if (settings.rounds !== undefined) {
      newSettings.rounds = Math.max(2, Math.min(10, settings.rounds));
    }
    if (settings.drawTime !== undefined) {
      newSettings.drawTime = Math.max(15, Math.min(240, settings.drawTime));
    }
    if (settings.wordCount !== undefined) {
      newSettings.wordCount = Math.max(1, Math.min(5, settings.wordCount));
    }
    if (settings.hintsCount !== undefined) {
      newSettings.hintsCount = Math.max(0, Math.min(5, settings.hintsCount));
    }
    if (settings.wordMode !== undefined) {
      newSettings.wordMode = settings.wordMode;
    }
    if (settings.customWords !== undefined) {
      newSettings.customWords = settings.customWords;
    }

    this.settings = newSettings;
    this.saveToDb();

    return { success: true };
  }

  addCustomWords(words: string[], requesterId: string): { success: boolean; error?: string } {
    if (this.host?.id !== requesterId) {
      return { success: false, error: 'Only the host can add custom words' };
    }

    wordManager.addCustomWords(this.id, words);
    this.settings.customWords = [
      ...this.settings.customWords,
      ...words.filter(w => w.trim().length > 0),
    ];
    this.saveToDb();

    return { success: true };
  }

  startGame(): { success: boolean; error?: string } {
    if (this.players.size < 2) {
      return { success: false, error: 'Need at least 2 players to start' };
    }

    wordManager.loadWords();

    const playersArray = Array.from(this.players.values());
    this.game = new Game(playersArray, this.settings, this.id);

    try {
      const db = getDb();
      db.run('UPDATE rooms SET status = ? WHERE id = ?', ['playing', this.id]);
      saveDb();
    } catch (err) {
      console.error('Error updating room status:', err);
    }

    return { success: true };
  }

  saveScores(): void {
    try {
      const db = getDb();
      for (const player of this.players.values()) {
        db.run(
          "INSERT INTO scores (player_name, room_id, score, played_at) VALUES (?, ?, ?, datetime('now'))",
          [player.name, this.id, player.score]
        );
      }
      saveDb();
    } catch (err) {
      console.error('Error saving scores:', err);
    }
  }

  resetForNewGame(): void {
    for (const player of this.players.values()) {
      player.score = 0;
      player.hasGuessedCorrectly = false;
      player.roundScore = 0;
    }

    if (this.game) {
      this.game.destroy();
      this.game = null;
    }

    try {
      const db = getDb();
      db.run('UPDATE rooms SET status = ? WHERE id = ?', ['lobby', this.id]);
      saveDb();
    } catch (err) {
      console.error('Error resetting room status:', err);
    }
  }

  broadcast(io: SocketIOServer, event: string, data: unknown): void {
    io.to(this.id).emit(event, data);
  }

  broadcastExcept(io: SocketIOServer, event: string, data: unknown, excludeSocketId: string): void {
    io.to(this.id).except(excludeSocketId).emit(event, data);
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  getPlayerBySocketId(socketId: string): Player | undefined {
    for (const player of this.players.values()) {
      if (player.socketId === socketId) {
        return player;
      }
    }
    return undefined;
  }

  getPlayerById(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  cleanup(): void {
    if (this.game) {
      this.game.destroy();
    }

    try {
      const db = getDb();
      db.run('DELETE FROM players WHERE room_id = ?', [this.id]);
      db.run('DELETE FROM custom_words WHERE room_id = ?', [this.id]);
      db.run('DELETE FROM rooms WHERE id = ?', [this.id]);
      saveDb();
    } catch (err) {
      console.error('Error cleaning up room:', err);
    }
  }

  toJSON(): RoomState {
    const playersArray = Array.from(this.players.values()).map(p => p.toJSON());

    return {
      id: this.id,
      players: playersArray,
      hostId: this.host?.id || '',
      settings: this.settings,
      game: this.game ? this.game.toJSON() : null,
      createdAt: this.createdAt,
    };
  }
}
