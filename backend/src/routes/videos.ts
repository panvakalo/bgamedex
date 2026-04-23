import { Router, Request, Response } from 'express'
import { getDb } from '../database.js'
import { fetchWithTimeout } from '../fetch-utils.js'

const router = Router()

const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const MAX_RESULTS = 5

interface YouTubeVideo {
  videoId: string
  title: string
  channelTitle: string
  thumbnailUrl: string
}

router.get('/:id/videos', async (req: Request, res: Response) => {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    res.json([])
    return
  }

  const db = getDb()
  const userId = req.user!.sub
  const gameId = Number(req.params.id)

  const game = db.prepare('SELECT id, title, bgg_id FROM games WHERE id = ? AND user_id = ?').get(gameId, userId) as { id: number; title: string; bgg_id: number | null } | undefined
  if (!game) {
    res.status(404).json({ error: 'Game not found' })
    return
  }

  const cached = db.prepare('SELECT videos, fetched_at FROM youtube_videos WHERE game_title = ?').get(game.title) as { videos: string; fetched_at: string } | undefined
  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at + 'Z').getTime()
    if (age < CACHE_TTL_MS) {
      res.json(JSON.parse(cached.videos))
      return
    }
  }

  try {
    const query = `${game.title} how to play board game`
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: String(MAX_RESULTS),
      relevanceLanguage: 'en',
      key: apiKey,
    })

    const response = await fetchWithTimeout(`${YOUTUBE_API_URL}?${params}`)
    if (!response.ok) {
      console.error(`[youtube] API error: ${response.status}`)
      res.json(cached ? JSON.parse(cached.videos) : [])
      return
    }

    const data = await response.json() as {
      items: {
        id: { videoId: string }
        snippet: { title: string; channelTitle: string; thumbnails: { medium: { url: string } } }
      }[]
    }

    const videos: YouTubeVideo[] = (data.items ?? []).map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails.medium.url,
    }))

    db.prepare(`
      INSERT INTO youtube_videos (game_title, videos, fetched_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(game_title) DO UPDATE SET videos = excluded.videos, fetched_at = excluded.fetched_at
    `).run(game.title, JSON.stringify(videos))

    res.json(videos)
  } catch (err) {
    console.error('[youtube] fetch error:', err)
    res.json(cached ? JSON.parse(cached.videos) : [])
  }
})

export default router
