import { Router, Request, Response } from 'express'
import { getDb } from '../database.js'
import { sendEvent } from '../sse.js'

const router = Router()

// Search users by name (min 2 chars, limit 20)
router.get('/search', (req: Request, res: Response) => {
  const q = (req.query.q as string | undefined)?.trim()
  if (!q || q.length < 2) {
    res.json([])
    return
  }

  const userId = req.user!.sub
  const db = getDb()

  const users = db.prepare(`
    SELECT u.id, u.name, u.picture,
      CASE
        WHEN f1.status = 'accepted' OR f2.status = 'accepted' THEN 'accepted'
        WHEN f1.status = 'pending' THEN 'pending_sent'
        WHEN f2.status = 'pending' THEN 'pending_received'
        ELSE 'none'
      END AS friendship_status
    FROM users u
    LEFT JOIN friendships f1 ON f1.requester_id = ? AND f1.addressee_id = u.id AND f1.status != 'rejected'
    LEFT JOIN friendships f2 ON f2.requester_id = u.id AND f2.addressee_id = ? AND f2.status != 'rejected'
    WHERE u.id != ? AND u.name LIKE ? COLLATE NOCASE
    LIMIT 20
  `).all(userId, userId, userId, `%${q}%`) as { id: number; name: string; picture: string | null; friendship_status: string }[]

  res.json(users.map(u => ({
    id: u.id,
    name: u.name,
    picture: u.picture,
    friendshipStatus: u.friendship_status,
  })))
})

// Send friend request
router.post('/requests', (req: Request, res: Response) => {
  const { userId: addresseeId } = req.body as { userId: number }
  const requesterId = req.user!.sub

  if (!addresseeId || typeof addresseeId !== 'number') {
    res.status(400).json({ error: 'userId is required and must be a number' })
    return
  }
  if (addresseeId === requesterId) {
    res.status(400).json({ error: 'Cannot send friend request to yourself' })
    return
  }

  const db = getDb()

  // Check addressee exists
  const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(addresseeId)
  if (!targetUser) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  // Check existing friendship in either direction
  const existing = db.prepare(`
    SELECT id, status, requester_id FROM friendships
    WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)
  `).get(requesterId, addresseeId, addresseeId, requesterId) as { id: number; status: string; requester_id: number } | undefined

  if (existing) {
    if (existing.status === 'accepted') {
      res.status(409).json({ error: 'Already friends' })
      return
    }
    if (existing.status === 'pending' && existing.requester_id === requesterId) {
      res.status(409).json({ error: 'Friend request already sent' })
      return
    }
    // Reverse pending request exists — auto-accept
    if (existing.status === 'pending' && existing.requester_id === addresseeId) {
      db.prepare("UPDATE friendships SET status = 'accepted', updated_at = datetime('now') WHERE id = ?").run(existing.id)
      const requesterName = (db.prepare('SELECT name FROM users WHERE id = ?').get(requesterId) as { name: string }).name
      const addresseeName = (db.prepare('SELECT name FROM users WHERE id = ?').get(addresseeId) as { name: string }).name
      sendEvent(addresseeId, { type: 'friend_accepted', data: { friendName: requesterName } })
      sendEvent(requesterId, { type: 'friend_accepted', data: { friendName: addresseeName } })
      res.json({ message: 'Friend request accepted', friendshipId: existing.id })
      return
    }
    // Rejected — allow re-request by updating
    if (existing.status === 'rejected') {
      if (existing.requester_id === requesterId) {
        db.prepare("UPDATE friendships SET status = 'pending', updated_at = datetime('now') WHERE id = ?").run(existing.id)
        const requesterName = (db.prepare('SELECT name FROM users WHERE id = ?').get(requesterId) as { name: string }).name
        sendEvent(addresseeId, { type: 'friend_request', data: { requesterName } })
        res.status(201).json({ message: 'Friend request sent', friendshipId: existing.id })
        return
      }
      // Was rejected by us previously, but they're re-requesting — delete old and insert new
      db.prepare('DELETE FROM friendships WHERE id = ?').run(existing.id)
    }
  }

  const result = db.prepare(
    'INSERT INTO friendships (requester_id, addressee_id) VALUES (?, ?)'
  ).run(requesterId, addresseeId)

  const requesterName = (db.prepare('SELECT name FROM users WHERE id = ?').get(requesterId) as { name: string }).name
  sendEvent(addresseeId, { type: 'friend_request', data: { requesterName } })

  res.status(201).json({ message: 'Friend request sent', friendshipId: result.lastInsertRowid })
})

// List pending requests received
router.get('/requests', (req: Request, res: Response) => {
  const userId = req.user!.sub
  const db = getDb()

  const requests = db.prepare(`
    SELECT f.id, f.requester_id, u.name, u.picture, f.created_at
    FROM friendships f
    JOIN users u ON u.id = f.requester_id
    WHERE f.addressee_id = ? AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `).all(userId) as { id: number; requester_id: number; name: string; picture: string | null; created_at: string }[]

  res.json(requests.map(r => ({
    id: r.id,
    requesterId: r.requester_id,
    name: r.name,
    picture: r.picture,
    createdAt: r.created_at,
  })))
})

// Pending request count (for nav badge)
router.get('/requests/count', (req: Request, res: Response) => {
  const userId = req.user!.sub
  const db = getDb()

  const row = db.prepare(
    "SELECT COUNT(*) AS count FROM friendships WHERE addressee_id = ? AND status = 'pending'"
  ).get(userId) as { count: number }

  res.json({ count: row.count })
})

