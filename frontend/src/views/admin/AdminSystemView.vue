<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAdminApi } from '../../composables/useAdminApi'
import BaseSpinner from '../../components/BaseSpinner.vue'
import AdminSummaryCard from '../../components/admin/AdminSummaryCard.vue'
import { formatBytes } from '../../utils/format'
import type { SystemHealth, SystemConfig } from '../../types/admin'

const { adminFetch } = useAdminApi()

const health = ref<SystemHealth | null>(null)
const config = ref<SystemConfig | null>(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const [healthData, configData] = await Promise.all([
      adminFetch<SystemHealth>('/api/admin/system/health'),
      adminFetch<SystemConfig>('/api/admin/system/config'),
    ])
    health.value = healthData
    config.value = configData
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load system info'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="max-w-4xl mx-auto px-4 py-6">
    <h1 class="text-3xl font-bold text-text-primary mb-8">System</h1>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <BaseSpinner />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-20">
      <p class="text-xl text-text-secondary">{{ error }}</p>
    </div>

    <template v-else>
      <!-- Server -->
      <section v-if="health" class="mb-10">
        <h2 class="text-xl font-semibold text-text-primary mb-4">Server</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <AdminSummaryCard label="Uptime" :value="health.uptimeFormatted" />
          <AdminSummaryCard label="Node.js" :value="health.nodeVersion" />
          <AdminSummaryCard label="Heap Used" :value="formatBytes(health.memoryUsage.heapUsed)" />
          <AdminSummaryCard label="RSS" :value="formatBytes(health.memoryUsage.rss)" />
        </div>
      </section>

      <!-- Database -->
      <section v-if="health" class="mb-10">
        <h2 class="text-xl font-semibold text-text-primary mb-4">Database</h2>
        <div class="mb-4">
          <AdminSummaryCard label="DB Size" :value="health.dbSizeMb + ' MB'" />
        </div>
        <div class="rounded-xl border border-surface-lighter overflow-hidden" style="box-shadow: var(--shadow-card)">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-surface-lighter bg-surface">
                <th class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Table</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Rows</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(count, table) in health.tableCounts"
                :key="table"
                class="border-b border-surface-lighter last:border-0 bg-surface-light"
              >
                <td class="px-4 py-2.5 text-text-primary font-mono text-xs">{{ table }}</td>
                <td class="px-4 py-2.5 text-text-secondary text-right">{{ count.toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Feature flags -->
      <section v-if="config" class="mb-10">
        <h2 class="text-xl font-semibold text-text-primary mb-4">Feature Flags</h2>
        <div class="rounded-xl border border-surface-lighter p-5 bg-surface-light space-y-3" style="box-shadow: var(--shadow-card)">
          <div v-for="(enabled, feature) in config.features" :key="feature" class="flex items-center justify-between">
            <span class="text-sm text-text-primary capitalize">
              {{ feature === 'emailEnabled' ? 'Email (Resend)'
                : feature === 'aiChatEnabled' ? 'AI Chat (OpenAI)'
                : feature === 'googleAuthEnabled' ? 'Google Auth'
                : feature }}
            </span>
            <span
              class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium"
              :class="enabled
                ? 'bg-green-500/15 text-green-400'
                : 'bg-red-500/15 text-red-400'"
            >
              <span class="w-1.5 h-1.5 rounded-full" :class="enabled ? 'bg-green-400' : 'bg-red-400'" />
              {{ enabled ? 'Enabled' : 'Disabled' }}
            </span>
          </div>
        </div>
      </section>

      <!-- Rate limits -->
      <section v-if="config">
        <h2 class="text-xl font-semibold text-text-primary mb-4">Rate Limits</h2>
        <div class="grid grid-cols-2 gap-4">
          <AdminSummaryCard label="Global (15min)" :value="`${config.rateLimits.global} req`" />
          <AdminSummaryCard label="Auth (15min)" :value="`${config.rateLimits.auth} req`" />
        </div>
        <p class="text-xs text-text-muted mt-2">Environment: {{ config.environment }}</p>
      </section>
    </template>
  </main>
</template>
