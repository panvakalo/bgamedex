import { Router, Request, Response } from 'express'
import { getDb } from '../database.js'
import { searchBggMultiple, fetchBggThing, fetchBggRulesFiles } from '../bgg.js'

const router = Router()

router.get('/search-bgg', async (req: Request, res: Response) => {
  const q = req.query.q as string | undefined
  if (!q || q.trim().length === 0) {
    res.json([])
    return
  }

  try {
    const results = await searchBggMultiple(q.trim())
    res.json(results.slice(0, 20))
  } catch {
    res.status(500).json({ error: 'BGG search failed' })
  }
})

router.post('/', async (req: Request, res: Response) => {
  const { bggId, status = 'collection' } = req.body as { bggId: number; status?: 'collection' | 'wishlist' }
  if (!bggId || typeof bggId !== 'number') {
    res.status(400).json({ error: 'bggId is required and must be a number' })
    return
  }
  if (status !== 'collection' && status !== 'wishlist') {
    res.status(400).json({ error: 'status must be "collection" or "wishlist"' })
    return
  }

  const db = getDb()

  const userId = req.user!.sub
  const existing = db.prepare('SELECT id, status FROM games WHERE bgg_id = ? AND user_id = ?').get(bggId, userId) as { id: number; status: string } | undefined
  if (existing) {
    const location = existing.status === 'collection' ? 'collection' : 'wishlist'
    res.status(409).json({ error: `Game already exists in your ${location}` })
    return
  }

  try {
    const bggData = await fetchBggThing(bggId)

    const rulesFiles = await fetchBggRulesFiles(bggId)
    const rulesUrl = rulesFiles.length > 0 ? rulesFiles[0].filepageUrl : null

    const result = db.prepare(`
      INSERT INTO games (title, min_players, max_players, min_duration, max_duration, is_card_game, is_cooperative, plays_in_teams, supports_campaign, description, image_url, bgg_id, rules_url, rules_files, user_id, status)
      VALUES (@title, @minPlayers, @maxPlayers, @minDuration, @maxDuration, 0, 0, 0, 0, @description, @imageUrl, @bggId, @rulesUrl, @rulesFiles, @userId, @status)
    `).run({
      title: bggData.name ?? `Game ${bggId}`,
      minPlayers: bggData.minPlayers,
      maxPlayers: bggData.maxPlayers,
      minDuration: bggData.minPlaytime,
      maxDuration: bggData.maxPlaytime,
      description: bggData.description,
      imageUrl: bggData.imageUrl,
      bggId,
      rulesUrl,
      rulesFiles: rulesFiles.length > 0 ? JSON.stringify(rulesFiles) : null,
      userId,
      status,
    })

    const gameId = result.lastInsertRowid

    const insertMechanic = db.prepare(`INSERT OR IGNORE INTO mechanics (name) VALUES (?)`)
    const getMechanicId = db.prepare(`SELECT id FROM mechanics WHERE name = ?`)
    const insertGameMechanic = db.prepare(`INSERT OR IGNORE INTO game_mechanics (game_id, mechanic_id) VALUES (?, ?)`)

    for (const mechanic of bggData.mechanics) {
      insertMechanic.run(mechanic)
      const row = getMechanicId.get(mechanic) as { id: number }
      insertGameMechanic.run(gameId, row.id)
    }

    const game = db.prepare('SELECT * FROM games WHERE id = ? AND user_id = ?').get(gameId, userId)
    res.status(201).json(game)
  } catch {
    res.status(500).json({ error: 'Failed to fetch game data from BGG' })
  }
})

router.get('/wishlist', (req: Request, res: Response) => {
  const db = getDb()
  const userId = req.user!.sub
  const games = db.prepare(`
    SELECT g.id, g.title, g.min_players, g.max_players, g.min_duration, g.max_duration,
           g.is_card_game, g.is_cooperative, g.plays_in_teams, g.supports_campaign,
           g.rules_url, g.image_url
    FROM games g
    WHERE g.user_id = @userId AND g.status = 'wishlist'
    ORDER BY g.title ASC
  `).all({ userId })
  res.json(games)
})

router.patch('/:id/status', (req: Request, res: Response) => {
  const db = getDb()
  const id = Number(req.params.id)
  const userId = req.user!.sub
  const { status } = req.body as { status: string }

  if (status !== 'collection' && status !== 'wishlist') {
    res.status(400).json({ error: 'status must be "collection" or "wishlist"' })
    return
  }

  const game = db.prepare('SELECT id FROM games WHERE id = ? AND user_id = ?').get(id, userId)
  if (!game) {
    res.status(404).json({ error: 'Game not found' })
    return
  }

  db.prepare('UPDATE games SET status = ? WHERE id = ? AND user_id = ?').run(status, id, userId)
  res.json({ id, status })
})

