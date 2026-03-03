<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { usePlayLog } from '../composables/usePlayLog'
import { useNotify } from '../composables/useNotify'

const { stats, loading, error, fetchStats, deletePlay } = usePlayLog()
const { notify } = useNotify()

async function handleDeletePlay(gameId: number, playId: number) {
  try {
    await deletePlay(gameId, playId)
    await fetchStats()
    notify('Play deleted')
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Failed to delete play', 'error')
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

onMounted(fetchStats)
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

    <h1 class="text-3xl font-bold text-text-primary mb-8">Play Statistics</h1>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <div class="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-20">
      <p class="text-xl text-text-secondary">{{ error }}</p>
    </div>

    <!-- Stats -->
    <div v-else-if="stats">
      <!-- Summary cards -->
      <div class="grid grid-cols-2 gap-4 mb-10">
        <div class="bg-surface rounded-xl border border-surface-lighter p-6 text-center" style="box-shadow: var(--shadow-card)">
          <p class="text-4xl font-bold text-accent-light">{{ stats.totalPlays }}</p>
          <p class="text-sm text-text-secondary mt-1">Total Plays</p>
        </div>
        <div class="bg-surface rounded-xl border border-surface-lighter p-6 text-center" style="box-shadow: var(--shadow-card)">
          <p class="text-4xl font-bold text-accent-light">{{ stats.gamesPlayed }}</p>
          <p class="text-sm text-text-secondary mt-1">Games Played</p>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="stats.totalPlays === 0" class="text-center py-12">
        <p class="text-text-secondary mb-4">No plays logged yet. Start by logging a play from a game's detail page!</p>
        <RouterLink to="/" class="text-accent-light hover:underline">Browse your games</RouterLink>
      </div>

      <template v-else>
        <!-- Most Played -->
        <section class="mb-10">
          <h2 class="text-xl font-semibold text-text-primary mb-4">Most Played</h2>
          <div class="space-y-3">
            <RouterLink
              v-for="(item, i) in stats.mostPlayed"
              :key="item.gameId"
              :to="`/games/${item.gameId}`"
              class="flex items-center gap-4 p-3 rounded-xl bg-surface border border-surface-lighter hover:border-accent/30 transition-colors"
              style="box-shadow: var(--shadow-card)"
            >
              <span class="text-lg font-bold text-text-muted w-8 text-center">{{ i + 1 }}</span>
              <img
                v-if="item.imageUrl"
                :src="item.imageUrl"
                :alt="item.title"
                class="w-12 h-12 rounded-lg object-cover flex-shrink-0"
              />
              <div v-else class="w-12 h-12 rounded-lg bg-surface-lighter flex-shrink-0" />
              <span class="flex-1 font-medium text-text-primary truncate">{{ item.title }}</span>
              <span class="text-sm font-semibold text-accent-light">{{ item.playCount }} play{{ item.playCount !== 1 ? 's' : '' }}</span>
            </RouterLink>
          </div>
        </section>

        <!-- Recent Plays -->
        <section>
          <h2 class="text-xl font-semibold text-text-primary mb-4">Recent Plays</h2>
          <div class="space-y-2">
            <div
              v-for="play in stats.recentPlays"
              :key="play.id"
              class="flex items-center gap-4 p-3 rounded-xl bg-surface border border-surface-lighter"
              style="box-shadow: var(--shadow-card)"
            >
              <RouterLink :to="`/games/${play.gameId}`" class="flex items-center gap-4 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                <img
                  v-if="play.imageUrl"
                  :src="play.imageUrl"
                  :alt="play.title"
                  class="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                />
                <div v-else class="w-10 h-10 rounded-lg bg-surface-lighter flex-shrink-0" />
                <span class="flex-1 font-medium text-text-primary truncate">{{ play.title }}</span>
              </RouterLink>
              <span class="text-sm text-text-secondary flex-shrink-0">{{ formatDate(play.playedAt) }}</span>
              <button
                class="p-1.5 rounded-lg text-text-muted hover:text-negative hover:bg-negative/10 transition-colors flex-shrink-0"
                title="Delete play"
                @click="handleDeletePlay(play.gameId, play.id)"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </section>
      </template>
    </div>
  </main>
</template>
