import { Router, Request, Response } from 'express'
import { getDb } from '../database.js'
import { fetchWithTimeout } from '../fetch-utils.js'

const router = Router()

interface CachedPrice {
  bgg_id: number
  price_data: string
  currency: string
  destination: string
  fetched_at: string
}

interface ExternalPriceEntry {
  link: string
  price: number
  product: number
  shipping: string | number
  stock: string
  country: string
}

interface ExternalItem {
  id: number
  name: string
  url: string
  external_id: string
  prices: ExternalPriceEntry[]
}

interface ParsedPriceData {
  prices: {
    price: number
    product: number
    shipping: number
    stock: string
    country: string
    link: string
    itemName: string
  }[]
  url: string
}

const CACHE_MAX_AGE_MS = 60 * 60 * 1000 // 1 hour
const BATCH_SIZE = 50

function isFresh(fetchedAt: string): boolean {
  return Date.now() - new Date(fetchedAt).getTime() < CACHE_MAX_AGE_MS
}

async function fetchExternalPrices(
  bggIds: number[],
  currency: string,
  destination: string,
): Promise<Map<number, ParsedPriceData>> {
  const results = new Map<number, ParsedPriceData>()

  for (let i = 0; i < bggIds.length; i += BATCH_SIZE) {
    const batch = bggIds.slice(i, i + BATCH_SIZE)
    const eidParam = batch.join(',')
    const url = `https://bordspelprijzen.nl/api/info?sitename=boardgameprices&eid=${eidParam}&currency=${currency}&destination=${destination}`

    try {
      const res = await fetchWithTimeout(url)
      if (!res.ok) continue

      const data = (await res.json()) as { items?: ExternalItem[] }
      if (!data.items || !Array.isArray(data.items)) continue

      // Group items by external_id (BGG ID) — multiple language editions may exist
      const byBggId = new Map<number, ExternalItem[]>()
      for (const item of data.items) {
        const bggId = Number(item.external_id)
        if (!bggId) continue
        const list = byBggId.get(bggId) || []
        list.push(item)
        byBggId.set(bggId, list)
      }

      for (const [bggId, items] of byBggId) {
        // Merge prices from all editions, take URL from first item
        const allPrices = items.flatMap((item) =>
          item.prices.map((p) => ({
            price: p.price,
            product: p.product,
            shipping: typeof p.shipping === 'string' ? parseFloat(p.shipping) || 0 : p.shipping,
            stock: p.stock,
            country: p.country,
            link: p.link,
            itemName: item.name,
          })),
        )

        results.set(bggId, {
          prices: allPrices,
          url: items[0].url,
        })
      }
    } catch {
      // External API failed for this batch — skip
    }
  }

  return results
}

