<script setup lang="ts">
import { ref, onMounted } from 'vue'

import { useAdminApi } from '../../composables/useAdminApi'
import BaseSpinner from '../../components/BaseSpinner.vue'
import AdminSummaryCard from '../../components/admin/AdminSummaryCard.vue'
import AdminUserBadges from '../../components/admin/AdminUserBadges.vue'
import { formatShortDate } from '../../utils/format'
import type { PlatformOverview, SystemHealth, AdminUser } from '../../types/admin'

const { adminFetch } = useAdminApi()

const overview = ref<PlatformOverview | null>(null)
const health = ref<SystemHealth | null>(null)
const recentUsers = ref<AdminUser[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const [overviewData, healthData, usersData] = await Promise.all([
      adminFetch<PlatformOverview>('/api/admin/analytics/overview'),
      adminFetch<SystemHealth>('/api/admin/system/health'),
      adminFetch<{ users: AdminUser[] }>('/api/admin/users?sort=created_at&dir=desc&limit=5'),
    ])
    overview.value = overviewData
    health.value = healthData
    recentUsers.value = usersData.users
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load dashboard'
  } finally {
    loading.value = false
  }
})

const formatDate = formatShortDate
</script>

<template>
  <main class="max-w-5xl mx-auto px-4 py-6">
    <h1 class="text-3xl font-bold text-text-primary mb-8">Dashboard</h1>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <BaseSpinner />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-20">
      <p class="text-xl text-text-secondary">{{ error }}</p>
    </div>

    <template v-else>
      <!-- Summary cards -->
      <div v-if="overview" class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <AdminSummaryCard label="Total Users" :value="overview.totalUsers" />
        <AdminSummaryCard label="Total Games" :value="overview.totalGames" />
        <AdminSummaryCard label="Total Plays" :value="overview.totalPlays" />
        <AdminSummaryCard label="Friendships" :value="overview.totalFriendships" />
      </div>

      <!-- Recent registrations -->
      <section v-if="recentUsers.length" class="mb-10">
        <h2 class="text-xl font-semibold text-text-primary mb-4">Recent Registrations</h2>
        <div class="space-y-3">
          <RouterLink
            v-for="user in recentUsers"
            :key="user.id"
            :to="`/admin/users/${user.id}`"
            class="flex items-center gap-4 p-3 rounded-xl bg-surface border border-surface-lighter hover:border-accent/30 transition-colors"
            style="box-shadow: var(--shadow-card)"
          >
            <img
              v-if="user.picture"
              :src="user.picture"
              :alt="user.name"
              class="w-10 h-10 rounded-full object-cover"
              referrerpolicy="no-referrer"
            />
            <div v-else class="w-10 h-10 rounded-full bg-accent/20 text-accent-light flex items-center justify-center text-sm font-medium">
              {{ user.name?.charAt(0)?.toUpperCase() || '?' }}
            </div>

            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-text-primary truncate">{{ user.name }}</p>
              <p class="text-xs text-text-muted truncate">{{ user.email }}</p>
            </div>

            <div class="text-right shrink-0">
              <p class="text-xs text-text-muted">{{ formatDate(user.createdAt) }}</p>
              <AdminUserBadges
                class="mt-0.5"
                :is-admin="user.isAdmin"
                :google-id="user.googleId"
                :has-password="user.hasPassword"
                :email-verified="user.emailVerified"
              />
            </div>
          </RouterLink>
        </div>
      </section>

      <!-- System snapshot -->
      <section v-if="health">
        <h2 class="text-xl font-semibold text-text-primary mb-4">System</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <AdminSummaryCard label="DB Size" :value="health.dbSizeMb + ' MB'" />
          <AdminSummaryCard label="Uptime" :value="health.uptimeFormatted" />
          <AdminSummaryCard label="Node.js" :value="health.nodeVersion" />
        </div>
      </section>
    </template>
  </main>
</template>
