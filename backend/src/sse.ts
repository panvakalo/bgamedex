import { Response } from 'express'

interface SseEvent {
  type: string
  data: Record<string, unknown>
}

// Cap concurrent SSE connections per user so a handful of open tabs / leaked
// connections can't exhaust sockets and memory on a single small VM.
const MAX_CONNECTIONS_PER_USER = 5

const clients = new Map<number, Response[]>()

export function addClient(userId: number, res: Response): void {
  const existing = clients.get(userId) ?? []

  // Evict oldest connections until we're under the cap (after adding the new one).
  while (existing.length >= MAX_CONNECTIONS_PER_USER) {
    const oldest = existing.shift()
    oldest?.end()
  }

  existing.push(res)
  clients.set(userId, existing)

  res.on('close', () => {
    const conns = clients.get(userId)
    if (!conns) return
    const filtered = conns.filter(c => c !== res)
    if (filtered.length === 0) {
      clients.delete(userId)
    } else {
      clients.set(userId, filtered)
    }
  })
}

export function sendEvent(userId: number, event: SseEvent): void {
  const conns = clients.get(userId)
  if (!conns) return

  const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
  for (const res of conns) {
    res.write(payload)
  }
}