router.get('/', async (req: Request, res: Response) => {
  const db = getDb()
  const userId = req.user!.sub
  const currency = ((req.query.currency as string) || 'EUR').slice(0, 3)
  const destination = ((req.query.destination as string) || 'NL').slice(0, 5)

  // Fetch all collection games (with or without BGG ID)
  const allGames = db.prepare(`
    SELECT id, title, image_url, bgg_id
    FROM games
    WHERE user_id = ? AND status = 'collection'
  `).all(userId) as { id: number; title: string; image_url: string | null; bgg_id: number | null }[]

  if (allGames.length === 0) {
    res.json({ currency, totalMinPrice: 0, games: [] })
    return
  }

  // Load manual prices for this user
  const manualRows = db.prepare(
    `SELECT game_id, price FROM manual_prices WHERE user_id = ?`
  ).all(userId) as { game_id: number; price: number }[]
  const manualMap = new Map<number, number>()
  for (const row of manualRows) {
    manualMap.set(row.game_id, row.price)
  }

  const gamesWithBgg = allGames.filter((g) => g.bgg_id !== null) as { id: number; title: string; image_url: string | null; bgg_id: number }[]
  const bggIds = gamesWithBgg.map((g) => g.bgg_id)

  const cacheMap = new Map<number, CachedPrice>()

  if (bggIds.length > 0) {
    const placeholders = bggIds.map(() => '?').join(',')
    const cached = db.prepare(
      `SELECT bgg_id, price_data, currency, destination, fetched_at
       FROM game_prices
       WHERE bgg_id IN (${placeholders}) AND currency = ? AND destination = ?`
    ).all(...bggIds, currency, destination) as CachedPrice[]

    for (const row of cached) {
      cacheMap.set(row.bgg_id, row)
    }

    // Determine which IDs need fetching (missing or stale)
    const staleIds: number[] = []
    for (const bggId of bggIds) {
      const entry = cacheMap.get(bggId)
      if (!entry || !isFresh(entry.fetched_at)) {
        staleIds.push(bggId)
      }
    }

    if (staleIds.length > 0) {
      const freshData = await fetchExternalPrices(staleIds, currency, destination)

      const upsert = db.prepare(
        `INSERT OR REPLACE INTO game_prices (bgg_id, price_data, currency, destination, fetched_at)
         VALUES (?, ?, ?, ?, datetime('now'))`
      )

      for (const [bggId, priceResult] of freshData) {
        const json = JSON.stringify(priceResult)
        upsert.run(bggId, json, currency, destination)
        cacheMap.set(bggId, {
          bgg_id: bggId,
          price_data: json,
          currency,
          destination,
          fetched_at: new Date().toISOString(),
        })
      }
    }
  }

  // Assemble response
  let totalMinPrice = 0
  const responseGames = allGames.map((game) => {
    let prices: { price: number; product: number; shipping: number; stock: string; country: string; link: string; itemName: string }[] = []
    let lowestPrice: number | null = null
    let url = game.bgg_id ? `https://boardgameprices.com/item/show/${game.bgg_id}` : ''
    const manualPrice = manualMap.get(game.id) ?? null

    if (game.bgg_id) {
      const entry = cacheMap.get(game.bgg_id)
      if (entry) {
        try {
          const parsed = JSON.parse(entry.price_data) as ParsedPriceData
          url = parsed.url || url
          prices = parsed.prices || []

          if (prices.length > 0) {
            lowestPrice = Math.min(...prices.map((p) => p.price))
          }
        } catch {
          // Corrupted cache data
        }
      }
    }

    // Use external price if available, otherwise fall back to manual
    const effectivePrice = lowestPrice ?? manualPrice
    if (effectivePrice !== null) {
      totalMinPrice += effectivePrice
    }

    return {
      gameId: game.id,
      bggId: game.bgg_id,
      title: game.title,
      imageUrl: game.image_url,
      lowestPrice,
      manualPrice,
      url,
      prices,
    }
  })

  res.json({
    currency,
    totalMinPrice: Math.round(totalMinPrice * 100) / 100,
    games: responseGames,
  })
})

router.put('/:gameId/manual', (req: Request, res: Response) => {
  const db = getDb()
  const userId = req.user!.sub
  const gameId = Number(req.params.gameId)
  const { price } = req.body as { price: number }

  if (!price || typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > 100_000) {
    res.status(400).json({ error: 'Price must be a positive number (max 100,000)' })
    return
  }

  const game = db.prepare('SELECT id FROM games WHERE id = ? AND user_id = ?').get(gameId, userId)
  if (!game) {
    res.status(404).json({ error: 'Game not found' })
    return
  }

  db.prepare(
    `INSERT OR REPLACE INTO manual_prices (game_id, user_id, price) VALUES (?, ?, ?)`
  ).run(gameId, userId, price)

  res.json({ gameId, price })
})

router.delete('/:gameId/manual', (req: Request, res: Response) => {
  const db = getDb()
  const userId = req.user!.sub
  const gameId = Number(req.params.gameId)

  const game = db.prepare('SELECT id FROM games WHERE id = ? AND user_id = ?').get(gameId, userId)
  if (!game) {
    res.status(404).json({ error: 'Game not found' })
    return
  }

  db.prepare('DELETE FROM manual_prices WHERE game_id = ? AND user_id = ?').run(gameId, userId)

  res.status(204).end()
})

export default router
