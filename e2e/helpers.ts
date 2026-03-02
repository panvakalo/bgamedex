import { type Page, type APIRequestContext } from '@playwright/test'
import Database from 'better-sqlite3'

const API_URL = 'http://localhost:3000'  // Direct backend URL (bypasses Vite proxy)

interface AuthCredentials {
  email: string
  password: string
  name?: string
}

export async function registerUser(
  request: APIRequestContext,
  { email, password, name }: AuthCredentials,
): Promise<string> {
  const res = await request.post(`${API_URL}/api/auth/register`, {
    data: { email, password, name },
  })
  if (!res.ok()) {
    const body = await res.json()
    throw new Error(`Register failed: ${body.error ?? res.status()}`)
  }
  const { token } = await res.json()
  return token
}

export async function loginUser(
  request: APIRequestContext,
  { email, password }: AuthCredentials,
): Promise<string> {
  const res = await request.post(`${API_URL}/api/auth/login`, {
    data: { email, password },
  })
  if (!res.ok()) {
    const body = await res.json()
    throw new Error(`Login failed: ${body.error ?? res.status()}`)
  }
  const { token } = await res.json()
  return token
}

/** Register a user via API and inject the token into the browser, then navigate to home. */
export async function seedAuth(
  page: Page,
  request: APIRequestContext,
  creds: AuthCredentials,
): Promise<string> {
  const token = await registerUser(request, creds)

  // Set token in localStorage before navigating to an authenticated route
  await page.goto('/login')
  await page.evaluate((t) => localStorage.setItem('token', t), token)
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  return token
}

/** Insert a game directly into the test DB (avoids needing BGG connectivity). */
export function addGameViaDb(
  token: string,
  gameData: {
    title: string
    minPlayers?: number
    maxPlayers?: number
    minDuration?: number
    maxDuration?: number
    description?: string
  },
): { id: number; title: string } {
  const dbPath = process.env.DB_PATH
  if (!dbPath) {
    throw new Error('DB_PATH env var must be set for test seeding')
  }

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  // Decode JWT to get user ID
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
  const userId = payload.sub

  const result = db
    .prepare(
      `INSERT INTO games (title, min_players, max_players, min_duration, max_duration, description, user_id, is_card_game, is_cooperative, plays_in_teams, supports_campaign)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0)`,
    )
    .run(
      gameData.title,
      gameData.minPlayers ?? 2,
      gameData.maxPlayers ?? 4,
      gameData.minDuration ?? 30,
      gameData.maxDuration ?? 60,
      gameData.description ?? 'A fun test game for e2e testing.',
      userId,
    )

  db.close()

  return { id: Number(result.lastInsertRowid), title: gameData.title }
}

export function uniqueEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`
}
