import { fetchWithTimeout } from './fetch-utils.js'

describe('fetchWithTimeout', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should pass through to fetch for a successful response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }))

    const res = await fetchWithTimeout('https://example.com')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  it('should abort the request when timeout is exceeded', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, opts) => {
      return new Promise((_resolve, reject) => {
        opts?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    })

    const promise = fetchWithTimeout('https://slow.example.com', { timeout: 500 })
    vi.advanceTimersByTime(500)

    await expect(promise).rejects.toThrow()
    vi.useRealTimers()
  })

  it('should not abort if response arrives before timeout', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('fast'))

    const res = await fetchWithTimeout('https://fast.example.com', { timeout: 5000 })
    expect(res.status).toBe(200)

    // Advance past timeout — should not throw
    vi.advanceTimersByTime(10000)
    vi.useRealTimers()
  })
})
