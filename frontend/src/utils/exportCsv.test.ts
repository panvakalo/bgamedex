import type { Game } from '../types/game'
import { exportCsv } from './exportCsv'

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 1,
    title: 'Catan',
    min_players: 3,
    max_players: 4,
    min_duration: 60,
    max_duration: 120,
    is_card_game: 0,
    is_cooperative: 0,
    plays_in_teams: 0,
    supports_campaign: 0,
    rules_url: null,
    image_url: null,
    play_count: 5,
    status: 'collection',
    tags: [],
    ...overrides,
  }
}

function mockBlob() {
  return vi.spyOn(globalThis, 'Blob').mockImplementation(function(parts) {
    (this as unknown as Record<string, unknown>).content = parts?.[0]
    return this as unknown as Blob
  })
}

function getBlobContent(blobSpy: ReturnType<typeof mockBlob>): string {
  return (blobSpy.mock.instances[0] as unknown as Record<string, string>).content
}

describe('exportCsv', () => {
  let clickedHref: string | null = null
  let clickedDownload: string | null = null
  let revokedUrl: string | null = null

  beforeEach(() => {
    clickedHref = null
    clickedDownload = null
    revokedUrl = null

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => { revokedUrl = url })
    vi.spyOn(document, 'createElement').mockReturnValue({
      set href(v: string) { clickedHref = v },
      set download(v: string) { clickedDownload = v },
      click: vi.fn(),
    } as unknown as HTMLAnchorElement)
  })

  it('should generate CSV with correct headers', () => {
    const blobSpy = mockBlob()
    exportCsv([], 'test.csv')
    expect(getBlobContent(blobSpy)).toBe('Title,Min Players,Max Players,Min Duration (min),Max Duration (min),Card Game,Cooperative,Teams,Campaign,Tags,Plays')
    blobSpy.mockRestore()
  })

  it('should convert boolean fields to Yes/No', () => {
    const blobSpy = mockBlob()
    const game = makeGame({ is_card_game: 1, is_cooperative: 0, plays_in_teams: 1, supports_campaign: 0 })
    exportCsv([game], 'test.csv')
    const dataRow = getBlobContent(blobSpy).split('\n')[1]
    expect(dataRow).toContain('Yes,No,Yes,No')
    blobSpy.mockRestore()
  })

  it('should escape CSV fields containing commas', () => {
    const blobSpy = mockBlob()
    const game = makeGame({ title: 'Ticket to Ride, Europe' })
    exportCsv([game], 'test.csv')
    expect(getBlobContent(blobSpy)).toContain('"Ticket to Ride, Europe"')
    blobSpy.mockRestore()
  })

  it('should escape CSV fields containing double quotes', () => {
    const blobSpy = mockBlob()
    const game = makeGame({ title: 'A "Great" Game' })
    exportCsv([game], 'test.csv')
    expect(getBlobContent(blobSpy)).toContain('"A ""Great"" Game"')
    blobSpy.mockRestore()
  })

  it('should join tags with semicolons', () => {
    const blobSpy = mockBlob()
    const game = makeGame({ tags: [{ id: 1, name: 'Family' }, { id: 2, name: 'Strategy' }] })
    exportCsv([game], 'test.csv')
    expect(getBlobContent(blobSpy)).toContain('Family;Strategy')
    blobSpy.mockRestore()
  })

  it('should handle null player/duration values as empty strings', () => {
    const blobSpy = mockBlob()
    const game = makeGame({ min_players: null, max_players: null, min_duration: null, max_duration: null })
    exportCsv([game], 'test.csv')
    const dataRow = getBlobContent(blobSpy).split('\n')[1]
    expect(dataRow).toMatch(/^Catan,,,,/)
    blobSpy.mockRestore()
  })

  it('should set download filename and revoke blob URL', () => {
    vi.spyOn(globalThis, 'Blob').mockImplementation(function() { return this as unknown as Blob })
    exportCsv([], 'my-collection.csv')
    expect(clickedDownload).toBe('my-collection.csv')
    expect(clickedHref).toBe('blob:mock-url')
    expect(revokedUrl).toBe('blob:mock-url')
  })
})
