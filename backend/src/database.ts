import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import { decodeHtmlEntities } from './bgg.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '..', 'bgamedex.db')

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
  }
  return db
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_id TEXT UNIQUE,
      email TEXT UNIQUE,
      name TEXT,
      picture TEXT,
      password_hash TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      min_players INTEGER,
      max_players INTEGER,
      min_duration INTEGER,
      max_duration INTEGER,
      is_card_game INTEGER NOT NULL DEFAULT 0,
      is_cooperative INTEGER NOT NULL DEFAULT 0,
      plays_in_teams INTEGER NOT NULL DEFAULT 0,
      supports_campaign INTEGER NOT NULL DEFAULT 0,
      rules_url TEXT,
      description TEXT,
      image_url TEXT,
      bgg_id INTEGER,
      user_id INTEGER REFERENCES users(id)
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS mechanics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS game_mechanics (
      game_id INTEGER REFERENCES games(id),
      mechanic_id INTEGER REFERENCES mechanics(id),
      PRIMARY KEY (game_id, mechanic_id)
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS plays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      played_at TEXT NOT NULL DEFAULT (date('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      UNIQUE(name, user_id)
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS game_tags (
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (game_id, tag_id)
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS game_prices (
      bgg_id INTEGER PRIMARY KEY,
      price_data TEXT NOT NULL,
      currency TEXT NOT NULL,
      destination TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS manual_prices (
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      price REAL NOT NULL,
      PRIMARY KEY (game_id, user_id)
    )
  `)

  // Migrate columns added after initial schema
  const migrations = ['rules_text TEXT', 'image_url TEXT', 'description TEXT', 'bgg_id INTEGER', 'rules_files TEXT', 'user_id INTEGER REFERENCES users(id)', 'password_hash TEXT', "status TEXT NOT NULL DEFAULT 'collection'"]
  // Migrate users table columns
  const userMigrations = [
    'password_hash TEXT',
    'email_verified INTEGER NOT NULL DEFAULT 0',
    'verification_token TEXT',
    'verification_token_expires TEXT',
    'reset_token TEXT',
    'reset_token_expires TEXT',
  ]
  for (const col of userMigrations) {
    try {
      db.exec(`ALTER TABLE users ADD COLUMN ${col}`)
    } catch {
      // Column already exists
    }
  }

  // Backfill: Google OAuth users are inherently verified
  try { db.exec('UPDATE users SET email_verified = 1 WHERE google_id IS NOT NULL AND email_verified = 0') } catch {}
  for (const col of migrations) {
    try {
      db.exec(`ALTER TABLE games ADD COLUMN ${col}`)
    } catch {
      // Column already exists — safe to ignore
    }
  }

  // Fix HTML-encoded text in existing games and mechanics
  fixEncodedText(db)
}

function fixEncodedText(db: Database.Database): void {
  const encoded = /&#?\w+;/

  const games = db.prepare('SELECT id, title, description FROM games').all() as { id: number; title: string | null; description: string | null }[]
  const updateGame = db.prepare('UPDATE games SET title = ?, description = ? WHERE id = ?')
  for (const g of games) {
    const needsTitle = g.title && encoded.test(g.title)
    const needsDesc = g.description && encoded.test(g.description)
    if (needsTitle || needsDesc) {
      updateGame.run(
        needsTitle ? decodeHtmlEntities(g.title!) : g.title,
        needsDesc ? decodeHtmlEntities(g.description!) : g.description,
        g.id,
      )
    }
  }

  const mechanics = db.prepare('SELECT id, name FROM mechanics').all() as { id: number; name: string }[]
  const updateMechanic = db.prepare('UPDATE mechanics SET name = ? WHERE id = ?')
  for (const m of mechanics) {
    if (encoded.test(m.name)) {
      updateMechanic.run(decodeHtmlEntities(m.name), m.id)
    }
  }
}
