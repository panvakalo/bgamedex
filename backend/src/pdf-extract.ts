import { createRequire } from 'module'
import { fetchWithTimeout } from './fetch-utils.js'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>

export async function extractTextFromUrl(url: string): Promise<string> {
  const response = await fetchWithTimeout(url, { timeout: 15_000 })

  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: HTTP ${response.status}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/pdf')) {
    throw new Error(`Expected PDF but got content-type: ${contentType}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const data = await pdfParse(buffer)

  if (!data.text.trim()) {
    throw new Error('PDF contains no extractable text')
  }

  return data.text
}
