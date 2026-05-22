// @ts-ignore - sql.js doesn't have type declarations
import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';

let db: any = null;
let dbPath: string = '';

export async function initDb(): Promise<any> {
  if (db) return db;

  const SQL = await initSqlJs();

  const dbDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbPath = path.join(dbDir, 'skribbl.db');

  // Load existing database or create a new one
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  initializeTables(db);
  saveDb();

  return db;
}

export function getDb(): any {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function saveDb(): void {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function initializeTables(database: any): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      host_id TEXT NOT NULL,
      settings TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'lobby'
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      socket_id TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar_color TEXT NOT NULL DEFAULT '#4A90D9',
      score INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS word_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL,
      category TEXT NOT NULL,
      difficulty TEXT NOT NULL
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_name TEXT NOT NULL,
      room_id TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      played_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS custom_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      word TEXT NOT NULL,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  database.run(`CREATE INDEX IF NOT EXISTS idx_players_room ON players(room_id)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_word_lists_category ON word_lists(category)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_word_lists_difficulty ON word_lists(difficulty)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_scores_room ON scores(room_id)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_custom_words_room ON custom_words(room_id)`);
}

export function closeDb(): void {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}
