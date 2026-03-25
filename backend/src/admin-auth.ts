import { Request, Response, NextFunction } from 'express'
import { getDb } from './database.js'

/** Chains after requireAdminAuth. Returns 403 if the authenticated user is not an admin.
 *  Re-verifies against the database to ensure demoted admins are denied immediately. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin || req.user.aud !== 'admin') {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const db = getDb()
  const row = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.sub) as { is_admin: number } | undefined
  if (!row || !row.is_admin) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  next()
}
