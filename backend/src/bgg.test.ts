import { decodeHtmlEntities, extractXmlValue, extractXmlAttribute, extractMechanics, searchBggMultiple, delay } from './bgg.js'

describe('decodeHtmlEntities', () => {
  it('should decode basic HTML entities', () => {
    expect(decodeHtmlEntities('&amp; &lt; &gt; &quot;')).toBe('& < > "')
  })

  it('should decode typographic entities', () => {
    expect(decodeHtmlEntities('&ndash; &mdash; &rsquo; &lsquo;')).toBe('\u2013 \u2014 \u2019 \u2018')
  })

  it('should decode quote entities', () => {
    expect(decodeHtmlEntities('&ldquo;hello&rdquo;')).toBe('\u201Chello\u201D')
  })

  it('should decode numeric character references', () => {
    expect(decodeHtmlEntities('&#65;&#66;&#67;')).toBe('ABC')
  })

  it('should decode &#10; as newline', () => {
    expect(decodeHtmlEntities('line1&#10;line2')).toBe('line1\nline2')
  })

  it('should decode &hellip; as ellipsis', () => {
    expect(decodeHtmlEntities('wait&hellip;')).toBe('wait\u2026')
  })

  it('should return plain text unchanged', () => {
    expect(decodeHtmlEntities('no entities here')).toBe('no entities here')
  })
})

describe('extractXmlValue', () => {
  it('should extract text content from a tag', () => {
    const xml = '<root><name>Catan</name></root>'
    expect(extractXmlValue(xml, 'name')).toBe('Catan')
  })

  it('should return trimmed content', () => {
    const xml = '<description>  Some text  </description>'
    expect(extractXmlValue(xml, 'description')).toBe('Some text')
  })

  it('should return null for a missing tag', () => {
    const xml = '<root><name>Catan</name></root>'
    expect(extractXmlValue(xml, 'missing')).toBeNull()
  })
})

describe('extractXmlAttribute', () => {
  it('should extract an attribute value', () => {
    const xml = '<item type="boardgame" id="123">'
    expect(extractXmlAttribute(xml, 'item', 'id')).toBe('123')
  })

  it('should return null for a missing attribute', () => {
    const xml = '<item type="boardgame">'
    expect(extractXmlAttribute(xml, 'item', 'id')).toBeNull()
  })

  it('should return null for a missing tag', () => {
    const xml = '<other id="1">'
    expect(extractXmlAttribute(xml, 'item', 'id')).toBeNull()
  })
})

describe('extractMechanics', () => {
  it('should extract mechanic values from XML', () => {
    const xml = `
      <link type="boardgamemechanic" id="1" value="Dice Rolling"/>
      <link type="boardgamemechanic" id="2" value="Hand Management"/>
      <link type="boardgamecategory" id="3" value="Strategy"/>
    `
    const result = extractMechanics(xml)
    expect(result).toEqual(['Dice Rolling', 'Hand Management'])
  })

  it('should return an empty array when no mechanics exist', () => {
    const xml = '<link type="boardgamecategory" id="1" value="Strategy"/>'
    expect(extractMechanics(xml)).toEqual([])
  })

  it('should decode HTML entities in mechanic names', () => {
    const xml = '<link type="boardgamemechanic" id="1" value="Pick-up &amp; Deliver"/>'
    const result = extractMechanics(xml)
    expect(result).toEqual(['Pick-up & Deliver'])
  })
})

describe('searchBggMultiple – sorting', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function buildSearchXml(items: { id: number; name: string; year?: number }[]): string {
    const itemXml = items.map((i) =>
      `<item type="boardgame" id="${i.id}"><name type="primary" value="${i.name}"/>${i.year ? `<yearpublished value="${i.year}"/>` : ''}</item>`
    ).join('')
    return `<?xml version="1.0"?><items total="${items.length}">${itemXml}</items>`
  }

  it('should rank exact matches first', async () => {
    const xml = buildSearchXml([
      { id: 1, name: 'Catan: Seafarers', year: 2020 },
      { id: 2, name: 'Catan', year: 1995 },
      { id: 3, name: 'Catan: Cities & Knights', year: 2015 },
    ])
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(xml, { status: 200 }))

    const results = await searchBggMultiple('Catan')
    expect(results[0].name).toBe('Catan')
  })

  it('should rank "starts with" matches before partial matches', async () => {
    const xml = buildSearchXml([
      { id: 1, name: 'Mega Catan Edition', year: 2020 },
      { id: 2, name: 'Catan Junior', year: 2012 },
    ])
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(xml, { status: 200 }))

    const results = await searchBggMultiple('Catan')
    expect(results[0].name).toBe('Catan Junior')
  })

  it('should rank shorter names before longer names (base game over expansion)', async () => {
    const xml = buildSearchXml([
      { id: 1, name: 'Azul: Summer Pavilion', year: 2019 },
      { id: 2, name: 'Azul: Stained Glass', year: 2018 },
      { id: 3, name: 'Azul', year: 2017 },
    ])
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(xml, { status: 200 }))

    const results = await searchBggMultiple('Azul')
    expect(results[0].name).toBe('Azul')
  })

  it('should break ties by newer year', async () => {
    const xml = buildSearchXml([
      { id: 1, name: 'Pandemic Legacy', year: 2015 },
      { id: 2, name: 'Pandemic Legacy', year: 2017 },
    ])
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(xml, { status: 200 }))

    const results = await searchBggMultiple('Pandemic Legacy')
    expect(results[0].yearPublished).toBe(2017)
  })

  it('should return empty array on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

    const results = await searchBggMultiple('Anything')
    expect(results).toEqual([])
  })

  it('should return empty array on non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }))

    const results = await searchBggMultiple('Anything')
    expect(results).toEqual([])
  })

  it('should decode HTML entities in result names', async () => {
    const xml = buildSearchXml([
      { id: 1, name: 'Dungeons &amp; Dragons', year: 2024 },
    ])
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(xml, { status: 200 }))

    const results = await searchBggMultiple('Dungeons')
    expect(results[0].name).toBe('Dungeons & Dragons')
  })

  it('should handle items with no year published', async () => {
    const xml = buildSearchXml([
      { id: 1, name: 'Mystery Game' },
    ])
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(xml, { status: 200 }))

    const results = await searchBggMultiple('Mystery')
    expect(results[0].yearPublished).toBeNull()
  })
})

describe('delay', () => {
  it('should resolve after the specified time', async () => {
    vi.useFakeTimers()
    let resolved = false
    delay(1000).then(() => { resolved = true })

    expect(resolved).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(resolved).toBe(true)
    vi.useRealTimers()
  })
})
