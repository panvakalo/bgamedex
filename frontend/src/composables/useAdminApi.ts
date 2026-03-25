import { useAdminAuth } from './useAdminAuth'

export function useAdminApi() {
  const { logout } = useAdminAuth()

  async function adminFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
    const headers = {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    }

    const res = await fetch(url, { ...options, headers, credentials: 'include' })

    if (res.status === 401 || res.status === 403) {
      logout()
      throw new Error('Admin session expired')
    }

    let data: Record<string, unknown>
    try {
      data = await res.json()
    } catch {
      throw new Error('Invalid response from server')
    }
    if (!res.ok) throw new Error((data.error as string) ?? 'Request failed')

    return data as T
  }

  return { adminFetch }
}
