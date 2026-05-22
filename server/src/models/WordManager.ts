import { getDb, saveDb } from '../database/db';
import { WordOption } from '../types';

interface WordRow {
  id: number;
  word: string;
  category: string;
  difficulty: string;
}

export class WordManager {
  private words: WordRow[] = [];
  private loaded: boolean = false;

  loadWords(): void {
    if (this.loaded) return;
    try {
      const db = getDb();
      const results = db.exec('SELECT id, word, category, difficulty FROM word_lists');
      if (results.length > 0) {
        this.words = results[0].values.map((row: any[]) => ({
          id: row[0] as number,
          word: row[1] as string,
          category: row[2] as string,
          difficulty: row[3] as string,
        }));
      }
      this.loaded = true;
    } catch (err) {
      console.error('Error loading words:', err);
    }
  }

  getRandomWords(count: number, excludeWords: string[] = []): WordOption[] {
    this.loadWords();

    const excludeSet = new Set(excludeWords.map(w => w.toLowerCase()));
    const available = this.words.filter(w => !excludeSet.has(w.word.toLowerCase()));

    if (available.length === 0) {
      return this.pickRandom(this.words, count);
    }

    return this.pickRandom(available, count);
  }

  getRandomWordsWithCustom(count: number, roomId: string, excludeWords: string[] = []): WordOption[] {
    this.loadWords();

    const customWords = this.getCustomWords(roomId);
    const excludeSet = new Set(excludeWords.map(w => w.toLowerCase()));

    const allWords: WordRow[] = [
      ...this.words,
      ...customWords.map((w, i) => ({
        id: -(i + 1),
        word: w,
        category: 'Custom',
        difficulty: 'medium' as string,
      })),
    ];

    const available = allWords.filter(w => !excludeSet.has(w.word.toLowerCase()));

    if (available.length === 0) {
      return this.pickRandom(allWords, count);
    }

    return this.pickRandom(available, count);
  }

  private pickRandom(wordList: WordRow[], count: number): WordOption[] {
    const shuffled = [...wordList].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(count, shuffled.length));

    return picked.map(w => ({
      word: w.word,
      category: w.category,
      difficulty: w.difficulty,
    }));
  }

  addCustomWords(roomId: string, words: string[]): void {
    try {
      const db = getDb();
      for (const word of words) {
        const trimmed = word.trim();
        if (trimmed.length > 0) {
          db.run('INSERT INTO custom_words (room_id, word) VALUES (?, ?)', [roomId, trimmed]);
        }
      }
      saveDb();
    } catch (err) {
      console.error('Error adding custom words:', err);
    }
  }

  getCustomWords(roomId: string): string[] {
    try {
      const db = getDb();
      const results = db.exec('SELECT word FROM custom_words WHERE room_id = ?', { bind: [roomId] } as any);
      // sql.js exec doesn't support bind in exec, use prepared statement
      const stmt = db.prepare('SELECT word FROM custom_words WHERE room_id = ?');
      stmt.bind([roomId]);
      const words: string[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        words.push(row.word as string);
      }
      stmt.free();
      return words;
    } catch (err) {
      console.error('Error getting custom words:', err);
      return [];
    }
  }

  removeCustomWords(roomId: string): void {
    try {
      const db = getDb();
      db.run('DELETE FROM custom_words WHERE room_id = ?', [roomId]);
      saveDb();
    } catch (err) {
      console.error('Error removing custom words:', err);
    }
  }

  checkGuess(guess: string, correctWord: string): boolean {
    const normalizedGuess = guess.trim().toLowerCase();
    const normalizedWord = correctWord.trim().toLowerCase();
    return normalizedGuess === normalizedWord;
  }

  isCloseGuess(guess: string, correctWord: string): boolean {
    const normalizedGuess = guess.trim().toLowerCase();
    const normalizedWord = correctWord.trim().toLowerCase();

    if (normalizedGuess === normalizedWord) return false;

    const distance = this.levenshteinDistance(normalizedGuess, normalizedWord);
    return distance >= 1 && distance <= 2;
  }

  generateHint(word: string, revealPercentage: number): string {
    const chars = word.split('');
    const letterIndices: number[] = [];

    for (let i = 0; i < chars.length; i++) {
      if (chars[i] !== ' ' && chars[i] !== '-') {
        letterIndices.push(i);
      }
    }

    const numToReveal = Math.floor(letterIndices.length * revealPercentage);
    const shuffledIndices = this.seededShuffle(letterIndices, word);
    const revealSet = new Set(shuffledIndices.slice(0, numToReveal));

    return chars
      .map((char, index) => {
        if (char === ' ') return '  ';
        if (char === '-') return '-';
        if (revealSet.has(index)) return char;
        return '_';
      })
      .join(' ');
  }

  private seededShuffle(arr: number[], seed: string): number[] {
    const result = [...arr];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }

    for (let i = result.length - 1; i > 0; i--) {
      hash = ((hash << 5) - hash + i) | 0;
      const j = Math.abs(hash) % (i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}

// Export a singleton
export const wordManager = new WordManager();
