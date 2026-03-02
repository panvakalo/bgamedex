import { Router, Request, Response } from 'express'
import { getDb } from '../database.js'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const db = getDb()
  const userId = req.user!.sub
  const tags = db.prepare(`
    SELECT t.id, t.name, COUNT(gt.game_id) AS game_count
    FROM tags t
    LEFT JOIN game_tags gt ON gt.tag_id = t.id
    WHERE t.user_id = ?
    GROUP BY t.id
    ORDER BY t.name ASC
  `).all(userId)
  res.json(tags)
})

router.post('/', (req: Request, res: Response) => {
  const db = getDb()
  const userId = req.user!.sub
  const { name } = req.body as { name: string }

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' })
    return
  }

  const trimmed = name.trim()
  if (trimmed.length > 50) {
    res.status(400).json({ error: 'Tag name must be 50 characters or less' })
    return
  }
  const existing = db.prepare('SELECT id FROM tags WHERE name = ? AND user_id = ?').get(trimmed, userId)
  if (existing) {
    res.status(409).json({ error: 'Tag already exists' })
    return
  }

  const result = db.prepare('INSERT INTO tags (name, user_id) VALUES (?, ?)').run(trimmed, userId)
  res.status(201).json({ id: Number(result.lastInsertRowid), name: trimmed })
})

router.patch('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const userId = req.user!.sub
  const tagId = Number(req.params.id)
  const { name } = req.body as { name: string }

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' })
    return
  }

  const tag = db.prepare('SELECT id FROM tags WHERE id = ? AND user_id = ?').get(tagId, userId)
  if (!tag) {
    res.status(404).json({ error: 'Tag not found' })
    return
  }

  const trimmed = name.trim()
  if (trimmed.length > 50) {
    res.status(400).json({ error: 'Tag name must be 50 characters or less' })
    return
  }
  const conflict = db.prepare('SELECT id FROM tags WHERE name = ? AND user_id = ? AND id != ?').get(trimmed, userId, tagId)
  if (conflict) {
    res.status(409).json({ error: 'A tag with that name already exists' })
    return
  }

  db.prepare('UPDATE tags SET name = ? WHERE id = ? AND user_id = ?').run(trimmed, tagId, userId)
  res.json({ id: tagId, name: trimmed })
})

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const userId = req.user!.sub
  const tagId = Number(req.params.id)

  const tag = db.prepare('SELECT id FROM tags WHERE id = ? AND user_id = ?').get(tagId, userId)
  if (!tag) {
    res.status(404).json({ error: 'Tag not found' })
    return
  }

  db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(tagId, userId)
  res.status(204).end()
})

export default router
