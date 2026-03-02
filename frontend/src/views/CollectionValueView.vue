<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useCollectionValue } from '../composables/useCollectionValue'

const {
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
} = useCollectionValue()

const expandedGameId = ref<number | null>(null)
const manualPriceInputs = ref<Record<number, string>>({})
const savingManualPrice = ref<number | null>(null)

function toggleExpand(gameId: number) {
  expandedGameId.value = expandedGameId.value === gameId ? null : gameId
}

async function saveManualPrice(gameId: number) {
  const raw = manualPriceInputs.value[gameId]
  const price = parseFloat(raw)
  if (!price || price <= 0) return
  savingManualPrice.value = gameId
  try {
    await setManualPrice(gameId, price)
    delete manualPriceInputs.value[gameId]
  } finally {
    savingManualPrice.value = null
  }
}

async function removeManualPrice(gameId: number) {
  savingManualPrice.value = gameId
  try {
    await clearManualPrice(gameId)
  } finally {
    savingManualPrice.value = null
  }
}

function formatPrice(value: number | null, curr: string): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('en', { style: 'currency', currency: curr }).format(value)
}

function stockLabel(stock: string): string {
  const labels: Record<string, string> = { Y: 'In stock', N: 'Out of stock', P: 'Pre-order', '?': 'Unknown' }
  return labels[stock.trim()] || 'Unknown'
}

function stockInStock(stock: string): boolean {
  return stock.trim() === 'Y'
}

const currencies = [
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'USD', label: 'USD ($)' },
]

const destinations = [
  { value: 'NL', label: 'Netherlands' },
  { value: 'BE', label: 'Belgium' },
  { value: 'DE', label: 'Germany' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'FR', label: 'France' },
]

onMounted(fetchPrices)
</script>

