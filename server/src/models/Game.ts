import { v4 as uuidv4 } from 'uuid';
import { Player } from './Player';
import { wordManager } from './WordManager';
import {
  RoomSettings,
  GamePhase,
  StrokeData,
  DrawStroke,
  ScoreEntry,
  WordOption,
  GameState,
} from '../types';

export class Game {
  public currentRound: number;
  public totalRounds: number;
  public currentDrawerIndex: number;
  public currentWord: string;
  public wordOptions: WordOption[];
  public phase: GamePhase;
  public strokes: DrawStroke[];
  public players: Player[];
  public settings: RoomSettings;
  public timer: NodeJS.Timeout | null;
  public hintTimer: NodeJS.Timeout | null;
  public hintLevel: number;
  public correctGuessers: Set<string>;
  public usedWords: string[];
  public roomId: string;

  private timeRemaining: number;
  private roundStartTime: number;
  private currentStrokeId: string | null;

  // Callbacks for emitting events
  public onTimerTick?: (timeRemaining: number) => void;
  public onHintUpdate?: (hint: string) => void;
  public onRoundEnd?: () => void;

  constructor(players: Player[], settings: RoomSettings, roomId: string) {
    this.currentRound = 0;
    this.totalRounds = settings.rounds;
    this.currentDrawerIndex = -1;
    this.currentWord = '';
    this.wordOptions = [];
    this.phase = 'LOBBY';
    this.strokes = [];
    this.players = players;
    this.settings = settings;
    this.timer = null;
    this.hintTimer = null;
    this.hintLevel = 0;
    this.correctGuessers = new Set();
    this.usedWords = [];
    this.roomId = roomId;
    this.timeRemaining = settings.drawTime;
    this.roundStartTime = 0;
    this.currentStrokeId = null;
  }

  startRound(): { drawerId: string; drawerName: string; wordOptions: WordOption[]; round: number } {
    // Advance drawer index in round-robin
    this.currentDrawerIndex++;

    // If we've gone through all players, start a new round
    if (this.currentDrawerIndex >= this.players.length) {
      this.currentDrawerIndex = 0;
      this.currentRound++;
    }

    // First call: also increment round
    if (this.currentRound === 0) {
      this.currentRound = 1;
    }

    // Check if game should end
    if (this.currentRound > this.totalRounds) {
      this.phase = 'GAME_OVER';
      return {
        drawerId: '',
        drawerName: '',
        wordOptions: [],
        round: this.currentRound,
      };
    }

    // Reset all player round states
    for (const player of this.players) {
      player.resetRoundState();
    }
    this.correctGuessers.clear();
    this.strokes = [];
    this.currentWord = '';
    this.hintLevel = 0;

    // Set phase to choosing
    this.phase = 'CHOOSING_WORD';

    // Get word options
    const wordCount = Math.max(1, Math.min(5, this.settings.wordCount));
    this.wordOptions = wordManager.getRandomWordsWithCustom(
      wordCount,
      this.roomId,
      this.usedWords
    );

    const drawer = this.getCurrentDrawer();

    return {
      drawerId: drawer.id,
      drawerName: drawer.name,
      wordOptions: this.wordOptions,
      round: this.currentRound,
    };
  }

  selectWord(word: string): void {
    this.currentWord = word;
    this.usedWords.push(word);
    this.phase = 'DRAWING';
    this.timeRemaining = this.settings.drawTime;
    this.roundStartTime = Date.now();
    this.hintLevel = 0;

    // Start the main timer
    this.startTimer();

    // Start hint timer if hints are enabled
    if (this.settings.hintsCount > 0) {
      this.startHintTimer();
    }
  }

  private startTimer(): void {
    this.clearTimers();

    this.timer = setInterval(() => {
      this.timeRemaining--;

      if (this.onTimerTick) {
        this.onTimerTick(this.timeRemaining);
      }

      if (this.timeRemaining <= 0) {
        this.clearTimers();
        if (this.onRoundEnd) {
          this.onRoundEnd();
        }
      }
    }, 1000);
  }

  private startHintTimer(): void {
    if (this.settings.hintsCount <= 0) return;

    const hintInterval = Math.floor((this.settings.drawTime * 1000) / (this.settings.hintsCount + 1));

    this.hintTimer = setInterval(() => {
      this.hintLevel++;

      if (this.hintLevel > this.settings.hintsCount) {
        if (this.hintTimer) {
          clearInterval(this.hintTimer);
          this.hintTimer = null;
        }
        return;
      }

      if (this.onHintUpdate) {
        const hint = this.getHint();
        this.onHintUpdate(hint);
      }
    }, hintInterval);
  }

  checkGuess(playerId: string, guess: string): {
    correct: boolean;
    close: boolean;
    score: number;
    totalScore: number;
    player: Player | null;
  } {
    const player = this.players.find(p => p.id === playerId);
    if (!player) {
      return { correct: false, close: false, score: 0, totalScore: 0, player: null };
    }

    // Can't guess if you're the drawer
    const drawer = this.getCurrentDrawer();
    if (player.id === drawer.id) {
      return { correct: false, close: false, score: 0, totalScore: player.score, player };
    }

    // Can't guess if already guessed correctly
    if (player.hasGuessedCorrectly) {
      return { correct: false, close: false, score: 0, totalScore: player.score, player };
    }

    // Check for correct guess
    if (wordManager.checkGuess(guess, this.currentWord)) {
      player.hasGuessedCorrectly = true;
      this.correctGuessers.add(playerId);

      // Calculate score based on order of guessing
      const guessOrder = this.correctGuessers.size;
      let baseScore: number;

      switch (guessOrder) {
        case 1: baseScore = 100; break;
        case 2: baseScore = 80; break;
        case 3: baseScore = 60; break;
        default: baseScore = 40; break;
      }

      // Time bonus: up to +50 based on remaining time
      const elapsedRatio = this.timeRemaining / this.settings.drawTime;
      const timeBonus = Math.floor(50 * elapsedRatio);
      const totalPoints = baseScore + timeBonus;

      player.addPoints(totalPoints);

      // Award drawer 25 points per correct guesser
      drawer.addPoints(25);

      return { correct: true, close: false, score: totalPoints, totalScore: player.score, player };
    }

    // Check for close guess
    if (wordManager.isCloseGuess(guess, this.currentWord)) {
      return { correct: false, close: true, score: 0, totalScore: player.score, player };
    }

    return { correct: false, close: false, score: 0, totalScore: player.score, player };
  }

