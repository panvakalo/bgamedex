import { ref } from 'vue'
import type { Tag } from '../types/game'
import { useAuth } from './useAuth'

export interface TagWithCount extends Tag {
  game_count: number
}

export function useTags() {
  const tags = ref<TagWithCount[]>([])
  const loading = ref(false)

  const fetchTags = async () => {
    loading.value = true
    try {
      const { getAuthHeaders } = useAuth()
      const res = await fetch('/api/tags', { headers: getAuthHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      tags.value = await res.json()
    } finally {
      loading.value = false
    }
  }

  const createTag = async (name: string): Promise<Tag> => {
    const { getAuthHeaders } = useAuth()
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    const tag = await res.json()
    await fetchTags()
    return tag
  }

  const renameTag = async (id: number, name: string) => {
    const { getAuthHeaders } = useAuth()
    const res = await fetch(`/api/tags/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    await fetchTags()
  }

  const deleteTag = async (id: number) => {
    const { getAuthHeaders } = useAuth()
    const res = await fetch(`/api/tags/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await fetchTags()
  }

  const setGameTags = async (gameId: number, tagIds: number[], newTags: string[] = []): Promise<Tag[]> => {
    const { getAuthHeaders } = useAuth()
    const res = await fetch(`/api/games/${gameId}/tags`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ tagIds, newTags }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    // Refresh tag list to update counts
    fetchTags()
    return await res.json()
  }

  return { tags, loading, fetchTags, createTag, renameTag, deleteTag, setGameTags }
}