<template>
  <main class="max-w-4xl mx-auto px-4 py-6">
    <!-- Back link -->
    <RouterLink to="/" class="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent-light transition-colors mb-6">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back to games
    </RouterLink>

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <h1 class="text-3xl font-bold text-text-primary">Collection Value</h1>
      <div class="flex items-center gap-3">
        <select
          :value="currency"
          class="bg-surface border border-surface-lighter rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          @change="setCurrency(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="c in currencies" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
        <select
          :value="destination"
          class="bg-surface border border-surface-lighter rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          @change="setDestination(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="d in destinations" :key="d.value" :value="d.value">{{ d.label }}</option>
        </select>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <div class="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-20">
      <p class="text-xl text-text-secondary">{{ error }}</p>
    </div>

    <!-- Content -->
    <div v-else>
      <!-- Summary cards -->
      <div class="grid grid-cols-3 gap-2 sm:gap-4 mb-10">
        <div class="bg-surface rounded-xl border border-surface-lighter p-3 sm:p-6 text-center">
          <p class="text-lg sm:text-3xl font-bold text-accent-light truncate">{{ formatPrice(totalValue, currency) }}</p>
          <p class="text-xs sm:text-sm text-text-secondary mt-1">Total Value</p>
        </div>
        <div class="bg-surface rounded-xl border border-surface-lighter p-3 sm:p-6 text-center">
          <p class="text-lg sm:text-3xl font-bold text-accent-light">{{ pricedGames.length }}</p>
          <p class="text-xs sm:text-sm text-text-secondary mt-1">Games Priced</p>
        </div>
        <div class="bg-surface rounded-xl border border-surface-lighter p-3 sm:p-6 text-center">
          <p class="text-lg sm:text-3xl font-bold text-accent-light truncate">{{ formatPrice(avgPerGame, currency) }}</p>
          <p class="text-xs sm:text-sm text-text-secondary mt-1">Avg per Game</p>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="pricedGames.length === 0 && unpricedGames.length === 0" class="text-center py-12">
        <p class="text-text-secondary mb-4">No games with BGG IDs found in your collection.</p>
        <RouterLink to="/" class="text-accent-light hover:underline">Add games to your collection</RouterLink>
      </div>

      <!-- Priced games list -->
      <section v-if="pricedGames.length > 0" class="mb-10">
        <h2 class="text-xl font-semibold text-text-primary mb-4">Games</h2>
        <div class="space-y-2">
          <div v-for="game in pricedGames" :key="game.gameId">
            <!-- Game row -->
            <button
              class="w-full flex items-center gap-3 sm:gap-4 p-3 rounded-xl bg-surface border border-surface-lighter hover:border-accent/30 transition-colors text-left"
              @click="toggleExpand(game.gameId)"
            >
              <img
                v-if="game.imageUrl"
                :src="game.imageUrl"
                :alt="game.title"
                class="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover flex-shrink-0"
              />
              <div v-else class="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-surface-lighter flex-shrink-0" />
              <span class="flex-1 font-medium text-text-primary truncate text-sm sm:text-base">{{ game.title }}</span>
              <span
                v-if="game.lowestPrice === null && game.manualPrice !== null"
                class="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 flex-shrink-0 hidden sm:inline"
              >Manual</span>
              <span class="text-sm font-semibold text-accent-light flex-shrink-0">{{ formatPrice(game.lowestPrice ?? game.manualPrice, currency) }}</span>
              <svg
                class="w-4 h-4 text-text-muted transition-transform flex-shrink-0"
                :class="{ 'rotate-180': expandedGameId === game.gameId }"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <!-- Expanded retailer comparison -->
            <div
              v-if="expandedGameId === game.gameId && game.prices.length > 0"
              class="ml-2 sm:ml-4 mt-1 space-y-1"
            >
              <a
                v-for="(retailer, idx) in game.prices"
                :key="idx"
                :href="retailer.link"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-lg bg-surface-lighter/50 hover:bg-surface-lighter transition-colors text-sm"
              >
                <span class="flex-1 text-text-primary truncate text-xs sm:text-sm">{{ retailer.itemName }}</span>
                <span class="text-text-muted text-xs flex-shrink-0 hidden sm:inline">{{ retailer.country }}</span>
                <span v-if="retailer.shipping > 0" class="text-text-muted text-xs flex-shrink-0 hidden sm:inline">+{{ formatPrice(retailer.shipping, currency) }} shipping</span>
                <span class="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" :class="stockInStock(retailer.stock) ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'">
                  {{ stockLabel(retailer.stock) }}
                </span>
                <span class="font-semibold text-accent-light flex-shrink-0 text-xs sm:text-sm">{{ formatPrice(retailer.price, currency) }}</span>
              </a>
              <a
                :href="game.url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-block mt-1 text-xs text-text-muted hover:text-accent-light transition-colors"
              >
                View on BoardGamePrices.com &rarr;
              </a>
            </div>

            <!-- Expanded manual price info (no retailers) -->
            <div
              v-if="expandedGameId === game.gameId && game.prices.length === 0 && game.manualPrice !== null"
              class="ml-4 mt-1 p-3 rounded-lg bg-surface-lighter/50"
            >
              <p class="text-sm text-text-secondary mb-2">Manually set price</p>
              <button
                class="text-sm text-red-400 hover:text-red-300 transition-colors"
                :disabled="savingManualPrice === game.gameId"
                @click.stop="removeManualPrice(game.gameId)"
              >
                {{ savingManualPrice === game.gameId ? 'Removing...' : 'Remove manual price' }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Unpriced games -->
      <section v-if="unpricedGames.length > 0">
        <h2 class="text-xl font-semibold text-text-primary mb-4">Games Without Pricing</h2>
        <div class="space-y-2">
          <div
            v-for="game in unpricedGames"
            :key="game.gameId"
            class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-xl bg-surface border border-surface-lighter"
          >
            <RouterLink :to="`/games/${game.gameId}`" class="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <img
                v-if="game.imageUrl"
                :src="game.imageUrl"
                :alt="game.title"
                class="w-10 h-10 rounded-lg object-cover flex-shrink-0"
              />
              <div v-else class="w-10 h-10 rounded-lg bg-surface-lighter flex-shrink-0" />
              <span class="flex-1 font-medium text-text-primary truncate text-sm sm:text-base">{{ game.title }}</span>
            </RouterLink>
            <form class="flex items-center gap-2 flex-shrink-0 pl-13 sm:pl-0" @submit.prevent="saveManualPrice(game.gameId)">
              <input
                v-model="manualPriceInputs[game.gameId]"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Price"
                class="w-20 bg-surface-lighter border border-surface-lighter rounded-lg px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent text-right"
              />
              <button
                type="submit"
                class="text-xs px-2 py-1 rounded-lg bg-accent/20 text-accent-light hover:bg-accent/30 transition-colors disabled:opacity-50"
                :disabled="savingManualPrice === game.gameId || !manualPriceInputs[game.gameId]"
              >
                {{ savingManualPrice === game.gameId ? '...' : 'Set' }}
              </button>
            </form>
          </div>
        </div>
      </section>

      <!-- Attribution -->
      <div class="mt-10 text-center">
        <a
          href="https://boardgameprices.com"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          Price data provided by BoardGamePrices.com
        </a>
      </div>
    </div>
  </main>
</template>
