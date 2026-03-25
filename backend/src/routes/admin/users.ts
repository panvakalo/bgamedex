import { Router, Request, Response } from 'express'

import { getDb } from '../../database.js'

const router = Router()

const ALLOWED_SORT = ['name', 'email', 'created_at', 'game_count', 'play_count'] as const
type SortField = typeof ALLOWED_SORT[number]

const USER_SELECT = `
  SELECT
    u.id, u.email, u.name, u.picture, u.created_at,
    u.email_verified, u.is_admin, u.google_id,
    CASE WHEN u.password_hash IS NOT NULL THEN 1 ELSE 0 END as has_password,
    (SELECT COUNT(*) FROM games g WHERE g.user_id = u.id AND g.status = 'collection') as game_count,
    (SELECT COUNT(*) FROM plays p WHERE p.user_id = u.id) as play_count,
    (SELECT COUNT(*) FROM friendships f WHERE (f.requester_id = u.id OR f.addressee_id = u.id) AND f.status = 'accepted') as friend_count,
    (SELECT COUNT(*) FROM games g WHERE g.user_id = u.id AND g.status = 'wishlist') as wishlist_count
  FROM users u`

interface UserRow {
  id: number; email: string; name: string; picture: string | null; created_at: string
  email_verified: number; is_admin: number; google_id: string | null; has_password: number
  game_count: number; play_count: number; friend_count: number; wishlist_count: number
}

function toUserDto(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    picture: u.picture,
    createdAt: u.created_at,
    emailVerified: !!u.email_verified,
    isAdmin: !!u.is_admin,
    googleId: u.google_id,
    hasPassword: !!u.has_password,
    gameCount: u.game_count,
    playCount: u.play_count,
    friendCount: u.friend_count,
    wishlistCount: u.wishlist_count,
  }
}

router.get('/', (req: Request, res: Response) => {
  const db = getDb()

  const q = (req.query.q as string || '').trim()
  const sort: SortField = ALLOWED_SORT.includes(req.query.sort as SortField) ? (req.query.sort as SortField) : 'created_at'
  const dir = req.query.dir === 'asc' ? 'ASC' : 'DESC'
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25))
  const offset = (page - 1) * limit

  const whereClause = q ? 'WHERE u.name LIKE ? OR u.email LIKE ?' : ''
  const params = q ? [`%${q}%`, `%${q}%`] : []

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM users u ${whereClause}`).get(...params) as { total: number }

  // Allowlisted column mappings — sort/dir values are validated above, safe to interpolate
  const sortMap: Record<SortField, string> = {
    name: 'u.name',
    email: 'u.email',
    created_at: 'u.created_at',
    game_count: 'game_count',
    play_count: 'play_count',
  }

  const users = db.prepare(`${USER_SELECT}
    ${whereClause}
    ORDER BY ${sortMap[sort]} ${dir}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as UserRow[]

  res.json({
    users: users.map(toUserDto),
    total: countRow.total,
    page,
    pageSize: limit,
  })
})

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const id = parseInt(req.params.id as string)

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid user ID' })
    return
  }

  const user = db.prepare(`${USER_SELECT} WHERE u.id = ?`).get(id) as UserRow | undefined

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  res.json(toUserDto(user))
})

router.patch('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const id = parseInt(req.params.id as string)
  const { isAdmin } = req.body as { isAdmin?: boolean }

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid user ID' })
    return
  }

  if (typeof isAdmin !== 'boolean') {
    res.status(400).json({ error: 'isAdmin must be a boolean' })
    return
  }

  if (req.user!.sub === id && !isAdmin) {
    res.status(400).json({ error: 'Cannot remove your own admin privileges' })
    return
  }

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id) as { id: number } | undefined
  if (!existing) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  db.prepare('UPDATE users SET is_admin = ?, token_version = token_version + 1 WHERE id = ?').run(isAdmin ? 1 : 0, id)
  res.json({ message: isAdmin ? 'User promoted to admin' : 'Admin privileges removed' })
})

export default router
