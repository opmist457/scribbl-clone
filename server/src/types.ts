// ============================================================
// types.ts - All TypeScript interfaces for the skribbl.io clone
// ============================================================

// ---- Core Data Types ----

export interface PlayerData {
  id: string;
  socketId: string;
  name: string;
  avatarColor: string;
  score: number;
  hasGuessedCorrectly: boolean;
  isHost: boolean;
  roundScore: number;
}

export interface RoomSettings {
  maxPlayers: number;       // 2-20
  rounds: number;           // 2-10
  drawTime: number;         // 15-240 seconds
  wordCount: number;        // 1-5 (number of word options to choose from)
  hintsCount: number;       // 0-5
  wordMode: 'normal' | 'hidden';
  customWords: string[];
}

export type GamePhase = 'LOBBY' | 'CHOOSING_WORD' | 'DRAWING' | 'ROUND_END' | 'GAME_OVER';

export interface StrokeData {
  type: 'start' | 'move' | 'end';
  x: number;
  y: number;
  color: string;
  size: number;
  tool: 'brush' | 'eraser';
}

export interface DrawStroke {
  id: string;
  points: StrokeData[];
}

export interface ChatMessage {
  playerId: string;
  playerName: string;
  text: string;
  type: 'chat' | 'guess' | 'system' | 'correct';
  timestamp: number;
}

export interface RoomState {
  id: string;
  players: PlayerData[];
  hostId: string;
  settings: RoomSettings;
  game: GameState | null;
  createdAt: number;
}

export interface GameState {
  currentRound: number;
  totalRounds: number;
  currentDrawerId: string;
  currentDrawerName: string;
  phase: GamePhase;
  wordLength: number;
  hint: string;
  timeRemaining: number;
  drawTime: number;
  scoreboard: ScoreEntry[];
}

export interface ScoreEntry {
  playerId: string;
  playerName: string;
  score: number;
  roundScore: number;
  avatarColor: string;
}

export interface WordOption {
  word: string;
  category: string;
  difficulty: string;
}

// ---- WebSocket Event Payloads ----

// Client -> Server Events
export interface CreateRoomPayload {
  playerName: string;
  avatarColor: string;
}

export interface JoinRoomPayload {
  roomId: string;
  playerName: string;
  avatarColor: string;
}

export interface UpdateSettingsPayload {
  roomId: string;
  settings: Partial<RoomSettings>;
}

export interface AddCustomWordsPayload {
  roomId: string;
  words: string[];
}

export interface StartGamePayload {
  roomId: string;
}

export interface WordChosenPayload {
  roomId: string;
  word: string;
}

export interface DrawPayload {
  roomId: string;
  stroke: StrokeData;
  strokeId?: string;
}

export interface CanvasClearPayload {
  roomId: string;
}

export interface DrawUndoPayload {
  roomId: string;
  count: number;
}

export interface GuessPayload {
  roomId: string;
  text: string;
}

export interface ChatPayload {
  roomId: string;
  text: string;
}

export interface PlayAgainPayload {
  roomId: string;
}

export interface LeaveRoomPayload {
  roomId: string;
}

// Server -> Client Events
export interface RoomCreatedEvent {
  roomId: string;
  room: RoomState;
}

export interface PlayerJoinedEvent {
  player: PlayerData;
  room: RoomState;
}

export interface PlayerLeftEvent {
  playerId: string;
  playerName: string;
  newHostId: string | null;
  room: RoomState;
}

export interface SettingsUpdatedEvent {
  settings: RoomSettings;
}

export interface GameStartedEvent {
  game: GameState;
}

export interface RoundStartEvent {
  round: number;
  totalRounds: number;
  drawerId: string;
  drawerName: string;
  wordOptions?: WordOption[];  // only sent to the drawer
}

export interface DrawingPhaseEvent {
  drawerId: string;
  drawerName: string;
  wordLength: number;
  hint: string;
  drawTime: number;
}

export interface TimerTickEvent {
  timeRemaining: number;
}

export interface HintUpdateEvent {
  hint: string;
}

export interface GuessResultEvent {
  playerId: string;
  playerName: string;
  correct: boolean;
  score: number;
  totalScore: number;
  message: string;
}

export interface CloseGuessEvent {
  message: string;
}

export interface RoundEndEvent {
  word: string;
  scores: ScoreEntry[];
  round: number;
}

export interface GameOverEvent {
  winner: ScoreEntry;
  scores: ScoreEntry[];
  word: string;
}

export interface DrawDataEvent {
  stroke: StrokeData;
  strokeId?: string;
  playerId: string;
}

export interface CanvasClearedEvent {
  playerId: string;
}

export interface DrawUndoEvent {
  playerId: string;
}

export interface CanvasStateEvent {
  strokes: DrawStroke[];
}

export interface ErrorEvent {
  message: string;
  code?: string;
}
