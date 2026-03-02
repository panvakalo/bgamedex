import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'
import { getDb } from './database.js'
import { searchBgg, fetchBggThing, delay, bggHeaders } from './bgg.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const enrich = process.argv.includes('--enrich')
const BGG_TOKEN = process.env.BBG_BEARER_TOKEN ?? null

interface GameJson {
  title: string
  minPlayers: number | null
  maxPlayers: number | null
  minDuration: number | null
  maxDuration: number | null
  isCardGame: boolean
  isCooperative: boolean
  playsInTeams: boolean
  supportsCampaign: boolean
  rulesUrl: string | null
}

interface BggCacheEntry {
  bggId: number | null
  description: string | null
  imageUrl: string | null
  mechanics: string[]
}

type BggCache = Record<string, BggCacheEntry>

const dataPath = path.join(__dirname, '..', 'data', 'games.json')
const cachePath = path.join(__dirname, '..', 'data', 'bgg-cache.json')
const games: GameJson[] = JSON.parse(readFileSync(dataPath, 'utf-8'))

// --- BGG enrichment helpers (only used with --enrich) ---

function loadCache(): BggCache {
  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, 'utf-8'))
  }
  return {}
}

function saveCache(cache: BggCache): void {
  writeFileSync(cachePath, JSON.stringify(cache, null, 2))
}

async function enrichFromBgg(title: string, cache: BggCache): Promise<BggCacheEntry> {
  if (cache[title]) {
    return cache[title]
  }

  console.log(`  Fetching BGG data for: ${title}`)

  const bggId = await searchBgg(title)
  if (!bggId) {
    console.log(`    Not found on BGG`)
    const entry: BggCacheEntry = { bggId: null, description: null, imageUrl: null, mechanics: [] }
    cache[title] = entry
    return entry
  }

  await delay(BGG_TOKEN ? 1000 : 2000)

  const { description, imageUrl, mechanics } = await fetchBggThing(bggId)
  console.log(`    Found: BGG ID ${bggId}, ${mechanics.length} mechanics`)

  const entry: BggCacheEntry = { bggId, description, imageUrl, mechanics }
  cache[title] = entry
  return entry
}

// --- Main seed logic ---

async function seed() {
  const db = getDb()
  const cache = enrich ? loadCache() : {}

  db.exec('DELETE FROM game_mechanics')
  db.exec('DELETE FROM mechanics')
  db.exec('DELETE FROM games')

  const insertGame = db.prepare(`
    INSERT INTO games (title, min_players, max_players, min_duration, max_duration, is_card_game, is_cooperative, plays_in_teams, supports_campaign, rules_url, description, image_url, bgg_id)
    VALUES (@title, @minPlayers, @maxPlayers, @minDuration, @maxDuration, @isCardGame, @isCooperative, @playsInTeams, @supportsCampaign, @rulesUrl, @description, @imageUrl, @bggId)
  `)

  const insertMechanic = db.prepare(`INSERT OR IGNORE INTO mechanics (name) VALUES (?)`)
  const getMechanicId = db.prepare(`SELECT id FROM mechanics WHERE name = ?`)
  const insertGameMechanic = db.prepare(`INSERT OR IGNORE INTO game_mechanics (game_id, mechanic_id) VALUES (?, ?)`)

  if (enrich) {
    console.log(`Enriching ${games.length} games from BoardGameGeek...`)
  }

  for (const game of games) {
    let bggData: BggCacheEntry = { bggId: null, description: null, imageUrl: null, mechanics: [] }

    if (enrich) {
      const wasCached = !!cache[game.title]
      bggData = await enrichFromBgg(game.title, cache)
      if (!wasCached) await delay(BGG_TOKEN ? 1000 : 2000)
      saveCache(cache)
    }

    const result = insertGame.run({
      title: game.title,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
      minDuration: game.minDuration,
      maxDuration: game.maxDuration,
      isCardGame: game.isCardGame ? 1 : 0,
      isCooperative: game.isCooperative ? 1 : 0,
      playsInTeams: game.playsInTeams ? 1 : 0,
      supportsCampaign: game.supportsCampaign ? 1 : 0,
      rulesUrl: game.rulesUrl,
      description: bggData.description,
      imageUrl: bggData.imageUrl,
      bggId: bggData.bggId,
    })

    const gameId = result.lastInsertRowid

    for (const mechanic of bggData.mechanics) {
      insertMechanic.run(mechanic)
      const row = getMechanicId.get(mechanic) as { id: number }
      insertGameMechanic.run(gameId, row.id)
    }
  }

  console.log(`Seeded ${games.length} games${enrich ? ' (with BGG enrichment)' : ''}`)
}

seed().catch(console.error)
