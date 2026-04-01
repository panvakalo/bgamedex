const CHUNK_SIZE = 3200
const CHUNK_OVERLAP = 200

export function chunkRulesText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text]

  const paragraphs = text.split(/\n{2,}/)
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim())
      // Overlap: keep the tail of the previous chunk
      const overlap = current.slice(-CHUNK_OVERLAP)
      current = overlap + '\n\n' + para
    } else {
      current = current ? current + '\n\n' + para : para
    }
  }

  if (current.trim()) {
    chunks.push(current.trim())
  }

  // If no paragraph breaks split the text, fall back to hard splits
  if (chunks.length === 0) {
    for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
      chunks.push(text.slice(i, i + CHUNK_SIZE))
    }
  }

  return chunks
}
