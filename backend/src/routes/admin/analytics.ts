import { Router, Request, Response } from 'express'

import { getDb } from '../../database.js'

const router = Router()

router.get('/overview', (_req: Request, res: Response) => {
  const db = getDb()

  const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c
  const totalGames = (db.prepare("SELECT COUNT(*) as c FROM games WHERE status = 'collection'").get() as { c: number }).c
  const totalPlays = (db.prepare('SELECT COUNT(*) as c FROM plays').get() as { c: number }).c
  const totalFriendships = (db.prepare("SELECT COUNT(*) as c FROM friendships WHERE status = 'accepted'").get() as { c: number }).c
  const totalWishlistItems = (db.prepare("SELECT COUNT(*) as c FROM games WHERE status = 'wishlist'").get() as { c: number }).c

  res.json({ totalUsers, totalGames, totalPlays, totalFriendships, totalWishlistItems })
})

router.get('/growth', (req: Request, res: Response) => {
  const db = getDb()
  const period = req.query.period as string || '30d'

  let dateFilter: string
  switch (period) {
    case '7d':
      dateFilter = "AND created_at >= datetime('now', '-7 days')"
      break
    case '90d':
      dateFilter = "AND created_at >= datetime('now', '-90 days')"
      break
    case 'all':
      dateFilter = ''
      break
    default: // 30d
      dateFilter = "AND created_at >= datetime('now', '-30 days')"
  }

  const registrations = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM users
    WHERE 1=1 ${dateFilter}
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all() as Array<{ date: string; count: number }>

  res.json({ registrations })
})

router.get('/engagement', (_req: Request, res: Response) => {
  const db = getDb()

  // Active users = users who logged a play within the period
  const activeToday = (db.prepare(`
    SELECT COUNT(DISTINCT user_id) as c FROM plays WHERE created_at >= datetime('now', '-1 day')
  `).get() as { c: number }).c

  const activeWeek = (db.prepare(`
    SELECT COUNT(DISTINCT user_id) as c FROM plays WHERE created_at >= datetime('now', '-7 days')
  `).get() as { c: number }).c

  const activeMonth = (db.prepare(`
    SELECT COUNT(DISTINCT user_id) as c FROM plays WHERE created_at >= datetime('now', '-30 days')
  `).get() as { c: number }).c

  const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c

  const avgGamesPerUser = totalUsers > 0
    ? Number(((db.prepare("SELECT COUNT(*) as c FROM games WHERE status = 'collection'").get() as { c: number }).c / totalUsers).toFixed(1))
    : 0

  const avgPlaysPerUser = totalUsers > 0
    ? Number(((db.prepare('SELECT COUNT(*) as c FROM plays').get() as { c: number }).c / totalUsers).toFixed(1))
    : 0

  const google = (db.prepare('SELECT COUNT(*) as c FROM users WHERE google_id IS NOT NULL').get() as { c: number }).c
  const email = totalUsers - google

  res.json({
    activeToday,
    activeWeek,
    activeMonth,
    avgGamesPerUser,
    avgPlaysPerUser,
    authMethodBreakdown: { google, email },
  })
})

router.get('/popular-games', (req: Request, res: Response) => {
  const db = getDb()
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20))

  const games = db.prepare(`
    SELECT
      g.title,
      MIN(g.image_url) as image_url,
      COALESCE(g.bgg_id, g.title) as group_key,
      MIN(g.bgg_id) as bgg_id,
      COUNT(DISTINCT g.id) as owner_count,
      COUNT(p.id) as play_count
    FROM games g
    LEFT JOIN plays p ON p.game_id = g.id
    WHERE g.status = 'collection'
    GROUP BY group_key
    ORDER BY play_count DESC, owner_count DESC
    LIMIT ?
  `).all(limit) as Array<{
    title: string; image_url: string | null; bgg_id: number | null
    owner_count: number; play_count: number
  }>

  res.json({
    games: games.map((g) => ({
      title: g.title,
      imageUrl: g.image_url,
      bggId: g.bgg_id,
      ownerCount: g.owner_count,
      playCount: g.play_count,
    })),
  })
})

export default router
