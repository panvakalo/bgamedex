import { getDb } from './database.js'
import { chunkRulesText } from './chunk-text.js'
import { generateEmbedding, generateEmbeddings, cosineSimilarity } from './embeddings.js'

export { chunkRulesText } from './chunk-text.js'

export async function storeRulesChunks(bggId: number, text: string): Promise<void> {
  const db = getDb()
  const chunks = chunkRulesText(text)

  // Generate embeddings for all chunks (returns nulls if no API key)
  const embeddings = await generateEmbeddings(chunks)

  const del = db.prepare('DELETE FROM rules_chunks WHERE bgg_id = ?')
  const insert = db.prepare(
    'INSERT INTO rules_chunks (bgg_id, chunk_index, chunk_text, embedding) VALUES (?, ?, ?, ?)'
  )

  const tx = db.transaction(() => {
    del.run(bggId)
    for (let i = 0; i < chunks.length; i++) {
      const emb = embeddings[i]
      insert.run(bggId, i, chunks[i], emb ? JSON.stringify(emb) : null)
    }
  })
  tx()
  console.log(`[rules-chunker] Stored ${chunks.length} chunks for bgg_id=${bggId} (embeddings: ${embeddings.filter(Boolean).length})`)
}

export async function searchRulesChunks(bggId: number, query: string, limit = 5): Promise<string[]> {
  const db = getDb()

  // Try embedding-based search first
  const queryEmbedding = await generateEmbedding(query)
  if (queryEmbedding) {
    const rows = db.prepare(
      'SELECT chunk_text, embedding FROM rules_chunks WHERE bgg_id = ? AND embedding IS NOT NULL'
    ).all(bggId) as { chunk_text: string; embedding: string }[]

    if (rows.length > 0) {
      const scored = rows.map(r => ({
        text: r.chunk_text,
        score: cosineSimilarity(queryEmbedding, JSON.parse(r.embedding) as number[]),
      }))
      scored.sort((a, b) => b.score - a.score)
      const top = scored.slice(0, limit)

      console.log(`[rules-chunker] Embedding search bgg_id=${bggId} query="${query.slice(0, 80)}" → ${top.length} chunks (scores: ${top.map(c => c.score.toFixed(3)).join(', ')})`)
      return top.map(c => c.text)
    }
  }

  // Fallback to FTS5 keyword search
  return searchRulesChunksFts(bggId, query, limit)
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'am', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she',
  'it', 'its', 'they', 'them', 'their', 'this', 'that', 'these', 'those',
  'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'and', 'but', 'or', 'nor', 'not', 'so', 'if', 'then', 'than',
  'too', 'very', 'just', 'also', 'no', 'yes', 'up', 'out', 'off',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'some', 'any',
  'tell', 'explain', 'describe', 'please', 'help', 'know', 'get',
])

function searchRulesChunksFts(bggId: number, query: string, limit: number): string[] {
  const db = getDb()

  const sanitized = query.replace(/[^\w\s]/g, ' ').trim()
  if (!sanitized) return []

  const allTerms = sanitized.split(/\s+/).filter(Boolean)
  const contentTerms = allTerms.filter(t => !STOP_WORDS.has(t.toLowerCase()))
  const terms = contentTerms.length > 0 ? contentTerms : allTerms
  if (terms.length === 0) return []

  const ftsQuery = terms.join(' OR ')

  try {
    const rows = db.prepare(`
      SELECT rc.chunk_text
      FROM rules_chunks_fts fts
      JOIN rules_chunks rc ON rc.id = fts.rowid
      WHERE rules_chunks_fts MATCH ? AND rc.bgg_id = ?
      ORDER BY fts.rank
      LIMIT ?
    `).all(ftsQuery, bggId, limit) as { chunk_text: string }[]

    console.log(`[rules-chunker] FTS search bgg_id=${bggId} query="${ftsQuery}" → ${rows.length} chunks`)
    return rows.map(r => r.chunk_text)
  } catch (err) {
    console.error(`[rules-chunker] FTS5 search failed for bgg_id=${bggId}:`, err instanceof Error ? err.message : err)
    return []
  }
}