  allPlayersGuessed(): boolean {
    const nonDrawerPlayers = this.players.filter(
      p => p.id !== this.getCurrentDrawer().id
    );
    return nonDrawerPlayers.every(p => p.hasGuessedCorrectly);
  }

  endRound(): { word: string; scores: ScoreEntry[]; round: number } {
    this.clearTimers();
    this.phase = 'ROUND_END';

    const word = this.currentWord;
    const scores = this.getScoreboard();
    const round = this.currentRound;

    return { word, scores, round };
  }

  endGame(): { winner: ScoreEntry; scores: ScoreEntry[] } {
    this.clearTimers();
    this.phase = 'GAME_OVER';

    const scores = this.getScoreboard();
    const winner = scores[0] || {
      playerId: '',
      playerName: 'No one',
      score: 0,
      roundScore: 0,
      avatarColor: '#000',
    };

    return { winner, scores };
  }

  isGameOver(): boolean {
    // Game is over if we've gone through all rounds with all players drawing
    return this.currentRound > this.totalRounds;
  }

  shouldEndGame(): boolean {
    // Check if this was the last drawer of the last round
    if (this.currentRound >= this.totalRounds && this.currentDrawerIndex >= this.players.length - 1) {
      return true;
    }
    return false;
  }

  getHint(): string {
    if (!this.currentWord) return '';

    const revealPercentage = this.settings.hintsCount > 0
      ? Math.min(1, this.hintLevel / this.settings.hintsCount) * 0.6 // Max 60% reveal
      : 0;

    return wordManager.generateHint(this.currentWord, revealPercentage);
  }

  getInitialHint(): string {
    if (!this.currentWord) return '';
    return wordManager.generateHint(this.currentWord, 0);
  }

  addStroke(data: StrokeData, strokeId?: string): void {
    if (data.type === 'start') {
      this.currentStrokeId = strokeId || uuidv4();
      this.strokes.push({
        id: this.currentStrokeId,
        points: [data],
      });
    } else if (this.currentStrokeId) {
      const currentStroke = this.strokes.find(s => s.id === this.currentStrokeId);
      if (currentStroke) {
        currentStroke.points.push(data);
      }
    }

    if (data.type === 'end') {
      this.currentStrokeId = null;
    }
  }

  clearStrokes(): void {
    this.strokes = [];
    this.currentStrokeId = null;
  }

  undoStroke(): DrawStroke | null {
    if (this.strokes.length === 0) return null;
    return this.strokes.pop() || null;
  }

  getScoreboard(): ScoreEntry[] {
    return this.players
      .map(p => ({
        playerId: p.id,
        playerName: p.name,
        score: p.score,
        roundScore: p.roundScore,
        avatarColor: p.avatarColor,
      }))
      .sort((a, b) => b.score - a.score);
  }

  getCurrentDrawer(): Player {
    const index = Math.max(0, Math.min(this.currentDrawerIndex, this.players.length - 1));
    return this.players[index];
  }

  getTimeRemaining(): number {
    return Math.max(0, this.timeRemaining);
  }

  removePlayer(playerId: string): { wasDrawer: boolean; newDrawerIndex: number } {
    const wasDrawer = this.getCurrentDrawer()?.id === playerId;
    const playerIndex = this.players.findIndex(p => p.id === playerId);

    if (playerIndex === -1) {
      return { wasDrawer: false, newDrawerIndex: this.currentDrawerIndex };
    }

    this.players.splice(playerIndex, 1);

    // Adjust drawer index if needed
    if (playerIndex <= this.currentDrawerIndex && this.currentDrawerIndex > 0) {
      this.currentDrawerIndex--;
    }

    // Ensure drawer index is valid
    if (this.currentDrawerIndex >= this.players.length) {
      this.currentDrawerIndex = this.players.length - 1;
    }

    return { wasDrawer, newDrawerIndex: this.currentDrawerIndex };
  }

  private clearTimers(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.hintTimer) {
      clearInterval(this.hintTimer);
      this.hintTimer = null;
    }
  }

  destroy(): void {
    this.clearTimers();
  }

  toJSON(requestingPlayerId?: string): GameState {
    const drawer = this.getCurrentDrawer();
    const isDrawer = requestingPlayerId === drawer?.id;

    return {
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      currentDrawerId: drawer?.id || '',
      currentDrawerName: drawer?.name || '',
      phase: this.phase,
      wordLength: this.currentWord.length,
      hint: this.phase === 'DRAWING' ? (isDrawer ? this.currentWord : this.getHint()) : '',
      timeRemaining: this.getTimeRemaining(),
      drawTime: this.settings.drawTime,
      scoreboard: this.getScoreboard(),
    };
  }
}
