import { v4 as uuidv4 } from 'uuid';
import { PlayerData } from '../types';

export class Player {
  public id: string;
  public socketId: string;
  public name: string;
  public avatarColor: string;
  public score: number;
  public hasGuessedCorrectly: boolean;
  public isHost: boolean;
  public roundScore: number;

  constructor(socketId: string, name: string, avatarColor: string, isHost: boolean = false) {
    this.id = uuidv4();
    this.socketId = socketId;
    this.name = name;
    this.avatarColor = avatarColor;
    this.score = 0;
    this.hasGuessedCorrectly = false;
    this.isHost = isHost;
    this.roundScore = 0;
  }

  addPoints(points: number): void {
    this.roundScore += points;
    this.score += points;
  }

  resetRoundState(): void {
    this.hasGuessedCorrectly = false;
    this.roundScore = 0;
  }

  toJSON(): PlayerData {
    return {
      id: this.id,
      socketId: this.socketId,
      name: this.name,
      avatarColor: this.avatarColor,
      score: this.score,
      hasGuessedCorrectly: this.hasGuessedCorrectly,
      isHost: this.isHost,
      roundScore: this.roundScore,
    };
  }
}
