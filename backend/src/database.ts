import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import { decodeHtmlEntities } from './bgg.js'
import { chunkRulesText } from './chunk-text.js'
import { generateEmbeddings } from './embeddings.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '..', 'bgamedex.db')

export const KNOWN_FEATURES = ['rules_access'] as const
export type FeatureName = typeof KNOWN_FEATURES[number]

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('busy_timeout = 30000')
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
    CREATE TABLE IF NOT EXISTS friendships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER NOT NULL REFERENCES users(id),
      addressee_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(requester_id, addressee_id)
    )
  `)
  db.exec('CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id, status)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id, status)')

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

  db.exec(`
    CREATE TABLE IF NOT EXISTS uploaded_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bgg_id INTEGER NOT NULL UNIQUE,
      rules_text TEXT NOT NULL,
      source_filename TEXT,
      uploaded_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS rules_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bgg_id INTEGER NOT NULL,
      rules_text TEXT NOT NULL,
      source_filename TEXT,
      uploaded_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      archived_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  db.exec('CREATE INDEX IF NOT EXISTS idx_rules_history_bgg_id ON rules_history(bgg_id)')

  // Rules chunks for FTS5-based RAG
  db.exec(`
    CREATE TABLE IF NOT EXISTS rules_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bgg_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      UNIQUE(bgg_id, chunk_index)
    )
  `)
  db.exec('CREATE INDEX IF NOT EXISTS idx_rules_chunks_bgg_id ON rules_chunks(bgg_id)')

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS rules_chunks_fts USING fts5(
      chunk_text,
      content='rules_chunks',
      content_rowid='id'
    )
  `)

  // Triggers to keep FTS5 in sync
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS rules_chunks_ai AFTER INSERT ON rules_chunks BEGIN
      INSERT INTO rules_chunks_fts(rowid, chunk_text) VALUES (new.id, new.chunk_text);
    END
  `)
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS rules_chunks_ad AFTER DELETE ON rules_chunks BEGIN
      INSERT INTO rules_chunks_fts(rules_chunks_fts, rowid, chunk_text) VALUES('delete', old.id, old.chunk_text);
    END
  `)
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS rules_chunks_au AFTER UPDATE ON rules_chunks BEGIN
      INSERT INTO rules_chunks_fts(rules_chunks_fts, rowid, chunk_text) VALUES('delete', old.id, old.chunk_text);
      INSERT INTO rules_chunks_fts(rowid, chunk_text) VALUES (new.id, new.chunk_text);
    END
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_features (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      feature TEXT NOT NULL,
      granted_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, feature)
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS youtube_videos (
      game_title TEXT PRIMARY KEY,
      videos TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Track which one-time data migrations have run
  db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, ran_at TEXT NOT NULL DEFAULT (datetime(\'now\')))')

  if (!db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get('rename_rules_json_to_rules_text')) {
    try {
      db.exec('ALTER TABLE structured_rules RENAME COLUMN rules_json TO rules_text')
    } catch { /* column already named rules_text */ }
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('rename_rules_json_to_rules_text')
  }

  if (!db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get('rename_structured_rules_to_uploaded_rules')) {
    try {
      db.exec('ALTER TABLE structured_rules RENAME TO uploaded_rules')
    } catch { /* table already renamed */ }
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('rename_structured_rules_to_uploaded_rules')
  }

  // Migrate columns added after initial schema
  const migrations = ['rules_text TEXT', 'image_url TEXT', 'description TEXT', 'bgg_id INTEGER', 'rules_files TEXT', 'user_id INTEGER REFERENCES users(id)', "status TEXT NOT NULL DEFAULT 'collection'"]
  // Migrate users table columns
  const userMigrations = [
    'password_hash TEXT',
    'email_verified INTEGER NOT NULL DEFAULT 0',
    'verification_token TEXT',
    'verification_token_expires TEXT',
    'reset_token TEXT',
    'reset_token_expires TEXT',
    'is_admin INTEGER NOT NULL DEFAULT 0',
    'token_version INTEGER NOT NULL DEFAULT 1',
  ]
  for (const col of userMigrations) {
    try {
      db.exec(`ALTER TABLE users ADD COLUMN ${col}`)
    } catch (e: unknown) {
      if (!(e instanceof Error && e.message.includes('duplicate column'))) throw e
    }
  }

  // Backfill: Google OAuth users are inherently verified
  try { db.exec('UPDATE users SET email_verified = 1 WHERE google_id IS NOT NULL AND email_verified = 0') } catch {}
  for (const col of migrations) {
    try {
      db.exec(`ALTER TABLE games ADD COLUMN ${col}`)
    } catch (e: unknown) {
      if (!(e instanceof Error && e.message.includes('duplicate column'))) throw e
    }
  }

  // Fix HTML-encoded text in existing games and mechanics (run once)
  const alreadyRan = db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get('fix_encoded_text')
  if (!alreadyRan) {
    fixEncodedText(db)
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('fix_encoded_text')
  }

  // Chunk existing rules for FTS5 RAG
  if (!db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get('chunk_existing_rules')) {
    chunkExistingRules(db)
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('chunk_existing_rules')
  }

  // Add embedding column to rules_chunks
  try {
    db.exec('ALTER TABLE rules_chunks ADD COLUMN embedding TEXT')
  } catch (e: unknown) {
    if (!(e instanceof Error && e.message.includes('duplicate column'))) throw e
  }
}

// Call this after server startup to embed existing chunks (async, non-blocking)
export async function runAsyncMigrations(): Promise<void> {
  const db = getDb()
  if (db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get('embed_existing_chunks')) return
  if (!process.env.OPENAI_API_KEY) {
    console.log('[migrations] Skipping embed_existing_chunks: OPENAI_API_KEY not set')
    return
  }

  const chunks = db.prepare(
    'SELECT id, chunk_text FROM rules_chunks WHERE embedding IS NULL'
  ).all() as { id: number; chunk_text: string }[]

  if (chunks.length === 0) {
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('embed_existing_chunks')
    return
  }

  console.log(`[migrations] Embedding ${chunks.length} existing chunks...`)

  const BATCH_SIZE = 100
  const update = db.prepare('UPDATE rules_chunks SET embedding = ? WHERE id = ?')

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const embeddings = await generateEmbeddings(batch.map(c => c.chunk_text))

    const tx = db.transaction(() => {
      for (let j = 0; j < batch.length; j++) {
        const emb = embeddings[j]
        if (emb) update.run(JSON.stringify(emb), batch[j].id)
      }
    })
    tx()
    console.log(`[migrations] Embedded ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length} chunks`)
  }

  db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('embed_existing_chunks')
  console.log('[migrations] embed_existing_chunks complete')
}

function chunkExistingRules(db: Database.Database): void {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO rules_chunks (bgg_id, chunk_index, chunk_text) VALUES (?, ?, ?)'
  )

  const tx = db.transaction(() => {
    // Chunk uploaded rules
    const uploaded = db.prepare('SELECT bgg_id, rules_text FROM uploaded_rules').all() as { bgg_id: number; rules_text: string }[]
    for (const row of uploaded) {
      const chunks = chunkRulesText(row.rules_text)
      for (let i = 0; i < chunks.length; i++) {
        insert.run(row.bgg_id, i, chunks[i])
      }
    }

    // Chunk cached rules_text from games (only for bgg_ids not already covered by uploaded_rules)
    const games = db.prepare(`
      SELECT bgg_id, rules_text FROM games
      WHERE rules_text IS NOT NULL AND bgg_id IS NOT NULL
        AND bgg_id NOT IN (SELECT bgg_id FROM uploaded_rules)
    `).all() as { bgg_id: number; rules_text: string }[]
    for (const row of games) {
      const chunks = chunkRulesText(row.rules_text)
      for (let i = 0; i < chunks.length; i++) {
        insert.run(row.bgg_id, i, chunks[i])
      }
    }
  })
  tx()
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
