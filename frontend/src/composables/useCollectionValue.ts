import { ref, computed } from 'vue'
import { type CollectionValue } from '../types/game'
import { useAuth } from './useAuth'

const CURRENCY_KEY = 'bgamedex_price_currency'
const DESTINATION_KEY = 'bgamedex_price_destination'

export function useCollectionValue() {
  const data = ref<CollectionValue | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const currency = ref(localStorage.getItem(CURRENCY_KEY) || 'EUR')
  const destination = ref(localStorage.getItem(DESTINATION_KEY) || 'NL')

  const totalValue = computed(() => {
    const games = data.value?.games ?? []
    return Math.round(
      games.reduce((sum, g) => sum + (g.lowestPrice ?? g.manualPrice ?? 0), 0) * 100,
    ) / 100
  })

  const pricedGames = computed(() =>
    (data.value?.games ?? []).filter((g) => g.lowestPrice !== null || g.manualPrice !== null),
  )

  const unpricedGames = computed(() =>
    (data.value?.games ?? []).filter((g) => g.lowestPrice === null && g.manualPrice === null),
  )

  const avgPerGame = computed(() => {
    const count = pricedGames.value.length
    if (count === 0) return 0
    return Math.round((totalValue.value / count) * 100) / 100
  })

  const fetchPrices = async () => {
    loading.value = true
    error.value = null
    try {
      const { getAuthHeaders } = useAuth()
      const params = new URLSearchParams({ currency: currency.value, destination: destination.value })
      const res = await fetch(`/api/prices?${params}`, { headers: getAuthHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      data.value = await res.json()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch prices'
    } finally {
      loading.value = false
    }
  }

  const setCurrency = (value: string) => {
    currency.value = value
    localStorage.setItem(CURRENCY_KEY, value)
    fetchPrices()
  }

  const setDestination = (value: string) => {
    destination.value = value
    localStorage.setItem(DESTINATION_KEY, value)
    fetchPrices()
  }

  const setManualPrice = async (gameId: number, price: number) => {
    const { getAuthHeaders } = useAuth()
    const res = await fetch(`/api/prices/${gameId}/manual`, {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ price }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    // Update local state
    const game = data.value?.games.find((g) => g.gameId === gameId)
    if (game) game.manualPrice = price
  }

  const clearManualPrice = async (gameId: number) => {
    const { getAuthHeaders } = useAuth()
    const res = await fetch(`/api/prices/${gameId}/manual`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const game = data.value?.games.find((g) => g.gameId === gameId)
    if (game) game.manualPrice = null
  }

  return {
    data,
    loading,
    error,
    currency,
    destination,
    totalValue,
    pricedGames,
    unpricedGames,
    avgPerGame,
    fetchPrices,
    setCurrency,
    setDestination,
    setManualPrice,
    clearManualPrice,
  }
}
