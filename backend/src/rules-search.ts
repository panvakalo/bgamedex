import { fetchWithTimeout } from './fetch-utils.js'

/**
 * Searches for game rules text from public web sources.
 * Tries ultraboardgames.com which hosts HTML rules for thousands of board games.
 */

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n /g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function fetchRulesFromWeb(gameTitle: string): Promise<string | null> {
  const slug = slugify(gameTitle)
  const url = `https://www.ultraboardgames.com/${slug}/game-rules.php`

  try {
    const res = await fetchWithTimeout(url, { redirect: 'manual' })

    // 301 redirect to index.php means game not found
    if (res.status !== 200) return null

    const html = await res.text()

    // Verify it's actually a rules page (not a redirect page or error)
    if (!html.includes('<h2>') || html.includes('<title>404')) return null

    // Remove script, style, nav, footer, and ad sections
    let content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')

    // Extract text from h2/h3 sections (the rules content)
    const sectionRegex = /<h([23])[^>]*>(.*?)<\/h\1>([\s\S]*?)(?=<h[23]|<div class="ad|<div id="disqus|$)/gi
    const sections: string[] = []
    let match

    while ((match = sectionRegex.exec(content)) !== null) {
      const heading = stripHtml(match[2]).trim()
      const body = stripHtml(match[3]).trim()

      // Skip non-rules sections
      if (/tutorial video|comment|disqus|advertisement|related game/i.test(heading)) continue

      if (body.length > 10) {
        const level = match[1] === '2' ? '##' : '###'
        sections.push(`${level} ${heading}\n${body}`)
      }
    }

    if (sections.length === 0) return null

    const rulesText = sections.join('\n\n')

    // Sanity check: rules should be at least a few hundred characters
    if (rulesText.length < 200) return null

    return rulesText
  } catch {
    return null
  }
}
