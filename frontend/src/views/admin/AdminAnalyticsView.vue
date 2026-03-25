<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Chart } from 'highcharts-vue'
import Highcharts from 'highcharts'
import { useAdminApi } from '../../composables/useAdminApi'
import { useTheme } from '../../composables/useTheme'
import BaseSpinner from '../../components/BaseSpinner.vue'
import AdminSummaryCard from '../../components/admin/AdminSummaryCard.vue'
import type { PlatformOverview, GrowthDataPoint, EngagementStats, PopularGame } from '../../types/admin'

const { adminFetch } = useAdminApi()
const { theme } = useTheme()

const overview = ref<PlatformOverview | null>(null)
const growth = ref<GrowthDataPoint[]>([])
const engagement = ref<EngagementStats | null>(null)
const popularGames = ref<PopularGame[]>([])
const loading = ref(true)
const error = ref('')
const growthPeriod = ref('30d')
const growthLoading = ref(false)

const accentColor = ref('#7c3aed')
const textColor = ref('#57534e')
const gridColor = ref('#e0ddd8')

function readThemeColors() {
  const style = getComputedStyle(document.documentElement)
  accentColor.value = style.getPropertyValue('--theme-accent').trim() || '#7c3aed'
  textColor.value = style.getPropertyValue('--theme-text-secondary').trim() || '#57534e'
  gridColor.value = style.getPropertyValue('--theme-surface-lighter').trim() || '#e0ddd8'
}

onMounted(async () => {
  readThemeColors()

  try {
    const [overviewData, growthData, engagementData, gamesData] = await Promise.all([
      adminFetch<PlatformOverview>('/api/admin/analytics/overview'),
      adminFetch<{ registrations: GrowthDataPoint[] }>(`/api/admin/analytics/growth?period=${growthPeriod.value}`),
      adminFetch<EngagementStats>('/api/admin/analytics/engagement'),
      adminFetch<{ games: PopularGame[] }>('/api/admin/analytics/popular-games?limit=20'),
    ])
    overview.value = overviewData
    growth.value = growthData.registrations
    engagement.value = engagementData
    popularGames.value = gamesData.games
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load analytics'
  } finally {
    loading.value = false
  }
})

// Re-read CSS custom properties when theme changes so chart colors update
watch(theme, () => {
  requestAnimationFrame(readThemeColors)
})

async function changePeriod(period: string) {
  growthPeriod.value = period
  growthLoading.value = true
  try {
    const data = await adminFetch<{ registrations: GrowthDataPoint[] }>(`/api/admin/analytics/growth?period=${period}`)
    growth.value = data.registrations
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load growth data'
  } finally {
    growthLoading.value = false
  }
}

const growthChartOptions = computed<Highcharts.Options>(() => ({
  chart: { type: 'column', backgroundColor: 'transparent', height: 300 },
  title: { text: undefined },
  xAxis: {
    categories: growth.value.map((d) => {
      const date = new Date(d.date + 'T00:00:00')
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }),
    labels: { style: { color: textColor.value, fontSize: '11px' } },
    lineColor: gridColor.value,
    tickColor: gridColor.value,
  },
  yAxis: {
    title: { text: undefined },
    allowDecimals: false,
    gridLineColor: gridColor.value,
    labels: { style: { color: textColor.value, fontSize: '11px' } },
  },
  legend: { enabled: false },
  tooltip: { headerFormat: '<b>{point.x}</b><br/>', pointFormat: '{point.y} registrations' },
  plotOptions: { column: { borderRadius: 4, color: accentColor.value } },
  series: [{ type: 'column' as const, name: 'Registrations', data: growth.value.map((d) => d.count) }],
  credits: { enabled: false },
}))

const authPieOptions = computed<Highcharts.Options>(() => {
  if (!engagement.value) return {} as Highcharts.Options
  return {
    chart: { type: 'pie', backgroundColor: 'transparent', height: 250 },
    title: { text: undefined },
    tooltip: { pointFormat: '<b>{point.y}</b> users ({point.percentage:.1f}%)' },
    plotOptions: {
      pie: {
        dataLabels: { enabled: true, format: '{point.name}: {point.y}', style: { color: textColor.value, fontSize: '12px', textOutline: 'none' } },
        colors: [accentColor.value, '#3b82f6'],
      },
    },
    series: [{
      type: 'pie' as const,
      name: 'Auth Method',
      data: [
        { name: 'Google', y: engagement.value.authMethodBreakdown.google },
        { name: 'Email', y: engagement.value.authMethodBreakdown.email },
      ],
    }],
    credits: { enabled: false },
  }
})

