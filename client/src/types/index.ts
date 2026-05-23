/* ==============================
 * TYPES - Shared TypeScript Types
 * ============================== */

// Player
export interface Player {
  id: string;
  name: string;
  avatarColor: string;
  score: number;
  roundScore?: number;
  isHost: boolean;
  isDrawing: boolean;
  hasGuessedCorrectly: boolean;
  isConnected: boolean;
}

// Room Settings
export interface RoomSettings {
  maxPlayers: number;
  rounds: number;
  drawTime: number;
  wordCount: number;
  hintsCount: number;
  wordMode: 'normal' | 'hidden';
  customWords: string[];
}

// Game Phases
export type GamePhase =
  | 'waiting'
  | 'choosing'
  | 'drawing'
  | 'round_end'
  | 'game_over';

// Game State (client-side representation)
export interface GameState {
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  currentDrawer: string | null;
  currentWord: string | null;
  wordHint: string;
  wordLength: number;
  timeRemaining: number;
  totalTime: number;
  wordChoices: string[];
  correctWord: string | null;
  scores: Record<string, number>;
}

// Stroke / Drawing Data
export interface StrokePoint {
  x: number;
  y: number;
}

export interface StrokeData {
  points: StrokePoint[];
  color: string;
  size: number;
  tool: DrawTool;
}

export type DrawTool = 'brush' | 'eraser';

// Chat Message
export interface ChatMessage {
  id: string;
  playerName: string;
  playerId: string;
  content: string;
  type: 'chat' | 'correct_guess' | 'close_guess' | 'system' | 'join' | 'leave' | 'guess';
  timestamp: number;
}

// Room State (from server)
export interface RoomState {
  id: string;
  players: Player[];
  hostId: string;
  settings: RoomSettings;
  game: any;
  createdAt: number;
}

// Draw Event Data (sent over socket)
export interface DrawEventData {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  size: number;
  tool: DrawTool;
}

export interface ClearCanvasData {
  roomId: string;
}

export interface CanvasState {
  strokes: DrawEventData[];
}

// Socket Event Types — matching server exactly
export interface ServerToClientEvents {
  // Connection
  connect: () => void;
  disconnect: () => void;
  error_event: (data: { message: string }) => void;

  // Room
  room_created: (data: { roomId: string; room: RoomState }) => void;
  room_joined: (data: { roomId: string; playerId: string; room: RoomState }) => void;
  player_joined: (data: { player: Player; room: RoomState }) => void;
  player_left: (data: { playerId: string; playerName: string; newHostId: string | null; room: RoomState }) => void;
  settings_updated: (data: { settings: RoomSettings }) => void;
  custom_words_added: (data: { count: number }) => void;

  // Game
  game_started: (data: { game: any }) => void;
  round_start: (data: { round: number; totalRounds: number; drawerId: string; drawerName: string }) => void;
  word_options: (data: { words: Array<{ word: string; category: string; difficulty: string }> }) => void;
  drawing_phase: (data: { drawerId: string; drawerName: string; wordLength: number; word?: string; hint: string; drawTime: number }) => void;
  timer_tick: (data: { timeRemaining: number }) => void;
  hint_update: (data: { hint: string }) => void;
  round_end: (data: { word: string; scores: Record<string, number>; round: number; reason?: string }) => void;
  game_over: (data: { winner: any; scores: Record<string, number>; word: string }) => void;
  game_ended: (data: { reason: string; room: RoomState }) => void;
  return_to_lobby: (data: { room: RoomState }) => void;

  // Drawing
  draw_data: (data: { stroke: any; strokeId: string; playerId: string } | DrawEventData) => void;
  canvas_cleared: (data?: any) => void;
  canvas_state: (data: { strokes: DrawEventData[] }) => void;
  draw_undo: (data: { count: number }) => void;

  // Chat
  chat_message: (data: { playerId: string; playerName: string; text: string; type: string; timestamp: number }) => void;
  guess_result: (data: { playerId: string; playerName: string; correct: boolean; score: number; totalScore: number; message: string }) => void;
  close_guess: (data: { message: string }) => void;
  scoreboard_update: (data: { scores: any }) => void;
}

export interface ClientToServerEvents {
  // Room
  create_room: (data: { playerName: string; avatarColor: string }) => void;
  join_room: (data: { roomId: string; playerName: string; avatarColor: string }) => void;
  leave_room: (data: { roomId: string }) => void;
  update_settings: (data: { roomId: string; settings: Partial<RoomSettings> }) => void;
  add_custom_words: (data: { roomId: string; words: string[] }) => void;

  // Game
  start_game: (data: { roomId: string }) => void;
  word_chosen: (data: { roomId: string; word: string }) => void;

  // Drawing
  draw: (data: { roomId: string } & DrawEventData) => void;
  clear_canvas: (data: { roomId: string }) => void;
  draw_undo: (data: { roomId: string; count: number }) => void;

  // Chat — during drawing phase all messages become guesses
  guess: (data: { roomId: string; text: string }) => void;
  chat: (data: { roomId: string; text: string }) => void;

  // Play again
  play_again: (data: { roomId: string }) => void;
}
