<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useFriendGames } from '../composables/useFriendGames'
import GameGrid from '../components/GameGrid.vue'
import type { SortOption, SortDir } from '../composables/useGames'

const route = useRoute()
const { games, friendInfo, loading, error, fetchFriendCollection } = useFriendGames()

const viewMode = ref<'tiles' | 'list'>('tiles')
const sort = ref<SortOption>('alpha')
const sortDir = ref<SortDir>('asc')
const search = ref('')

const filteredGames = computed(() => {
  let result = games.value
  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(g => g.title.toLowerCase().includes(q))
  }

  const sorted = [...result]
  const dir = sortDir.value === 'asc' ? 1 : -1
  switch (sort.value) {
    case 'alpha':
      sorted.sort((a, b) => dir * a.title.localeCompare(b.title))
      break
    case 'added':
      sorted.sort((a, b) => dir * (a.id - b.id))
      break
    case 'duration':
      sorted.sort((a, b) => dir * ((a.min_duration ?? Infinity) - (b.min_duration ?? Infinity)))
      break
  }
  return sorted
})

onMounted(() => {
  fetchFriendCollection(Number(route.params.userId))
})
</script>

<template>
  <main class="max-w-7xl mx-auto px-4 py-6">
    <!-- Back link -->
    <RouterLink to="/friends" class="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors mb-4 no-underline">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Friends
    </RouterLink>

    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <img
        v-if="friendInfo?.picture"
        :src="friendInfo.picture"
        :alt="friendInfo.name"
        class="w-10 h-10 rounded-full object-cover"
        referrerpolicy="no-referrer"
      />
      <div v-else-if="friendInfo" class="w-10 h-10 rounded-full bg-accent/20 text-accent-light flex items-center justify-center text-sm font-medium">
        {{ friendInfo.name?.charAt(0)?.toUpperCase() || '?' }}
      </div>
      <h1 class="text-3xl font-bold text-text-primary">
        <template v-if="friendInfo">{{ friendInfo.name }}'s Collection</template>
        <template v-else>Collection</template>
      </h1>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <div class="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-20">
      <p class="text-xl text-text-secondary">{{ error }}</p>
      <RouterLink to="/friends" class="text-accent-light hover:underline mt-4 inline-block">Back to Friends</RouterLink>
    </div>

    <!-- Content -->
    <template v-else>
      <!-- Search -->
      <div class="flex items-center gap-2 mb-4">
        <div class="relative flex-1 lg:flex-none">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="search"
            type="text"
            placeholder="Search games..."
            class="w-full lg:w-48 h-9 pl-10 pr-4 rounded-lg bg-surface-lighter border border-surface-lighter text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm"
          />
        </div>
      </div>

      <GameGrid
        :games="filteredGames"
        :loading="false"
        :total-count="games.length"
        :view-mode="viewMode"
        :sort="sort"
        :sort-dir="sortDir"
        :readonly="true"
        @update:view-mode="viewMode = $event"
        @update:sort="sort = $event"
        @update:sort-dir="sortDir = $event"
      />
    </template>
  </main>
</template>
