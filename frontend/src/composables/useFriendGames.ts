import { ref } from 'vue'
import type { FriendUser } from '../types/friend'
import type { Game } from '../types/game'

export function useFriendGames() {
  const games = ref<Game[]>([])
  const friendInfo = ref<FriendUser | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchFriendCollection = async (userId: number) => {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/friends/${userId}/collection`, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      friendInfo.value = data.friend
      games.value = data.games
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load collection'
      games.value = []
    } finally {
      loading.value = false
    }
  }

  const fetchFriendWishlist = async (userId: number) => {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/friends/${userId}/wishlist`, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      friendInfo.value = data.friend
      games.value = data.games
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load wishlist'
      games.value = []
    } finally {
      loading.value = false
    }
  }

  return { games, friendInfo, loading, error, fetchFriendCollection, fetchFriendWishlist }
}
