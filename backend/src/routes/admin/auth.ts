import crypto from 'crypto'
import { Router, Request, Response } from 'express'
import { OAuth2Client } from 'google-auth-library'
import bcrypt from 'bcryptjs'

import { getDb } from '../../database.js'
import { signToken, verifyToken, requireAdminAuth, setAdminCookie, clearAdminCookie, DUMMY_BCRYPT_HASH } from '../../auth.js'
import { requireAdmin } from '../../admin-auth.js'

const router = Router()

const oauthStates = new Map<string, number>()
const authCodes = new Map<string, { jwt: string; createdAt: number }>()
const STATE_TTL_MS = 10 * 60 * 1000
const AUTH_CODE_TTL_MS = 60 * 1000
const MAX_MAP_SIZE = 10_000

function evictOldest(map: Map<string, unknown>, count: number) {
  let removed = 0
  for (const key of map.keys()) {
    if (removed >= count) break
    map.delete(key)
    removed++
  }
}

function cleanupStaleEntries() {
  const now = Date.now()
  for (const [state, created] of oauthStates) {
    if (now - created > STATE_TTL_MS) oauthStates.delete(state)
  }
  for (const [code, data] of authCodes) {
    if (now - data.createdAt > AUTH_CODE_TTL_MS) authCodes.delete(code)
  }
}

function getAdminOAuthClient(): OAuth2Client {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_ADMIN_REDIRECT_URI
  )
}

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

router.get('/google', (_req: Request, res: Response) => {
  cleanupStaleEntries()
  if (oauthStates.size >= MAX_MAP_SIZE) {
    evictOldest(oauthStates, Math.floor(MAX_MAP_SIZE / 4))
  }

  const state = crypto.randomBytes(32).toString('hex')
  oauthStates.set(state, Date.now())

  const client = getAdminOAuthClient()
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
    state,
  })
  res.redirect(url)
})

router.get('/google/callback', async (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
  const code = req.query.code as string | undefined
  const state = req.query.state as string | undefined

  if (!code) {
    res.redirect(`${frontendUrl}/admin/login?error=auth_failed`)
    return
  }

  if (!state || !oauthStates.has(state)) {
    res.redirect(`${frontendUrl}/admin/login?error=auth_failed`)
    return
  }
  oauthStates.delete(state)

  try {
    const client = getAdminOAuthClient()
    const { tokens } = await client.getToken(code)
    client.setCredentials(tokens)

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID,
    })
    const payload = ticket.getPayload()!

    const db = getDb()
    const user = db.prepare('SELECT id, email, name, is_admin, email_verified, token_version FROM users WHERE google_id = ?').get(payload.sub) as {
      id: number; email: string; name: string; is_admin: number; email_verified: number; token_version: number
    } | undefined

    if (!user) {
      res.redirect(`${frontendUrl}/admin/login?error=auth_failed`)
      return
    }

    if (!user.is_admin) {
      res.redirect(`${frontendUrl}/admin/login?error=not_admin`)
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

    cleanupStaleEntries()
    if (authCodes.size >= MAX_MAP_SIZE) {
      evictOldest(authCodes, Math.floor(MAX_MAP_SIZE / 4))
    }
    const authCode = crypto.randomBytes(32).toString('hex')
    authCodes.set(authCode, { jwt: token, createdAt: Date.now() })

    res.redirect(`${frontendUrl}/admin/auth/callback?code=${authCode}`)
  } catch {
    res.redirect(`${frontendUrl}/admin/login?error=auth_failed`)
  }
})

router.post('/exchange-code', (req: Request, res: Response) => {
  const { code } = req.body as { code?: string }

  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Authorization code is required' })
    return
  }

  const entry = authCodes.get(code)
  authCodes.delete(code)

  if (!entry || Date.now() - entry.createdAt > AUTH_CODE_TTL_MS) {
    res.status(400).json({ error: 'Invalid or expired authorization code' })
    return
  }

  const decoded = verifyToken(entry.jwt)
  setAdminCookie(res, entry.jwt)
  res.json({ user: { sub: decoded.sub, email: decoded.email, name: decoded.name, isAdmin: true } })
})

router.get('/me', requireAdminAuth, requireAdmin, (req: Request, res: Response) => {
  res.json({ user: { sub: req.user!.sub, email: req.user!.email, name: req.user!.name, isAdmin: true } })
})

router.post('/logout', requireAdminAuth, requireAdmin, (req: Request, res: Response) => {
  clearAdminCookie(res)
  res.json({ message: 'Logged out' })
})

export default router
