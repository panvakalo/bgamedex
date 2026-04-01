import { ref, computed } from 'vue'
import { type Game, type GameFilters, createDefaultFilters } from '../types/game'

export type SortOption = 'alpha' | 'added' | 'most-played' | 'duration'
export type SortDir = 'asc' | 'desc'

// Module-level state so games persist across view mounts (enables scroll restoration)
const allGames = ref<Game[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const filters = ref<GameFilters>(createDefaultFilters())
const sort = ref<SortOption>('alpha')
const sortDir = ref<SortDir>('asc')

export function useGames() {

  const fetchGames = async () => {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      if (filters.value.tag !== null) params.set('tag', String(filters.value.tag))
      const url = params.toString() ? `/api/games?${params}` : '/api/games'
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      allGames.value = await res.json()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch games'
    } finally {
      loading.value = false
    }
  }

  const filteredGames = computed(() => {
    const filtered = allGames.value.filter((game) => {
      if (filters.value.search) {
        const search = filters.value.search.toLowerCase()
        if (!game.title.toLowerCase().includes(search)) return false
      }

      if (filters.value.players !== null) {
        const p = filters.value.players
        if (game.min_players !== null && p < game.min_players) return false
        if (game.max_players !== null && p > game.max_players) return false
      }

      if (filters.value.duration !== null) {
        const d = filters.value.duration
        // Show games that can be finished within the given time
        if (game.min_duration !== null && game.min_duration > d) return false
      }

      if (filters.value.isCardGame !== null) {
        if (!!game.is_card_game !== filters.value.isCardGame) return false
      }

      if (filters.value.isCooperative !== null) {
        if (!!game.is_cooperative !== filters.value.isCooperative) return false
      }

      if (filters.value.playsInTeams !== null) {
        if (!!game.plays_in_teams !== filters.value.playsInTeams) return false
      }

      if (filters.value.supportsCampaign !== null) {
        if (!!game.supports_campaign !== filters.value.supportsCampaign) return false
      }

      return true
    })

    const sorted = [...filtered]
    const dir = sortDir.value === 'asc' ? 1 : -1
    switch (sort.value) {
      case 'alpha':
        sorted.sort((a, b) => dir * a.title.localeCompare(b.title))
        break
      case 'added':
        sorted.sort((a, b) => dir * (a.id - b.id))
        break
      case 'most-played':
        sorted.sort((a, b) => dir * (a.play_count - b.play_count) || a.title.localeCompare(b.title))
        break
      case 'duration':
        sorted.sort((a, b) => dir * ((a.min_duration ?? Infinity) - (b.min_duration ?? Infinity)))
        break
    }
    return sorted
  })

  const clearFilters = () => {
    filters.value = createDefaultFilters()
  }

  const hasActiveFilters = computed(() => {
    const f = filters.value
    return (
      f.search !== '' ||
      f.players !== null ||
      f.duration !== null ||
      f.isCardGame !== null ||
      f.isCooperative !== null ||
      f.playsInTeams !== null ||
      f.supportsCampaign !== null ||
      f.tag !== null
    )
  })

  return { allGames, filteredGames, filters, sort, sortDir, loading, error, fetchGames, clearFilters, hasActiveFilters }
}
