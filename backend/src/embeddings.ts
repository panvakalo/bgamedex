import OpenAI from 'openai'

const MODEL = 'text-embedding-3-small'

let client: OpenAI | null = null

function getClient(): OpenAI | null {
  if (client) return client
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  client = new OpenAI({ apiKey })
  return client
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const c = getClient()
  if (!c) return null
  const res = await c.embeddings.create({ model: MODEL, input: text })
  return res.data[0].embedding
}

export async function generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  const c = getClient()
  if (!c) return texts.map(() => null)
  if (texts.length === 0) return []

  // OpenAI supports batch embedding — send all at once (max ~8k inputs)
  const res = await c.embeddings.create({ model: MODEL, input: texts })
  // Response items are sorted by index
  const sorted = res.data.sort((a, b) => a.index - b.index)
  return sorted.map(d => d.embedding)
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}
