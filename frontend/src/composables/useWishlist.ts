import { ref } from 'vue'
import type { Game } from '../types/game'

const wishlist = ref<Game[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

export function useWishlist() {
  async function fetchWishlist() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/games/wishlist', { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      wishlist.value = await res.json()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load wishlist'
    } finally {
      loading.value = false
    }
  }

  async function moveToCollection(gameId: number) {
    const res = await fetch(`/api/games/${gameId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'collection' }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    wishlist.value = wishlist.value.filter((g) => g.id !== gameId)
  }

  async function removeFromWishlist(gameId: number) {
    const res = await fetch(`/api/games/${gameId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    wishlist.value = wishlist.value.filter((g) => g.id !== gameId)
  }

  return { wishlist, loading, error, fetchWishlist, moveToCollection, removeFromWishlist }
}
