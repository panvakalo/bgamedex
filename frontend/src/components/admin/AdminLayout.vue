<script setup lang="ts">
import { ref } from 'vue'
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { useAdminAuth } from '../../composables/useAdminAuth'
import AdminSidebar from './AdminSidebar.vue'
import { adminNavItems } from './adminNavItems'

const route = useRoute()
const { adminUser, logout } = useAdminAuth()
const mobileMenuOpen = ref(false)
</script>

<template>
  <div class="min-h-screen bg-surface">
    <!-- Desktop sidebar -->
    <aside class="fixed inset-y-0 left-0 z-20 hidden md:flex flex-col w-16 bg-surface border-r border-surface-lighter">
      <!-- Admin badge -->
      <div class="flex items-center justify-center h-16">
        <span class="text-xs font-bold text-accent-light uppercase tracking-wider">Admin</span>
      </div>

      <!-- Nav -->
      <div class="flex-1">
        <AdminSidebar />
      </div>

      <!-- Bottom: logout -->
      <div class="flex flex-col items-center gap-2 px-2 pb-4">
        <button
          class="group relative flex items-center justify-center w-10 h-10 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-lighter transition-colors"
          title="Sign out"
          @click="logout"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span class="absolute left-full ml-2 px-2 py-1 rounded-md bg-surface-lighter text-text-primary text-xs whitespace-nowrap opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-150">
            Sign out
          </span>
        </button>
      </div>
    </aside>

    <!-- Mobile top bar -->
    <header class="sticky top-0 z-20 md:hidden bg-surface/80 backdrop-blur-md border-b border-surface-lighter">
      <div class="flex items-center justify-between px-4 py-3">
        <RouterLink to="/admin/dashboard" class="flex items-center gap-2">
          <span class="text-lg font-bold text-text-primary"><span class="text-accent-light">Admin</span></span>
        </RouterLink>
        <button
          class="flex items-center justify-center w-9 h-9 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-lighter transition-colors"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <svg v-if="!mobileMenuOpen" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Mobile dropdown -->
      <nav v-if="mobileMenuOpen" class="border-t border-surface-lighter bg-surface px-4 py-3 space-y-1">
        <RouterLink
          v-for="item in adminNavItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors"
          :class="route.path.startsWith(item.to)
            ? 'bg-accent/15 text-accent-light font-medium'
            : 'text-text-secondary hover:text-text-primary hover:bg-surface-lighter'"
          @click="mobileMenuOpen = false"
        >
          {{ item.label }}
        </RouterLink>

        <div class="border-t border-surface-lighter my-2" />

        <div class="flex items-center justify-between px-3 py-2.5">
          <span class="text-sm text-text-muted">{{ adminUser?.email }}</span>
          <button
            class="text-sm text-text-muted hover:text-text-primary transition-colors"
            @click="logout"
          >
            Sign out
          </button>
        </div>
      </nav>
    </header>

    <!-- Main content -->
    <div class="md:ml-16">
      <RouterView />
    </div>
  </div>
</template>
