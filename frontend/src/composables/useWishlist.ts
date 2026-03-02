import { ref } from 'vue'
import type { Game } from '../types/game'
import { useAuth } from './useAuth'

const wishlist = ref<Game[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

export function useWishlist() {
  async function fetchWishlist() {
    loading.value = true
    error.value = null
    try {
      const { getAuthHeaders } = useAuth()
      const res = await fetch('/api/games/wishlist', { headers: getAuthHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      wishlist.value = await res.json()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load wishlist'
    } finally {
      loading.value = false
    }
  }

  async function moveToCollection(gameId: number) {
    const { getAuthHeaders } = useAuth()
    const res = await fetch(`/api/games/${gameId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ status: 'collection' }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    wishlist.value = wishlist.value.filter((g) => g.id !== gameId)
  }

  async function removeFromWishlist(gameId: number) {
    const { getAuthHeaders } = useAuth()
    const res = await fetch(`/api/games/${gameId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    wishlist.value = wishlist.value.filter((g) => g.id !== gameId)
  }

  return { wishlist, loading, error, fetchWishlist, moveToCollection, removeFromWishlist }
}
