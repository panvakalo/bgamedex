import { Router, Request, Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '../database.js'
import { extractTextFromUrl } from '../pdf-extract.js'
import { fetchRulesFromWeb } from '../rules-search.js'
import { fetchWithTimeout } from '../fetch-utils.js'

const MAX_MESSAGES = 50
const MAX_MESSAGE_LENGTH = 5000

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface GameRow {
  id: number
  title: string
  rules_url: string | null
  rules_text: string | null
  rules_files: string | null
  description: string | null
}

const router = Router()

type RulesSource = 'publisher-pdf' | 'bgg-file' | 'ultraboardgames' | 'description'

interface RulesResult {
  text: string
  source: RulesSource
  detail: string
}

async function tryExtractRules(game: GameRow): Promise<RulesResult | null> {
  if (game.rules_url && !game.rules_url.startsWith('https://boardgamegeek.com/filepage')) {
    try {
      const text = await extractTextFromUrl(game.rules_url)
      return { text, source: 'publisher-pdf', detail: game.rules_url }
    } catch {
      // Will try BGG files next
    }
  }

  if (game.rules_files) {
    const files = JSON.parse(game.rules_files) as Array<{ downloadUrl: string; filename: string }>
    for (const file of files) {
      try {
        const text = await extractTextFromUrl(file.downloadUrl)
        return { text, source: 'bgg-file', detail: file.filename }
      } catch {
        continue
      }
    }
  }

  const webRules = await fetchRulesFromWeb(game.title)
  if (webRules) {
    const slug = game.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return { text: webRules, source: 'ultraboardgames', detail: `https://www.ultraboardgames.com/${slug}/game-rules.php` }
  }

  return null
}

router.post('/:id/prepare-rules', async (req: Request, res: Response) => {
  const db = getDb()
  const gameId = Number(req.params.id)

  const userId = req.user!.sub
  const game = db.prepare('SELECT id, title, rules_url, rules_text, rules_files, description FROM games WHERE id = ? AND user_id = ?').get(gameId, userId) as GameRow | undefined

  if (!game) {
    res.status(404).json({ error: 'Game not found' })
    return
  }

  if (game.rules_text) {
    let rulesUrl = game.rules_url
    if (!rulesUrl) {
      const slug = game.title.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const candidateUrl = `https://www.ultraboardgames.com/${slug}/game-rules.php`
      try {
        const check = await fetchWithTimeout(candidateUrl, { method: 'HEAD', redirect: 'manual' })
        if (check.status === 200) rulesUrl = candidateUrl
      } catch { /* ignore */ }
      if (rulesUrl) {
        db.prepare('UPDATE games SET rules_url = ? WHERE id = ?').run(rulesUrl, gameId)
      }
    }
    res.json({ status: 'ready', source: 'cached', detail: rulesUrl })
    return
  }

  const result = await tryExtractRules(game)

  if (result) {
    db.prepare('UPDATE games SET rules_text = ? WHERE id = ?').run(result.text, gameId)
    if (!game.rules_url) {
      db.prepare('UPDATE games SET rules_url = ? WHERE id = ?').run(result.detail, gameId)
    }
    res.json({ status: 'ready', source: result.source, detail: result.detail, textLength: result.text.length })
    return
  }

  if (game.description) {
    res.json({ status: 'ready', source: 'description' })
    return
  }

  res.json({ status: 'unavailable' })
})

router.post('/:id/chat', async (req: Request, res: Response) => {
  const db = getDb()
  const gameId = Number(req.params.id)
  const { messages } = req.body as { messages: ChatMessage[] }

  // Input validation
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages array is required' })
    return
  }

  if (messages.length > MAX_MESSAGES) {
    res.status(400).json({ error: `Too many messages (max ${MAX_MESSAGES})` })
    return
  }

  for (const msg of messages) {
    if (msg.role !== 'user' && msg.role !== 'assistant') {
      res.status(400).json({ error: 'Invalid message role' })
      return
    }
    if (typeof msg.content !== 'string' || msg.content.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({ error: `Message content must be a string of at most ${MAX_MESSAGE_LENGTH} characters` })
      return
    }
  }

  const userId = req.user!.sub
  const game = db.prepare('SELECT id, title, rules_text, description FROM games WHERE id = ? AND user_id = ?').get(gameId, userId) as {
    id: number
    title: string
    rules_text: string | null
    description: string | null
  } | undefined

  if (!game) {
    res.status(404).json({ error: 'Game not found' })
    return
  }

  const mechanics = db.prepare(`
    SELECT m.name FROM mechanics m
    JOIN game_mechanics gm ON gm.mechanic_id = m.id
    WHERE gm.game_id = ?
  `).all(gameId) as { name: string }[]

  let gameContext: string
  if (game.rules_text) {
    gameContext = `RULES TEXT:\n---\n${game.rules_text}\n---`
  } else if (game.description) {
    const mechanicsList = mechanics.map((m) => m.name).join(', ')
    gameContext = `GAME DESCRIPTION:\n---\n${game.description}\n---`
    if (mechanicsList) {
      gameContext += `\n\nGAME MECHANICS: ${mechanicsList}`
    }
    gameContext += '\n\nNote: Full rules PDF was not available. Answering based on the game description and mechanics.'
  } else {
    res.status(400).json({ error: 'No rules or description available for this game' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'Chat service is temporarily unavailable' })
    return
  }

  const systemPrompt = `You are a rules assistant for "${game.title}".
- Answer ONLY from the context provided below
- If the answer is not found in the provided context, say so clearly
- Never make up rules
- Quote specific sections when possible

${gameContext}`

  const client = new Anthropic({ apiKey })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.flushHeaders()

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })

    stream.on('text', (text) => {
      res.write(`event: text\ndata: ${JSON.stringify(text)}\n\n`)
    })

    stream.on('end', () => {
      res.write(`event: done\ndata: {}\n\n`)
      res.end()
    })

    stream.on('error', () => {
      res.write(`event: error\ndata: ${JSON.stringify('An error occurred while generating a response')}\n\n`)
      res.end()
    })
  } catch {
    res.write(`event: error\ndata: ${JSON.stringify('Failed to start chat')}\n\n`)
    res.end()
  }
})

export default router
