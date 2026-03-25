import fs from 'fs'
import { Router, Request, Response } from 'express'

import { getDb, DB_PATH } from '../../database.js'

const router = Router()

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  parts.push(`${minutes}m`)
  return parts.join(' ')
}

router.get('/health', (_req: Request, res: Response) => {
  const db = getDb()

  let dbSizeBytes = 0
  try {
    dbSizeBytes = fs.statSync(DB_PATH).size
  } catch { /* file may not exist in tests */ }

  const uptime = process.uptime()
  const mem = process.memoryUsage()

  // Trusted hardcoded list — safe to interpolate into SQL
  const tables = ['users', 'games', 'plays', 'friendships', 'tags', 'mechanics', 'game_prices', 'manual_prices']
  const tableCounts: Record<string, number> = {}
  for (const table of tables) {
    try {
      tableCounts[table] = (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c
    } catch {
      tableCounts[table] = 0
    }
  }

  res.json({
    dbSizeBytes,
    dbSizeMb: (dbSizeBytes / (1024 * 1024)).toFixed(2),
    uptime,
    uptimeFormatted: formatUptime(uptime),
    nodeVersion: process.version,
    memoryUsage: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
    },
    tableCounts,
  })
})

router.get('/config', (_req: Request, res: Response) => {
  res.json({
    rateLimits: {
      global: 300,
      auth: 20,
    },
    features: {
      emailEnabled: !!process.env.RESEND_API_KEY,
      aiChatEnabled: !!process.env.OPENAI_API_KEY,
      googleAuthEnabled: !!process.env.GOOGLE_CLIENT_ID,
    },
    // NODE_ENV is not sensitive — it's a standard runtime config flag
    environment: process.env.NODE_ENV || 'development',
  })
})

export default router
