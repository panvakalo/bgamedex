import { Router, Request, Response } from 'express'
import { getDb } from '../database.js'

const router = Router()
const statsRouter = Router()

// Log a play
router.post('/:gameId/plays', (req: Request, res: Response) => {
  const db = getDb()
  const userId = req.user!.sub
  const gameId = Number(req.params.gameId)

  const game = db.prepare('SELECT id FROM games WHERE id = ? AND user_id = ?').get(gameId, userId)
  if (!game) {
    res.status(404).json({ error: 'Game not found' })
    return
  }

  const rawDate = req.body.date || new Date().toISOString().slice(0, 10)
  const date = typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && !isNaN(Date.parse(rawDate))
    ? rawDate
    : new Date().toISOString().slice(0, 10)

  const result = db.prepare(
    'INSERT INTO plays (game_id, user_id, played_at) VALUES (?, ?, ?)'
  ).run(gameId, userId, date)

  const play = db.prepare(
    'SELECT id, game_id as gameId, user_id as userId, played_at as playedAt, created_at as createdAt FROM plays WHERE id = ?'
  ).get(result.lastInsertRowid)
  res.status(201).json(play)
})

// List plays for a game
router.get('/:gameId/plays', (req: Request, res: Response) => {
  const db = getDb()
  const userId = req.user!.sub
  const gameId = Number(req.params.gameId)

  const game = db.prepare('SELECT id FROM games WHERE id = ? AND user_id = ?').get(gameId, userId)
  if (!game) {
    res.status(404).json({ error: 'Game not found' })
    return
  }

  const plays = db.prepare(
    'SELECT id, game_id as gameId, user_id as userId, played_at as playedAt, created_at as createdAt FROM plays WHERE game_id = ? AND user_id = ? ORDER BY played_at DESC'
  ).all(gameId, userId)

  res.json(plays)
})

// Delete a play
router.delete('/:gameId/plays/:playId', (req: Request, res: Response) => {
  const db = getDb()
  const userId = req.user!.sub
  const playId = Number(req.params.playId)

  const play = db.prepare('SELECT id FROM plays WHERE id = ? AND user_id = ?').get(playId, userId)
  if (!play) {
    res.status(404).json({ error: 'Play not found' })
    return
  }

  db.prepare('DELETE FROM plays WHERE id = ? AND user_id = ?').run(playId, userId)
  res.status(204).end()
})

// Aggregate stats
statsRouter.get('/stats', (req: Request, res: Response) => {
  const db = getDb()
  const userId = req.user!.sub

  const totals = db.prepare(
    'SELECT COUNT(*) as totalPlays, COUNT(DISTINCT game_id) as gamesPlayed FROM plays WHERE user_id = ?'
  ).get(userId) as { totalPlays: number; gamesPlayed: number }

  const mostPlayed = db.prepare(`
    SELECT g.id as gameId, g.title, g.image_url as imageUrl, COUNT(p.id) as playCount
    FROM plays p
    JOIN games g ON g.id = p.game_id
    WHERE p.user_id = ?
    GROUP BY p.game_id
    ORDER BY playCount DESC
    LIMIT 10
  `).all(userId)

  const recentPlays = db.prepare(`
    SELECT p.id, g.id as gameId, g.title, g.image_url as imageUrl, p.played_at as playedAt
    FROM plays p
    JOIN games g ON g.id = p.game_id
    WHERE p.user_id = ?
    ORDER BY p.played_at DESC, p.created_at DESC
    LIMIT 20
  `).all(userId)

  res.json({
    totalPlays: totals.totalPlays,
    gamesPlayed: totals.gamesPlayed,
    mostPlayed,
    recentPlays,
  })
})

export default router
export { statsRouter }