// Accept or reject a friend request
router.patch('/requests/:friendshipId', (req: Request, res: Response) => {
  const friendshipId = Number(req.params.friendshipId)
  const { action } = req.body as { action: 'accept' | 'reject' }
  const userId = req.user!.sub

  if (!action || (action !== 'accept' && action !== 'reject')) {
    res.status(400).json({ error: 'action must be "accept" or "reject"' })
    return
  }

  const db = getDb()
  const friendship = db.prepare(
    "SELECT id, addressee_id FROM friendships WHERE id = ? AND status = 'pending'"
  ).get(friendshipId) as { id: number; addressee_id: number } | undefined

  if (!friendship) {
    res.status(404).json({ error: 'Friend request not found' })
    return
  }
  if (friendship.addressee_id !== userId) {
    res.status(403).json({ error: 'Only the recipient can respond to a friend request' })
    return
  }

  const newStatus = action === 'accept' ? 'accepted' : 'rejected'
  db.prepare("UPDATE friendships SET status = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, friendshipId)

  if (action === 'accept') {
    const full = db.prepare(
      'SELECT f.requester_id, u1.name AS requester_name, u2.name AS addressee_name FROM friendships f JOIN users u1 ON u1.id = f.requester_id JOIN users u2 ON u2.id = f.addressee_id WHERE f.id = ?'
    ).get(friendshipId) as { requester_id: number; requester_name: string; addressee_name: string }
    sendEvent(full.requester_id, { type: 'friend_accepted', data: { friendName: full.addressee_name } })
  }

  res.json({ message: `Friend request ${newStatus}` })
})

// List accepted friends
router.get('/', (req: Request, res: Response) => {
  const userId = req.user!.sub
  const db = getDb()

  const friends = db.prepare(`
    SELECT
      f.id AS friendship_id,
      CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END AS user_id,
      u.name,
      u.picture
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
    WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted'
    ORDER BY u.name COLLATE NOCASE
  `).all(userId, userId, userId, userId) as { friendship_id: number; user_id: number; name: string; picture: string | null }[]

  res.json(friends.map(f => ({
    friendshipId: f.friendship_id,
    userId: f.user_id,
    name: f.name,
    picture: f.picture,
  })))
})

// Remove friend (hard delete)
router.delete('/:friendshipId', (req: Request, res: Response) => {
  const friendshipId = Number(req.params.friendshipId)
  const userId = req.user!.sub
  const db = getDb()

  const friendship = db.prepare(
    "SELECT id, requester_id, addressee_id FROM friendships WHERE id = ? AND (requester_id = ? OR addressee_id = ?) AND status = 'accepted'"
  ).get(friendshipId, userId, userId) as { id: number; requester_id: number; addressee_id: number } | undefined

  if (!friendship) {
    res.status(404).json({ error: 'Friendship not found' })
    return
  }

  const otherUserId = friendship.requester_id === userId ? friendship.addressee_id : friendship.requester_id
  db.prepare('DELETE FROM friendships WHERE id = ?').run(friendshipId)
  sendEvent(otherUserId, { type: 'friend_removed', data: {} })
  res.json({ message: 'Friend removed' })
})

// View friend's collection
router.get('/:userId/collection', (req: Request, res: Response) => {
  const currentUserId = req.user!.sub
  const friendUserId = Number(req.params.userId)
  const db = getDb()

  // Validate friendship
  const friendship = db.prepare(`
    SELECT id FROM friendships
    WHERE ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
      AND status = 'accepted'
  `).get(currentUserId, friendUserId, friendUserId, currentUserId) as { id: number } | undefined

  if (!friendship) {
    res.status(403).json({ error: 'You are not friends with this user' })
    return
  }

  const friend = db.prepare('SELECT id, name, picture FROM users WHERE id = ?').get(friendUserId) as { id: number; name: string; picture: string | null }

  const games = db.prepare(`
    SELECT id, title, min_players, max_players, min_duration, max_duration,
      is_card_game, is_cooperative, plays_in_teams, supports_campaign,
      rules_url, image_url, status
    FROM games
    WHERE user_id = ? AND status = 'collection'
    ORDER BY title COLLATE NOCASE
  `).all(friendUserId)

  res.json({ friend, games })
})

// View friend's wishlist
router.get('/:userId/wishlist', (req: Request, res: Response) => {
  const currentUserId = req.user!.sub
  const friendUserId = Number(req.params.userId)
  const db = getDb()

  // Validate friendship
  const friendship = db.prepare(`
    SELECT id FROM friendships
    WHERE ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
      AND status = 'accepted'
  `).get(currentUserId, friendUserId, friendUserId, currentUserId) as { id: number } | undefined

  if (!friendship) {
    res.status(403).json({ error: 'You are not friends with this user' })
    return
  }

  const friend = db.prepare('SELECT id, name, picture FROM users WHERE id = ?').get(friendUserId) as { id: number; name: string; picture: string | null }

  const games = db.prepare(`
    SELECT id, title, min_players, max_players, min_duration, max_duration,
      is_card_game, is_cooperative, plays_in_teams, supports_campaign,
      rules_url, image_url, status
    FROM games
    WHERE user_id = ? AND status = 'wishlist'
    ORDER BY title COLLATE NOCASE
  `).all(friendUserId)

  res.json({ friend, games })
})

export default router
