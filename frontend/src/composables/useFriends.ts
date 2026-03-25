import { ref } from 'vue'
import type { Friend, FriendRequest, UserSearchResult } from '../types/friend'

const friends = ref<Friend[]>([])
const pendingRequests = ref<FriendRequest[]>([])
const pendingCount = ref(0)
const loading = ref(false)

export function useFriends() {
  const fetchFriends = async () => {
    loading.value = true
    try {
      const res = await fetch('/api/friends', { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      friends.value = await res.json()
    } catch {
      friends.value = []
    } finally {
      loading.value = false
    }
  }

  const fetchPendingRequests = async () => {
    try {
      const res = await fetch('/api/friends/requests', { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      pendingRequests.value = await res.json()
    } catch {
      pendingRequests.value = []
    }
  }

  const fetchPendingCount = async () => {
    try {
      const res = await fetch('/api/friends/requests/count', { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      pendingCount.value = data.count
    } catch {
      pendingCount.value = 0
    }
  }

  const searchUsers = async (query: string): Promise<UserSearchResult[]> => {
    if (query.trim().length < 2) return []
    const res = await fetch(`/api/friends/search?q=${encodeURIComponent(query.trim())}`, {
      credentials: 'include',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  const sendRequest = async (userId: number) => {
    const res = await fetch('/api/friends/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    return res.json()
  }

  const respondToRequest = async (friendshipId: number, action: 'accept' | 'reject') => {
    const res = await fetch(`/api/friends/requests/${friendshipId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    return res.json()
  }

  const removeFriend = async (friendshipId: number) => {
    const res = await fetch(`/api/friends/${friendshipId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    friends.value = friends.value.filter(f => f.friendshipId !== friendshipId)
  }

  return {
    friends,
    pendingRequests,
    pendingCount,
    loading,
    fetchFriends,
    fetchPendingRequests,
    fetchPendingCount,
    searchUsers,
    sendRequest,
    respondToRequest,
    removeFriend,
  }
}
