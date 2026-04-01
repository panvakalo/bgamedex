import crypto from 'crypto'
import { Router, Request, Response } from 'express'
import { OAuth2Client } from 'google-auth-library'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import { getDb } from '../database.js'
import { signToken, verifyToken, requireAuth, generateVerificationToken, hashToken, setAuthCookie, clearAuthCookie, DUMMY_BCRYPT_HASH } from '../auth.js'
import { sendVerificationEmail, sendPasswordResetEmail } from '../email.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } })

const router = Router()

const oauthStates = new Map<string, number>()
const authCodes = new Map<string, { jwt: string; createdAt: number }>()
const STATE_TTL_MS = 10 * 60 * 1000
const AUTH_CODE_TTL_MS = 60 * 1000
// Prevent memory exhaustion from unbounded map growth
const MAX_MAP_SIZE = 10_000

function evictOldest(map: Map<string, unknown>, count: number) {
  let removed = 0
  for (const key of map.keys()) {
    if (removed >= count) break
    map.delete(key)
    removed++
  }
}

function cleanupStaleStates() {
  const now = Date.now()
  for (const [state, created] of oauthStates) {
    if (now - created > STATE_TTL_MS) oauthStates.delete(state)
  }
  for (const [code, data] of authCodes) {
    if (now - data.createdAt > AUTH_CODE_TTL_MS) authCodes.delete(code)
  }
}

function getOAuthClient(): OAuth2Client {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

router.get('/google', (_req: Request, res: Response) => {
  cleanupStaleStates()
  if (oauthStates.size >= MAX_MAP_SIZE) {
    evictOldest(oauthStates, Math.floor(MAX_MAP_SIZE / 4))
  }

  const state = crypto.randomBytes(32).toString('hex')
  oauthStates.set(state, Date.now())

  const client = getOAuthClient()
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
    res.redirect(`${frontendUrl}/login?error=no_code`)
    return
  }

  if (!state || !oauthStates.has(state)) {
    res.redirect(`${frontendUrl}/login?error=auth_failed`)
    return
  }
  oauthStates.delete(state)

  try {
    const client = getOAuthClient()
    const { tokens } = await client.getToken(code)
    client.setCredentials(tokens)

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID,
    })
    const payload = ticket.getPayload()!

    const db = getDb()

    const existing = db.prepare('SELECT id, is_admin, token_version FROM users WHERE google_id = ?').get(payload.sub) as { id: number; is_admin: number; token_version: number } | undefined

    let userId: number
    let isAdmin = false
    let tokenVersion = 1

    if (existing) {
      db.prepare('UPDATE users SET email = ?, name = ?, picture = ?, email_verified = 1 WHERE id = ?')
        .run(payload.email, payload.name, payload.picture, existing.id)
      userId = existing.id
      isAdmin = !!existing.is_admin
      tokenVersion = existing.token_version
    } else {
      const result = db.prepare('INSERT INTO users (google_id, email, name, picture, email_verified) VALUES (?, ?, ?, ?, 1)')
        .run(payload.sub, payload.email, payload.name, payload.picture)
      userId = Number(result.lastInsertRowid)

      const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count
      if (userCount === 1) {
        db.prepare('UPDATE games SET user_id = ? WHERE user_id IS NULL').run(userId)
      }
    }

    const token = signToken({
      sub: userId,
      email: payload.email!,
      name: payload.name ?? '',
      emailVerified: true,
      isAdmin,
      ver: tokenVersion,
      aud: 'user',
    })

    // Use one-time code exchange to avoid leaking JWT in URL
    cleanupStaleStates()
    if (authCodes.size >= MAX_MAP_SIZE) {
      evictOldest(authCodes, Math.floor(MAX_MAP_SIZE / 4))
    }
    const authCode = crypto.randomBytes(32).toString('hex')
    authCodes.set(authCode, { jwt: token, createdAt: Date.now() })

    res.redirect(`${frontendUrl}/auth/callback?code=${authCode}`)
  } catch {
    res.redirect(`${frontendUrl}/login?error=auth_failed`)
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
  setAuthCookie(res, entry.jwt)
  const db = getDb()
  const features = (db.prepare('SELECT feature FROM user_features WHERE user_id = ?').all(decoded.sub) as { feature: string }[]).map(r => r.feature)
  res.json({ user: { sub: decoded.sub, email: decoded.email, name: decoded.name, picture: '', emailVerified: decoded.emailVerified, features } })
})

const MIN_PASSWORD_LENGTH = 12
const MAX_PASSWORD_LENGTH = 128

