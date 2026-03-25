// We can only import the non-async helpers directly since fetchRulesFromWeb
// depends on network. We'll test the pure functions by extracting them via
// a module-level trick: re-export them from the test to verify behavior.
//
// Since slugify and stripHtml are not exported, we test them indirectly through
// the module's behavior — or we can replicate the logic here to verify the
// contract. Instead, let's test the exported function with mocked fetch.

import { fetchRulesFromWeb } from './rules-search.js'

describe('fetchRulesFromWeb', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return parsed rules text from a valid page', async () => {
    const html = `
      <html>
      <body>
      <h2>Setup</h2>
      <p>${'Setup instructions that are long enough to pass the length check. '.repeat(5)}</p>
      <h2>Gameplay</h2>
      <p>${'Gameplay rules with lots of detail about how the game works. '.repeat(5)}</p>
      </body>
      </html>
    `
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(html, { status: 200 }))

    const result = await fetchRulesFromWeb('Catan')
    expect(result).not.toBeNull()
    expect(result).toContain('## Setup')
    expect(result).toContain('## Gameplay')
  })

  it('should return null for a 301 redirect (game not found)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 301 }))

    const result = await fetchRulesFromWeb('Nonexistent Game')
    expect(result).toBeNull()
  })

  it('should return null for a 404 page', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html><title>404</title></html>', { status: 200 }),
    )

    const result = await fetchRulesFromWeb('Missing')
    expect(result).toBeNull()
  })

  it('should return null when page has no h2 sections', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html><body><p>Just some text</p></body></html>', { status: 200 }),
    )

    const result = await fetchRulesFromWeb('Empty Page')
    expect(result).toBeNull()
  })

  it('should return null when extracted text is too short (< 200 chars)', async () => {
    const html = '<html><body><h2>Rules</h2><p>Short.</p></body></html>'
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(html, { status: 200 }))

    const result = await fetchRulesFromWeb('Short Rules')
    expect(result).toBeNull()
  })

  it('should return null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

    const result = await fetchRulesFromWeb('Any Game')
    expect(result).toBeNull()
  })

  it('should skip non-rules sections like comments and tutorials', async () => {
    const html = `
      <html><body>
      <h2>How to Play</h2>
      <p>${'Actual rules content with enough length to pass the minimum check. '.repeat(5)}</p>
      <h2>Tutorial Video</h2>
      <p>Watch this video to learn how to play.</p>
      <h2>Comments</h2>
      <p>User comment section below.</p>
      </body></html>
    `
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(html, { status: 200 }))

    const result = await fetchRulesFromWeb('Filter Test')
    expect(result).toContain('## How to Play')
    expect(result).not.toContain('Tutorial Video')
    expect(result).not.toContain('Comments')
  })

  it('should construct URL from slugified game title', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 301 }))

    await fetchRulesFromWeb("Ticket to Ride: Europe")
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://www.ultraboardgames.com/ticket-to-ride-europe/game-rules.php',
      expect.objectContaining({ redirect: 'manual' }),
    )
  })

  it('should replace ampersands with "and" in slugs', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 301 }))

    await fetchRulesFromWeb("Dungeons & Dragons")
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://www.ultraboardgames.com/dungeons-and-dragons/game-rules.php',
      expect.objectContaining({ redirect: 'manual' }),
    )
  })

  it('should strip apostrophes from slugs', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 301 }))

    await fetchRulesFromWeb("King's Dilemma")
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://www.ultraboardgames.com/kings-dilemma/game-rules.php',
      expect.objectContaining({ redirect: 'manual' }),
    )
  })

  it('should strip script and style tags from content', async () => {
    const html = `
      <html><body>
      <script>alert('xss')</script>
      <style>.red { color: red; }</style>
      <h2>Rules</h2>
      <p>${'The actual rules content that matters and has enough text. '.repeat(5)}</p>
      </body></html>
    `
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(html, { status: 200 }))

    const result = await fetchRulesFromWeb('Safe Game')
    expect(result).not.toContain('alert')
    expect(result).not.toContain('.red')
    expect(result).toContain('## Rules')
  })
})
