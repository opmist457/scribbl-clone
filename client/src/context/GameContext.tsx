import React, { createContext, useContext, useEffect, useReducer, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from './SocketContext';
import type {
  Player,
  RoomSettings,
  GameState,
  GamePhase,
  ChatMessage,
  DrawEventData,
  RoomState,
} from '../types';

/* ---- Default Settings (must match server) ---- */
const DEFAULT_SETTINGS: RoomSettings = {
  maxPlayers: 8,
  rounds: 3,
  drawTime: 80,
  wordCount: 3,
  hintsCount: 2,
  wordMode: 'normal',
  customWords: [],
};

/* ---- State Shape ---- */
interface GameContextState {
  roomId: string | null;
  players: Player[];
  settings: RoomSettings;
  gameState: GameState;
  messages: ChatMessage[];
  myPlayerId: string | null;
  myPlayer: Player | null;
  isHost: boolean;
  isDrawer: boolean;
  error: string | null;
}

const initialGameState: GameState = {
  phase: 'waiting',
  currentRound: 0,
  totalRounds: 3,
  currentDrawer: null,
  currentWord: null,
  wordHint: '',
  wordLength: 0,
  timeRemaining: 0,
  totalTime: 80,
  wordChoices: [],
  correctWord: null,
  scores: {},
};

const initialState: GameContextState = {
  roomId: null,
  players: [],
  settings: { ...DEFAULT_SETTINGS },
  gameState: { ...initialGameState },
  messages: [],
  myPlayerId: null,
  myPlayer: null,
  isHost: false,
  isDrawer: false,
  error: null,
};

/* ---- Actions ---- */
type GameAction =
  | { type: 'SET_PLAYER_ID'; payload: string }
  | { type: 'ROOM_CREATED'; payload: { roomId: string; room: RoomState; myPlayerId: string } }
  | { type: 'ROOM_JOINED'; payload: { roomId: string; playerId: string; room: RoomState } }
  | { type: 'PLAYER_JOINED'; payload: { player: Player } }
  | { type: 'PLAYER_LEFT'; payload: { playerId: string; newHostId: string | null } }
  | { type: 'SETTINGS_UPDATED'; payload: { settings: RoomSettings } }
  | { type: 'GAME_STARTED'; payload: { game: any } }
  | { type: 'ROUND_START'; payload: { round: number; totalRounds: number; drawerId: string; drawerName: string } }
  | { type: 'WORD_OPTIONS'; payload: { words: Array<{ word: string }> } }
  | { type: 'DRAWING_PHASE'; payload: { drawerId: string; wordLength: number; word?: string; hint: string; drawTime: number } }
  | { type: 'TIMER_TICK'; payload: { timeRemaining: number } }
  | { type: 'HINT_UPDATE'; payload: { hint: string } }
  | { type: 'ROUND_END'; payload: { word: string; scores: Record<string, number> } }
  | { type: 'GAME_OVER'; payload: { scores: Record<string, number> } }
  | { type: 'CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'CORRECT_GUESS'; payload: { playerId: string; playerName: string } }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'LEAVE_ROOM' }
  | { type: 'RETURN_TO_LOBBY'; payload: { room: RoomState } };

/* ---- Helper: extract players from RoomState ---- */
function extractPlayers(room: RoomState): Player[] {
  if (room.players && Array.isArray(room.players)) return room.players;
  return [];
}

/* ---- Reducer ---- */
function gameReducer(state: GameContextState, action: GameAction): GameContextState {
  switch (action.type) {
    case 'SET_PLAYER_ID':
      if (!state.myPlayerId) {
        return { ...state, myPlayerId: action.payload };
      }
      return state;

    case 'ROOM_CREATED': {
      const { roomId, room, myPlayerId } = action.payload;
      const players = extractPlayers(room);
      const me = players.find(p => p.id === myPlayerId) || players[0];
      return {
        ...state,
        roomId,
        players,
        settings: room.settings || { ...DEFAULT_SETTINGS },
        myPlayerId,
        myPlayer: me || null,
        isHost: true,
        error: null,
      };
    }

    case 'ROOM_JOINED': {
      const { roomId, playerId, room } = action.payload;
      const players = extractPlayers(room);
      const me = players.find(p => p.id === playerId);
      return {
        ...state,
        roomId,
        players,
        settings: room.settings || { ...DEFAULT_SETTINGS },
        myPlayerId: playerId,
        myPlayer: me || null,
        isHost: me?.isHost || false,
        error: null,
      };
    }

    case 'PLAYER_JOINED': {
      const exists = state.players.some(p => p.id === action.payload.player.id);
      const newPlayers = exists
        ? state.players.map(p => p.id === action.payload.player.id ? action.payload.player : p)
        : [...state.players, action.payload.player];
      return { ...state, players: newPlayers };
    }

    case 'PLAYER_LEFT': {
      const { playerId, newHostId } = action.payload;
      let newPlayers = state.players.filter(p => p.id !== playerId);
      if (newHostId) {
        newPlayers = newPlayers.map(p => ({
          ...p,
          isHost: p.id === newHostId,
        }));
      }
      return {
        ...state,
        players: newPlayers,
        isHost: newHostId === state.myPlayerId ? true : (newHostId ? false : state.isHost),
      };
    }

    case 'SETTINGS_UPDATED':
      return { ...state, settings: action.payload.settings };

    case 'GAME_STARTED':
      return {
        ...state,
        gameState: {
          ...state.gameState,
          phase: 'choosing',
        },
        messages: [],
      };

    case 'ROUND_START': {
      const { round, totalRounds, drawerId } = action.payload;
      const isMe = drawerId === state.myPlayerId;
      return {
        ...state,
        gameState: {
          ...state.gameState,
          phase: 'choosing',
          currentRound: round,
          totalRounds,
          currentDrawer: drawerId,
          wordChoices: [],
          currentWord: null,
          correctWord: null,
          wordHint: '',
          wordLength: 0,
        },
        isDrawer: isMe,
        players: state.players.map(p => ({
          ...p,
          isDrawing: p.id === drawerId,
          hasGuessedCorrectly: false,
        })),
      };
    }

    case 'WORD_OPTIONS': {
      return {
        ...state,
        gameState: {
          ...state.gameState,
          wordChoices: action.payload.words.map(w => w.word),
        },
      };
    }

    case 'DRAWING_PHASE': {
      const { drawerId, wordLength, word, hint, drawTime } = action.payload;
      return {
        ...state,
        gameState: {
          ...state.gameState,
          phase: 'drawing',
          currentDrawer: drawerId,
          wordLength,
          currentWord: word || null,
          wordHint: hint || '_'.repeat(wordLength).split('').join(' '),
          totalTime: drawTime,
          timeRemaining: drawTime,
          wordChoices: [],
        },
        isDrawer: drawerId === state.myPlayerId,
      };
    }

    case 'TIMER_TICK':
      return {
        ...state,
        gameState: {
          ...state.gameState,
          timeRemaining: action.payload.timeRemaining,
        },
      };

    case 'HINT_UPDATE':
      return {
        ...state,
        gameState: {
          ...state.gameState,
          wordHint: action.payload.hint,
        },
      };

    case 'ROUND_END': {
      const { word, scores } = action.payload;
      const scoreMap: Record<string, number> = {};
      if (Array.isArray(scores)) {
        scores.forEach((s: any) => { scoreMap[s.playerId] = s.score; });
      } else {
        Object.assign(scoreMap, scores);
      }
      return {
        ...state,
        gameState: {
          ...state.gameState,
          phase: 'round_end',
          correctWord: word,
          scores: scoreMap,
        },
        players: state.players.map(p => ({
          ...p,
          score: scoreMap[p.id] ?? p.score,
        })),
      };
    }

    case 'GAME_OVER': {
      const { scores } = action.payload;
      const scoreMap: Record<string, number> = {};
      if (Array.isArray(scores)) {
        scores.forEach((s: any) => { scoreMap[s.playerId] = s.score; });
      } else {
        Object.assign(scoreMap, scores);
      }
      return {
        ...state,
        gameState: {
          ...state.gameState,
          phase: 'game_over',
          scores: scoreMap,
        },
        players: state.players.map(p => ({
          ...p,
          score: scoreMap[p.id] ?? p.score,
        })),
      };
    }

    case 'CHAT_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };

    case 'CORRECT_GUESS': {
      const { playerId } = action.payload;
      return {
        ...state,
        players: state.players.map(p =>
          p.id === playerId ? { ...p, hasGuessedCorrectly: true } : p
        ),
      };
    }

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'LEAVE_ROOM':
      return { ...initialState, myPlayerId: state.myPlayerId };

    case 'RETURN_TO_LOBBY': {
      const { room } = action.payload;
      const players = extractPlayers(room);
      const me = players.find(p => p.id === state.myPlayerId);
      return {
        ...state,
        players,
        settings: room.settings || state.settings,
        gameState: { ...initialGameState },
        isHost: me?.isHost || false,
        isDrawer: false,
        messages: [],
      };
    }

    default:
      return state;
  }
}

/* ---- Context ---- */
interface GameContextValue extends GameContextState {
  dispatch: React.Dispatch<GameAction>;
  createRoom: (playerName: string, avatarColor: string) => void;
  joinRoom: (roomId: string, playerName: string, avatarColor: string) => void;
  leaveRoom: () => void;
  updateSettings: (settings: Partial<RoomSettings>) => void;
  addCustomWords: (words: string[]) => void;
  startGame: () => void;
  chooseWord: (word: string) => void;
  sendMessage: (message: string) => void;
  playAgain: () => void;
  sendDrawData: (data: DrawEventData) => void;
  clearCanvas: () => void;
  undoStroke: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export const useGame = (): GameContextValue => {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return ctx;
};

/* ---- Provider ---- */
interface GameProviderProps {
  children: React.ReactNode;
}

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const { socket } = useSocket();
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const navigate = useNavigate();

  // Use ref to track roomId in cleanup without re-registering listeners
  const stateRef = useRef(state);
  stateRef.current = state;

  // Register all socket listeners
  useEffect(() => {
    if (!socket) return;

    // --- Connection ---
    const handleConnect = () => {
      if (socket.id) {
        dispatch({ type: 'SET_PLAYER_ID', payload: socket.id });
      }
    };

    if (socket.connected && socket.id) {
      dispatch({ type: 'SET_PLAYER_ID', payload: socket.id });
    }

    socket.on('connect', handleConnect);

    // --- Room events ---
    socket.on('room_created', (data: any) => {
      const myId = data.playerId || data.room?.players?.[0]?.id || socket.id || '';
      dispatch({ type: 'ROOM_CREATED', payload: { roomId: data.roomId, room: data.room, myPlayerId: myId } });
      navigate(`/lobby/${data.roomId}`);
    });

    socket.on('room_joined', (data: any) => {
      dispatch({ type: 'ROOM_JOINED', payload: { roomId: data.roomId, playerId: data.playerId, room: data.room } });
      navigate(`/lobby/${data.roomId}`);
    });

    socket.on('player_joined', (data: any) => {
      dispatch({ type: 'PLAYER_JOINED', payload: { player: data.player } });
      dispatch({
        type: 'CHAT_MESSAGE',
        payload: {
          id: `sys-join-${Date.now()}`,
          playerName: data.player.name,
          playerId: 'system',
          content: `${data.player.name} joined the room`,
          type: 'join',
          timestamp: Date.now(),
        },
      });
    });

    socket.on('player_left', (data: any) => {
      dispatch({
        type: 'CHAT_MESSAGE',
        payload: {
          id: `sys-leave-${Date.now()}`,
          playerName: data.playerName || '',
          playerId: 'system',
          content: `${data.playerName || 'Someone'} left the room`,
          type: 'leave',
          timestamp: Date.now(),
        },
      });
      dispatch({ type: 'PLAYER_LEFT', payload: { playerId: data.playerId, newHostId: data.newHostId } });
    });

    socket.on('settings_updated', (data: any) => {
      dispatch({ type: 'SETTINGS_UPDATED', payload: data });
    });

    socket.on('error_event', (data: any) => {
      dispatch({ type: 'SET_ERROR', payload: data.message });
    });

    // --- Game events ---
    socket.on('game_started', (data: any) => {
      dispatch({ type: 'GAME_STARTED', payload: data });
      const roomId = stateRef.current.roomId;
      if (roomId) {
        navigate(`/game/${roomId}`);
      }
    });

    socket.on('round_start', (data: any) => {
      dispatch({ type: 'ROUND_START', payload: data });
    });

    socket.on('word_options', (data: any) => {
      dispatch({ type: 'WORD_OPTIONS', payload: data });
    });

    socket.on('drawing_phase', (data: any) => {
      dispatch({ type: 'DRAWING_PHASE', payload: data });
    });

    socket.on('timer_tick', (data: any) => {
      dispatch({ type: 'TIMER_TICK', payload: data });
    });

    socket.on('hint_update', (data: any) => {
      dispatch({ type: 'HINT_UPDATE', payload: data });
    });

    socket.on('round_end', (data: any) => {
      dispatch({ type: 'ROUND_END', payload: data });
    });

    socket.on('game_over', (data: any) => {
      dispatch({ type: 'GAME_OVER', payload: { scores: data.scores } });
    });

    socket.on('game_ended', (data: any) => {
      dispatch({ type: 'SET_ERROR', payload: data.reason || 'Game ended' });
      const roomId = stateRef.current.roomId;
      if (roomId) navigate(`/lobby/${roomId}`);
    });

    socket.on('return_to_lobby', (data: any) => {
      dispatch({ type: 'RETURN_TO_LOBBY', payload: { room: data.room } });
      const roomId = stateRef.current.roomId;
      if (roomId) navigate(`/lobby/${roomId}`);
    });

    // --- Chat events ---
    socket.on('chat_message', (data: any) => {
      dispatch({
        type: 'CHAT_MESSAGE',
        payload: {
          id: `msg-${Date.now()}-${Math.random()}`,
          playerName: data.playerName,
          playerId: data.playerId,
          content: data.text,
          type: data.type === 'correct' ? 'correct_guess' : (data.type === 'guess' ? 'chat' : data.type),
          timestamp: data.timestamp,
        },
      });

      // If correct type, also mark the player
      if (data.type === 'correct') {
        dispatch({ type: 'CORRECT_GUESS', payload: { playerId: data.playerId, playerName: data.playerName } });
      }
    });

    socket.on('guess_result', (data: any) => {
      if (data.correct) {
        dispatch({ type: 'CORRECT_GUESS', payload: { playerId: data.playerId, playerName: data.playerName } });
        dispatch({
          type: 'CHAT_MESSAGE',
          payload: {
            id: `correct-${Date.now()}`,
            playerName: data.playerName,
            playerId: data.playerId,
            content: data.message || `${data.playerName} guessed the word!`,
            type: 'correct_guess',
            timestamp: Date.now(),
          },
        });
      }
    });

    socket.on('close_guess', (_data: any) => {
      dispatch({
        type: 'CHAT_MESSAGE',
        payload: {
          id: `close-${Date.now()}`,
          playerName: '',
          playerId: 'system',
          content: "That's close!",
          type: 'close_guess',
          timestamp: Date.now(),
        },
      });
    });

    socket.on('scoreboard_update', (_data: any) => {
      // Could update scores here but round_end handles it
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('player_joined');
      socket.off('player_left');
      socket.off('settings_updated');
      socket.off('error_event');
      socket.off('game_started');
      socket.off('round_start');
      socket.off('word_options');
      socket.off('drawing_phase');
      socket.off('timer_tick');
      socket.off('hint_update');
      socket.off('round_end');
      socket.off('game_over');
      socket.off('game_ended');
      socket.off('return_to_lobby');
      socket.off('chat_message');
      socket.off('guess_result');
      socket.off('close_guess');
      socket.off('scoreboard_update');
    };
  }, [socket, navigate]);

  // --- Actions ---
  const createRoom = useCallback((playerName: string, avatarColor: string) => {
    if (socket) {
      socket.emit('create_room', { playerName, avatarColor });
    }
  }, [socket]);

  const joinRoom = useCallback((roomId: string, playerName: string, avatarColor: string) => {
    if (socket) {
      socket.emit('join_room', { roomId: roomId.toUpperCase(), playerName, avatarColor });
    }
  }, [socket]);

  const leaveRoom = useCallback(() => {
    if (socket && stateRef.current.roomId) {
      socket.emit('leave_room', { roomId: stateRef.current.roomId });
      dispatch({ type: 'LEAVE_ROOM' });
      navigate('/');
    }
  }, [socket, navigate]);

  const updateSettings = useCallback((settings: Partial<RoomSettings>) => {
    if (socket && stateRef.current.roomId) {
      socket.emit('update_settings', { roomId: stateRef.current.roomId, settings });
    }
  }, [socket]);

  const addCustomWords = useCallback((words: string[]) => {
    if (socket && stateRef.current.roomId) {
      socket.emit('add_custom_words', { roomId: stateRef.current.roomId, words });
    }
  }, [socket]);

  const startGame = useCallback(() => {
    if (socket && stateRef.current.roomId) {
      socket.emit('start_game', { roomId: stateRef.current.roomId });
    }
  }, [socket]);

  // Client sends 'word_chosen' to match server listener
  const chooseWord = useCallback((word: string) => {
    if (socket && stateRef.current.roomId) {
      socket.emit('word_chosen', { roomId: stateRef.current.roomId, word });
    }
  }, [socket]);

  // During drawing phase send as 'guess', otherwise as 'chat'
  const sendMessage = useCallback((message: string) => {
    if (socket && stateRef.current.roomId) {
      const isDrawingPhase = stateRef.current.gameState.phase === 'drawing';
      if (isDrawingPhase) {
        socket.emit('guess', { roomId: stateRef.current.roomId, text: message });
      } else {
        socket.emit('chat', { roomId: stateRef.current.roomId, text: message });
      }
    }
  }, [socket]);

  const playAgain = useCallback(() => {
    if (socket && stateRef.current.roomId) {
      socket.emit('play_again', { roomId: stateRef.current.roomId });
    }
  }, [socket]);

  const sendDrawData = useCallback((data: DrawEventData) => {
    if (socket && stateRef.current.roomId) {
      socket.emit('draw', { roomId: stateRef.current.roomId, ...data });
    }
  }, [socket]);

  const clearCanvasFn = useCallback(() => {
    if (socket && stateRef.current.roomId) {
      socket.emit('clear_canvas', { roomId: stateRef.current.roomId });
    }
  }, [socket]);

  const undoStroke = useCallback(() => {
    if (socket && stateRef.current.roomId) {
      socket.emit('undo_stroke', { roomId: stateRef.current.roomId });
    }
  }, [socket]);

  const value: GameContextValue = {
    ...state,
    dispatch,
    createRoom,
    joinRoom,
    leaveRoom,
    updateSettings,
    addCustomWords,
    startGame,
    chooseWord,
    sendMessage,
    playAgain,
    sendDrawData,
    clearCanvas: clearCanvasFn,
    undoStroke,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};

export default GameContext;