router.get('/', (req: Request, res: Response) => {
  const db = getDb()
  const userId = req.user!.sub
  let query = 'SELECT g.id, g.title, g.min_players, g.max_players, g.min_duration, g.max_duration, g.is_card_game, g.is_cooperative, g.plays_in_teams, g.supports_campaign, g.rules_url, g.image_url, COUNT(p.id) AS play_count FROM games g LEFT JOIN plays p ON p.game_id = g.id AND p.user_id = g.user_id WHERE g.user_id = @userId AND g.status = \'collection\''
  const params: Record<string, unknown> = { userId }

  if (req.query.search) {
    const search = String(req.query.search).slice(0, 200)
    query += ' AND g.title LIKE @search'
    params.search = `%${search}%`
  }

  if (req.query.players) {
    const players = Number(req.query.players)
    query += ' AND g.min_players <= @players AND g.max_players >= @players'
    params.players = players
  }

  if (req.query.duration) {
    const duration = Number(req.query.duration)
    query += ' AND g.min_duration <= @duration'
    params.duration = duration
  }

  if (req.query.isCardGame !== undefined) {
    query += ' AND g.is_card_game = @isCardGame'
    params.isCardGame = req.query.isCardGame === 'true' ? 1 : 0
  }

  if (req.query.isCooperative !== undefined) {
    query += ' AND g.is_cooperative = @isCooperative'
    params.isCooperative = req.query.isCooperative === 'true' ? 1 : 0
  }

  if (req.query.playsInTeams !== undefined) {
    query += ' AND g.plays_in_teams = @playsInTeams'
    params.playsInTeams = req.query.playsInTeams === 'true' ? 1 : 0
  }

  if (req.query.supportsCampaign !== undefined) {
    query += ' AND g.supports_campaign = @supportsCampaign'
    params.supportsCampaign = req.query.supportsCampaign === 'true' ? 1 : 0
  }

  if (req.query.tag) {
    query += ' AND EXISTS (SELECT 1 FROM game_tags gt WHERE gt.game_id = g.id AND gt.tag_id = @tagId)'
    params.tagId = Number(req.query.tag)
  }

  query += ' GROUP BY g.id ORDER BY g.title ASC'

  const games = db.prepare(query).all(params) as Record<string, unknown>[]

  // Attach tags to each game
  const getGameTags = db.prepare(`
    SELECT t.id, t.name FROM tags t
    JOIN game_tags gt ON gt.tag_id = t.id
    WHERE gt.game_id = ?
    ORDER BY t.name ASC
  `)
  const result = games.map((game) => ({
    ...game,
    tags: getGameTags.all(game.id) as { id: number; name: string }[],
  }))

  res.json(result)
})

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const id = Number(req.params.id)
  const userId = req.user!.sub
  const game = db.prepare('SELECT id FROM games WHERE id = ? AND user_id = ?').get(id, userId)
  if (!game) {
    res.status(404).json({ error: 'Game not found' })
    return
  }
  db.prepare('DELETE FROM game_mechanics WHERE game_id = ?').run(id)
  db.prepare('DELETE FROM games WHERE id = ? AND user_id = ?').run(id, userId)
  res.status(204).end()
})

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const userId = req.user!.sub
  const game = db.prepare('SELECT * FROM games WHERE id = ? AND user_id = ?').get(Number(req.params.id), userId) as Record<string, unknown> | undefined
  if (!game) {
    res.status(404).json({ error: 'Game not found' })
    return
  }

  const mechanics = db.prepare(`
    SELECT m.name FROM mechanics m
    JOIN game_mechanics gm ON gm.mechanic_id = m.id
    WHERE gm.game_id = ?
    ORDER BY m.name ASC
  `).all(Number(req.params.id)) as { name: string }[]

  const tags = db.prepare(`
    SELECT t.id, t.name FROM tags t
    JOIN game_tags gt ON gt.tag_id = t.id
    WHERE gt.game_id = ?
    ORDER BY t.name ASC
  `).all(Number(req.params.id)) as { id: number; name: string }[]

  res.json({
    ...game,
    mechanics: mechanics.map((m) => m.name),
    tags,
  })
})

router.put('/:id/tags', (req: Request, res: Response) => {
  const db = getDb()
  const userId = req.user!.sub
  const gameId = Number(req.params.id)

  const game = db.prepare('SELECT id FROM games WHERE id = ? AND user_id = ?').get(gameId, userId)
  if (!game) {
    res.status(404).json({ error: 'Game not found' })
    return
  }

  const { tagIds = [], newTags = [] } = req.body as { tagIds?: number[]; newTags?: string[] }

  const allTagIds = [...tagIds]

  // Create new tags on the fly
  for (const name of newTags) {
    const trimmed = name.trim()
    if (!trimmed) continue
    const existing = db.prepare('SELECT id FROM tags WHERE name = ? AND user_id = ?').get(trimmed, userId) as { id: number } | undefined
    if (existing) {
      if (!allTagIds.includes(existing.id)) allTagIds.push(existing.id)
    } else {
      const result = db.prepare('INSERT INTO tags (name, user_id) VALUES (?, ?)').run(trimmed, userId)
      allTagIds.push(Number(result.lastInsertRowid))
    }
  }

  // Validate that all provided tagIds belong to the current user
  if (allTagIds.length > 0) {
    const placeholders = allTagIds.map(() => '?').join(',')
    const ownedTags = db.prepare(`SELECT id FROM tags WHERE id IN (${placeholders}) AND user_id = ?`).all(...allTagIds, userId) as { id: number }[]
    const ownedIds = new Set(ownedTags.map((t) => t.id))
    const invalidIds = allTagIds.filter((id) => !ownedIds.has(id))
    if (invalidIds.length > 0) {
      res.status(403).json({ error: 'Some tags do not belong to your account' })
      return
    }
  }

  // Replace game_tags
  db.prepare('DELETE FROM game_tags WHERE game_id = ?').run(gameId)
  const insert = db.prepare('INSERT INTO game_tags (game_id, tag_id) VALUES (?, ?)')
  for (const tagId of allTagIds) {
    insert.run(gameId, tagId)
  }

  // Return updated tags
  const tags = db.prepare(`
    SELECT t.id, t.name FROM tags t
    JOIN game_tags gt ON gt.tag_id = t.id
    WHERE gt.game_id = ?
    ORDER BY t.name ASC
  `).all(gameId) as { id: number; name: string }[]

  res.json(tags)
})

export default router