const periods = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All time' },
]
</script>

<template>
  <main class="max-w-5xl mx-auto px-4 py-6">
    <h1 class="text-3xl font-bold text-text-primary mb-8">Analytics</h1>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <BaseSpinner />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-20">
      <p class="text-xl text-text-secondary">{{ error }}</p>
    </div>

    <template v-else>
      <!-- Overview cards -->
      <div v-if="overview" class="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-10">
        <AdminSummaryCard label="Users" :value="overview.totalUsers" />
        <AdminSummaryCard label="Games" :value="overview.totalGames" />
        <AdminSummaryCard label="Plays" :value="overview.totalPlays" />
        <AdminSummaryCard label="Friendships" :value="overview.totalFriendships" />
        <AdminSummaryCard label="Wishlist" :value="overview.totalWishlistItems" />
      </div>

      <!-- Registration growth chart -->
      <section class="mb-10">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold text-text-primary">Registration Growth</h2>
          <div class="flex gap-1">
            <button
              v-for="p in periods"
              :key="p.value"
              class="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
              :class="growthPeriod === p.value
                ? 'bg-accent/15 text-accent-light'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-lighter'"
              @click="changePeriod(p.value)"
            >
              {{ p.label }}
            </button>
          </div>
        </div>
        <div class="rounded-xl border border-surface-lighter p-4 bg-surface-light" style="box-shadow: var(--shadow-card)">
          <div v-if="growthLoading" class="flex justify-center py-16">
            <BaseSpinner size="sm" />
          </div>
          <div v-else-if="growth.length === 0" class="text-center py-16 text-text-muted">
            No registration data for this period.
          </div>
          <Chart v-else :options="growthChartOptions" />
        </div>
      </section>

      <!-- Engagement stats -->
      <section v-if="engagement" class="mb-10">
        <h2 class="text-xl font-semibold text-text-primary mb-4">Engagement</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <AdminSummaryCard label="Active Today" :value="engagement.activeToday" />
          <AdminSummaryCard label="Active This Week" :value="engagement.activeWeek" />
          <AdminSummaryCard label="Active This Month" :value="engagement.activeMonth" />
          <AdminSummaryCard label="Avg Games/User" :value="engagement.avgGamesPerUser" />
          <AdminSummaryCard label="Avg Plays/User" :value="engagement.avgPlaysPerUser" />
        </div>

        <!-- Auth method pie chart -->
        <div class="rounded-xl border border-surface-lighter p-4 bg-surface-light" style="box-shadow: var(--shadow-card)">
          <h3 class="text-sm font-medium text-text-secondary mb-2">Auth Method Breakdown</h3>
          <Chart :options="authPieOptions" />
        </div>
      </section>

      <!-- Popular games -->
      <section v-if="popularGames.length">
        <h2 class="text-xl font-semibold text-text-primary mb-4">Popular Games</h2>
        <div class="space-y-3">
          <div
            v-for="(game, i) in popularGames"
            :key="i"
            class="flex items-center gap-4 p-3 rounded-xl bg-surface border border-surface-lighter"
            style="box-shadow: var(--shadow-card)"
          >
            <span class="text-lg font-bold text-text-muted w-8 text-center shrink-0">{{ i + 1 }}</span>
            <img
              v-if="game.imageUrl"
              :src="game.imageUrl"
              :alt="game.title"
              class="w-12 h-12 rounded-lg object-cover shrink-0"
            />
            <div v-else class="w-12 h-12 rounded-lg bg-surface-lighter flex items-center justify-center shrink-0">
              <svg class="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-text-primary truncate">{{ game.title }}</p>
            </div>
            <div class="flex gap-4 shrink-0 text-sm text-text-secondary">
              <span>{{ game.ownerCount }} owner{{ game.ownerCount !== 1 ? 's' : '' }}</span>
              <span>{{ game.playCount }} play{{ game.playCount !== 1 ? 's' : '' }}</span>
            </div>
          </div>
        </div>
      </section>
    </template>
  </main>
</template>
