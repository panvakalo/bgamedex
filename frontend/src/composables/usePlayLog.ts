import { ref } from 'vue'
import { type Play, type PlayStats } from '../types/game'
import { useAuth } from './useAuth'

export function usePlayLog() {
  const plays = ref<Play[]>([])
  const stats = ref<PlayStats | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const logPlay = async (gameId: number, date?: string) => {
    const { getAuthHeaders } = useAuth()
    const res = await fetch(`/api/games/${gameId}/plays`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(date ? { date } : {}),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as Play
  }

  const fetchPlays = async (gameId: number) => {
    loading.value = true
    error.value = null
    try {
      const { getAuthHeaders } = useAuth()
      const res = await fetch(`/api/games/${gameId}/plays`, { headers: getAuthHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      plays.value = await res.json()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch plays'
    } finally {
      loading.value = false
    }
  }

  const deletePlay = async (gameId: number, playId: number) => {
    const { getAuthHeaders } = useAuth()
    const res = await fetch(`/api/games/${gameId}/plays/${playId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  }

  const fetchStats = async () => {
    loading.value = true
    error.value = null
    try {
      const { getAuthHeaders } = useAuth()
      const res = await fetch('/api/stats', { headers: getAuthHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      stats.value = await res.json()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch stats'
    } finally {
      loading.value = false
    }
  }

  return { plays, stats, loading, error, logPlay, fetchPlays, deletePlay, fetchStats }
}