router.post('/register', async (req: Request, res: Response) => {
  const { email, password, name } = req.body as { email?: string; password?: string; name?: string }

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }

  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Invalid email address' })
    return
  }

  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters` })
    return
  }

  if (name && (typeof name !== 'string' || name.length > 100)) {
    res.status(400).json({ error: 'Name must be 100 characters or less' })
    return
  }

  const db = getDb()
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined

  // Always hash to prevent timing-based email enumeration
  const passwordHash = await bcrypt.hash(password, 12)

  if (existing) {
    // Return same status/shape to prevent email enumeration
    res.status(201).json({ message: 'Check your email to complete registration' })
    return
  }

  const verificationToken = generateVerificationToken()
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const result = db.prepare('INSERT INTO users (email, name, password_hash, verification_token, verification_token_expires) VALUES (?, ?, ?, ?, ?)')
    .run(email, name ?? email.split('@')[0], passwordHash, hashToken(verificationToken), tokenExpires)
  const userId = Number(result.lastInsertRowid)

  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count
  if (userCount === 1) {
    db.prepare('UPDATE games SET user_id = ? WHERE user_id IS NULL').run(userId)
  }

  sendVerificationEmail(email, verificationToken).catch((err) => {
    console.error('Failed to send verification email:', err)
  })

  res.status(201).json({ message: 'Check your email to complete registration' })
})

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }

  const db = getDb()
  const user = db.prepare('SELECT id, email, name, picture, password_hash, email_verified, is_admin, token_version FROM users WHERE email = ?').get(email) as {
    id: number; email: string; name: string; picture: string | null; password_hash: string | null; email_verified: number; is_admin: number; token_version: number
  } | undefined

  const hashToCompare = user?.password_hash ?? DUMMY_BCRYPT_HASH
  const valid = await bcrypt.compare(password, hashToCompare)

  if (!user || !user.password_hash || !valid) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  const token = signToken({
    sub: user.id,
    email: user.email,
    name: user.name ?? '',
    emailVerified: !!user.email_verified,
    isAdmin: !!user.is_admin,
    ver: user.token_version,
    aud: 'user',
  })

  const features = (db.prepare('SELECT feature FROM user_features WHERE user_id = ?').all(user.id) as { feature: string }[]).map(r => r.feature)
  setAuthCookie(res, token)
  res.json({ user: { sub: user.id, email: user.email, name: user.name, picture: user.picture ?? '', emailVerified: !!user.email_verified, features } })
})

router.get('/me', requireAuth, (req: Request, res: Response) => {
  const db = getDb()
  const row = db.prepare('SELECT picture, email_verified FROM users WHERE id = ?').get(req.user!.sub) as { picture: string | null; email_verified: number } | undefined
  const features = (db.prepare('SELECT feature FROM user_features WHERE user_id = ?').all(req.user!.sub) as { feature: string }[]).map(r => r.feature)
  res.json({ ...req.user, picture: row?.picture ?? '', emailVerified: !!row?.email_verified, features })
})

router.post('/logout', requireAuth, (req: Request, res: Response) => {
  const db = getDb()
  db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(req.user!.sub)
  clearAuthCookie(res)
  res.json({ message: 'Logged out' })
})

router.post('/verify-email', (req: Request, res: Response) => {
  const { token: verifyTokenStr } = req.body as { token?: string }

  if (!verifyTokenStr || typeof verifyTokenStr !== 'string') {
    res.status(400).json({ error: 'Verification token is required' })
    return
  }

  const db = getDb()
  const user = db.prepare('SELECT id, email, name, email_verified, verification_token_expires, is_admin, token_version FROM users WHERE verification_token = ?').get(hashToken(verifyTokenStr)) as {
    id: number; email: string; name: string; email_verified: number; verification_token_expires: string | null; is_admin: number; token_version: number
  } | undefined

  if (!user) {
    res.status(400).json({ error: 'Invalid or expired verification link' })
    return
  }

  if (user.email_verified) {
    res.json({ message: 'Email already verified' })
    return
  }

  if (user.verification_token_expires && new Date(user.verification_token_expires) < new Date()) {
    res.status(400).json({ error: 'Verification link has expired. Please request a new one.' })
    return
  }

  db.prepare('UPDATE users SET email_verified = 1, verification_token = NULL, verification_token_expires = NULL WHERE id = ?').run(user.id)

  const token = signToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    emailVerified: true,
    isAdmin: !!user.is_admin,
    ver: user.token_version,
    aud: 'user',
  })

  const featureRows = (db.prepare('SELECT feature FROM user_features WHERE user_id = ?').all(user.id) as { feature: string }[]).map(r => r.feature)
  setAuthCookie(res, token)
  res.json({ user: { sub: user.id, email: user.email, name: user.name, picture: '', emailVerified: true, features: featureRows } })
})

router.post('/resend-verification', requireAuth, (req: Request, res: Response) => {
  const db = getDb()
  const user = db.prepare('SELECT email, email_verified FROM users WHERE id = ?').get(req.user!.sub) as {
    email: string; email_verified: number
  } | undefined

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  if (user.email_verified) {
    res.status(400).json({ error: 'Email is already verified' })
    return
  }

  const verificationToken = generateVerificationToken()
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  db.prepare('UPDATE users SET verification_token = ?, verification_token_expires = ? WHERE id = ?')
    .run(hashToken(verificationToken), tokenExpires, req.user!.sub)

  sendVerificationEmail(user.email, verificationToken).catch((err) => {
    console.error('Failed to send verification email:', err)
  })

  res.json({ message: 'Verification email sent' })
})

router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string }

  // Always return same response to prevent email enumeration
  const genericResponse = { message: 'If an account exists, a reset link has been sent' }

  if (!email || typeof email !== 'string') {
    res.json(genericResponse)
    return
  }

  const db = getDb()
  const user = db.prepare('SELECT id, email_verified FROM users WHERE email = ?').get(email) as {
    id: number; email_verified: number
  } | undefined

  // Send reset email to any user with a verified email (including Google-only users who need to set a password)
  if (user?.email_verified) {
    const resetToken = generateVerificationToken()
    const tokenExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?')
      .run(hashToken(resetToken), tokenExpires, user.id)

    sendPasswordResetEmail(email, resetToken).catch((err) => {
      console.error('Failed to send password reset email:', err)
    })
  }

  res.json(genericResponse)
})

router.post('/reset-password', async (req: Request, res: Response) => {
  const { token: resetToken, password } = req.body as { token?: string; password?: string }

  if (!resetToken || typeof resetToken !== 'string') {
    res.status(400).json({ error: 'Reset token is required' })
    return
  }

  if (!password || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters` })
    return
  }

  const db = getDb()
  const user = db.prepare('SELECT id, email, name, email_verified, reset_token_expires, is_admin, token_version FROM users WHERE reset_token = ?').get(hashToken(resetToken)) as {
    id: number; email: string; name: string; email_verified: number; reset_token_expires: string | null; is_admin: number; token_version: number
  } | undefined

  if (!user) {
    res.status(400).json({ error: 'Invalid or expired reset link' })
    return
  }

  if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date()) {
    res.status(400).json({ error: 'Reset link has expired. Please request a new one.' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)

  // Invalidate all existing sessions by bumping token_version
  db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, token_version = token_version + 1 WHERE id = ?')
    .run(passwordHash, user.id)

  // Receiving the reset email proves email ownership
  if (!user.email_verified) {
    db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(user.id)
  }

  const newTokenVersion = user.token_version + 1
  const token = signToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    emailVerified: true,
    isAdmin: !!user.is_admin,
    ver: newTokenVersion,
    aud: 'user',
  })

  const resetFeatures = (db.prepare('SELECT feature FROM user_features WHERE user_id = ?').all(user.id) as { feature: string }[]).map(r => r.feature)
  setAuthCookie(res, token)
  res.json({ user: { sub: user.id, email: user.email, name: user.name, picture: '', emailVerified: true, features: resetFeatures } })
})

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

const IMAGE_SIGNATURES: Array<{ mime: string; bytes: number[] }> = [
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4E, 0x47] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
]

function isValidImage(buffer: Buffer): boolean {
  return IMAGE_SIGNATURES.some((sig) =>
    sig.bytes.every((byte, i) => buffer[i] === byte)
  )
}

router.post('/avatar', requireAuth, upload.single('avatar'), (req: Request, res: Response) => {
  const file = req.file
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' })
    return
  }

  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    res.status(400).json({ error: 'File must be an image (jpeg, png, gif, or webp)' })
    return
  }

  // Validate actual file content via magic bytes (not just client-supplied MIME)
  if (!isValidImage(file.buffer)) {
    res.status(400).json({ error: 'File content does not match a valid image format' })
    return
  }

  const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
  const db = getDb()
  db.prepare('UPDATE users SET picture = ? WHERE id = ?').run(dataUrl, req.user!.sub)

  res.json({ picture: dataUrl })
})

export default router
