import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'

import { getDb } from '../../database.js'
import { signToken, requireAdminAuth, setAdminCookie, clearAdminCookie, DUMMY_BCRYPT_HASH } from '../../auth.js'
import { requireAdmin } from '../../admin-auth.js'

const router = Router()

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }

  const db = getDb()
  const user = db.prepare('SELECT id, email, name, password_hash, email_verified, is_admin, token_version FROM users WHERE email = ?').get(email) as {
    id: number; email: string; name: string; password_hash: string | null; email_verified: number; is_admin: number; token_version: number
  } | undefined

  const hashToCompare = user?.password_hash ?? DUMMY_BCRYPT_HASH
  const valid = await bcrypt.compare(password, hashToCompare)

  // Generic error for all failure cases — no info leak about admin status
  if (!user || !user.password_hash || !valid || !user.is_admin || !user.email_verified) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const token = signToken({
    sub: user.id,
    email: user.email,
    name: user.name ?? '',
    emailVerified: !!user.email_verified,
    isAdmin: true,
    ver: user.token_version,
    aud: 'admin',
  })

  setAdminCookie(res, token)
  res.json({ user: { sub: user.id, email: user.email, name: user.name, isAdmin: true } })
})

router.get('/me', requireAdminAuth, requireAdmin, (req: Request, res: Response) => {
  res.json({ user: { sub: req.user!.sub, email: req.user!.email, name: req.user!.name, isAdmin: true } })
})

router.post('/logout', requireAdminAuth, requireAdmin, (req: Request, res: Response) => {
  clearAdminCookie(res)
  res.json({ message: 'Logged out' })
})

export default router
