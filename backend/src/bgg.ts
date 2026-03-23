import 'dotenv/config'
import { fetchWithTimeout } from './fetch-utils.js'

const BGG_TOKEN = process.env.BBG_BEARER_TOKEN ?? null

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#10;/g, '\n')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&hellip;/g, '\u2026')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

export function extractXmlValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)
  const match = xml.match(regex)
  return match ? match[1].trim() : null
}

export function extractXmlAttribute(xml: string, tag: string, attr: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`)
  const match = xml.match(regex)
  return match ? match[1] : null
}

export function extractMechanics(xml: string): string[] {
  const mechanics: string[] = []
  const regex = /<link type="boardgamemechanic"[^>]*value="([^"]*)"/g
  let match
  while ((match = regex.exec(xml)) !== null) {
    mechanics.push(decodeHtmlEntities(match[1]))
  }
  return mechanics
}

export function bggHeaders(): Record<string, string> {
  return BGG_TOKEN ? { Authorization: `Bearer ${BGG_TOKEN}` } : {}
}

function bggBaseUrl(): string {
  return BGG_TOKEN ? 'https://api.geekdo.com' : 'https://boardgamegeek.com'
}

export async function searchBgg(title: string): Promise<number | null> {
  const url = `${bggBaseUrl()}/xmlapi2/search?query=${encodeURIComponent(title)}&type=boardgame&exact=1`
  try {
    const res = await fetchWithTimeout(url, { headers: bggHeaders() })
    if (!res.ok) return null
    const xml = await res.text()
    const id = extractXmlAttribute(xml, 'item', 'id')
    return id ? parseInt(id, 10) : null
  } catch {
    return null
  }
}

export interface BggSearchResult {
  bggId: number
  name: string
  yearPublished: number | null
}

export async function searchBggMultiple(query: string): Promise<BggSearchResult[]> {
  const url = `${bggBaseUrl()}/xmlapi2/search?query=${encodeURIComponent(query)}&type=boardgame`
  try {
    const res = await fetchWithTimeout(url, { headers: bggHeaders() })
    if (!res.ok) return []
    const xml = await res.text()

    const results: BggSearchResult[] = []
    const itemRegex = /<item\s[^>]*id="(\d+)"[^>]*>([\s\S]*?)<\/item>/g
    let match
    while ((match = itemRegex.exec(xml)) !== null) {
      const bggId = parseInt(match[1], 10)
      const itemXml = match[2]
      const rawName = extractXmlAttribute(itemXml, 'name', 'value') ?? 'Unknown'
      const name = decodeHtmlEntities(rawName)
      const yearStr = extractXmlAttribute(itemXml, 'yearpublished', 'value')
      const yearPublished = yearStr ? parseInt(yearStr, 10) : null
      results.push({ bggId, name, yearPublished })
    }

    // Sort by relevance: exact matches first, then shorter names (base games
    // over expansions), then newer games to break ties.
    const q = query.toLowerCase()
    results.sort((a, b) => {
      const aLower = a.name.toLowerCase()
      const bLower = b.name.toLowerCase()
      const aExact = aLower === q ? 1 : 0
      const bExact = bLower === q ? 1 : 0
      if (aExact !== bExact) return bExact - aExact

      const aStarts = aLower.startsWith(q) ? 1 : 0
      const bStarts = bLower.startsWith(q) ? 1 : 0
      if (aStarts !== bStarts) return bStarts - aStarts

      if (a.name.length !== b.name.length) return a.name.length - b.name.length

      const aYear = a.yearPublished ?? 0
      const bYear = b.yearPublished ?? 0
      return bYear - aYear
    })

    return results
  } catch {
    return []
  }
}

export interface BggThingResult {
  name: string | null
  description: string | null
  imageUrl: string | null
  mechanics: string[]
  minPlayers: number | null
  maxPlayers: number | null
  minPlaytime: number | null
  maxPlaytime: number | null
}

export async function fetchBggThumbnail(bggId: number): Promise<string | null> {
  const url = `${bggBaseUrl()}/xmlapi2/thing?id=${bggId}`
  try {
    const res = await fetchWithTimeout(url, { headers: bggHeaders() })
    if (!res.ok) return null
    const xml = await res.text()
    return extractXmlValue(xml, 'thumbnail') ?? extractXmlValue(xml, 'image') ?? null
  } catch {
    return null
  }
}

export async function fetchBggThing(bggId: number, retries = 3): Promise<BggThingResult> {
  const url = `${bggBaseUrl()}/xmlapi2/thing?id=${bggId}`
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, { headers: bggHeaders() })
      if (res.status === 202) {
        await delay(3000)
        continue
      }
      if (!res.ok) return { name: null, description: null, imageUrl: null, mechanics: [], minPlayers: null, maxPlayers: null, minPlaytime: null, maxPlaytime: null }
      const xml = await res.text()

      const imageUrl = extractXmlValue(xml, 'image')
      if (!imageUrl && attempt < retries - 1) {
        await delay(2000)
        continue
      }

      let name = extractXmlAttribute(xml, 'name', 'value')
      if (name) name = decodeHtmlEntities(name)

      let description = extractXmlValue(xml, 'description')
      if (description) {
        description = decodeHtmlEntities(description)
      }

      const mechanics = extractMechanics(xml)

      const minPlayersStr = extractXmlAttribute(xml, 'minplayers', 'value')
      const maxPlayersStr = extractXmlAttribute(xml, 'maxplayers', 'value')
      const minPlaytimeStr = extractXmlAttribute(xml, 'minplaytime', 'value')
      const maxPlaytimeStr = extractXmlAttribute(xml, 'maxplaytime', 'value')

      return {
        name: name ?? null,
        description,
        imageUrl: imageUrl ?? null,
        mechanics,
        minPlayers: minPlayersStr ? parseInt(minPlayersStr, 10) : null,
        maxPlayers: maxPlayersStr ? parseInt(maxPlayersStr, 10) : null,
        minPlaytime: minPlaytimeStr ? parseInt(minPlaytimeStr, 10) : null,
        maxPlaytime: maxPlaytimeStr ? parseInt(maxPlaytimeStr, 10) : null,
      }
    } catch {
      if (attempt < retries - 1) {
        await delay(2000)
        continue
      }
      return { name: null, description: null, imageUrl: null, mechanics: [], minPlayers: null, maxPlayers: null, minPlaytime: null, maxPlaytime: null }
    }
  }
  return { name: null, description: null, imageUrl: null, mechanics: [], minPlayers: null, maxPlayers: null, minPlaytime: null, maxPlaytime: null }
}

export interface BggRulesFile {
  fileid: number
  filename: string
  title: string
  filepageUrl: string
  downloadUrl: string
}

export async function fetchBggRulesFiles(bggId: number): Promise<BggRulesFile[]> {
  const url = `https://api.geekdo.com/api/files?objectid=${bggId}&objecttype=thing&filetype=Rules&languageid=2184&nosession=1&sort=hot&page=1`
  try {
    const res = await fetchWithTimeout(url)
    if (!res.ok) return []
    const data = await res.json() as { files?: Array<{ fileid: string; filename: string; title: string; href: string }> }
    if (!data.files) return []

    return data.files
      .filter((f) => f.filename.endsWith('.pdf'))
      .slice(0, 10)
      .map((f) => ({
        fileid: parseInt(f.fileid, 10),
        filename: f.filename,
        title: f.title,
        filepageUrl: `https://boardgamegeek.com${f.href}`,
        downloadUrl: `https://boardgamegeek.com/file/download/${f.fileid}/${encodeURIComponent(f.filename)}`,
      }))
  } catch {
    return []
  }
}
