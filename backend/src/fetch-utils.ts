const DEFAULT_TIMEOUT_MS = 10_000

export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {},
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
