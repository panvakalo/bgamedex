<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '../composables/useAuth'

const { user, updateUser } = useAuth()

const preview = ref<string | null>(null)
const selectedFile = ref<File | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)
const fileInput = ref<HTMLInputElement>()

function onFileSelect(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  if (file.size > 1024 * 1024) {
    error.value = 'Image must be under 1MB'
    return
  }

  error.value = null
  selectedFile.value = file

  const reader = new FileReader()
  reader.onload = (e) => { preview.value = e.target?.result as string }
  reader.readAsDataURL(file)
}

async function save() {
  if (!selectedFile.value) return

  saving.value = true
  error.value = null

  try {
    const form = new FormData()
    form.append('avatar', selectedFile.value)

    const res = await fetch('/api/auth/avatar', {
      method: 'POST',
      credentials: 'include',
      body: form,
    })

    const data = await res.json()

    if (!res.ok) {
      error.value = data.error ?? `Upload failed (${res.status})`
      return
    }

    updateUser({ picture: data.picture })
    preview.value = null
    selectedFile.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Upload failed'
  } finally {
    saving.value = false
  }
}

function cancel() {
  preview.value = null
  selectedFile.value = null
  error.value = null
  if (fileInput.value) fileInput.value.value = ''
}

const displayPicture = computed(() => preview.value ?? user.value?.picture)
</script>

<template>
  <main class="max-w-lg mx-auto px-4 py-12">
    <h1 class="text-2xl font-bold text-text-primary mb-8">Account Settings</h1>

    <div v-if="user" class="space-y-6">
      <!-- Avatar section -->
      <div class="flex flex-col items-center gap-4">
        <button
          class="relative group cursor-pointer"
          @click="fileInput?.click()"
        >
          <img
            v-if="displayPicture"
            :src="displayPicture"
            :alt="user.name"
            class="w-24 h-24 rounded-full object-cover"
            referrerpolicy="no-referrer"
          />
          <div
            v-else
            class="w-24 h-24 rounded-full bg-accent/20 text-accent-light flex items-center justify-center text-3xl font-medium"
          >
            {{ user.name?.charAt(0)?.toUpperCase() || '?' }}
          </div>
          <div class="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </button>

        <input
          ref="fileInput"
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          class="hidden"
          @change="onFileSelect"
        />

        <p class="text-sm text-text-muted">Click to change avatar</p>
      </div>

      <!-- Error -->
      <div v-if="error" class="px-4 py-3 rounded-lg bg-negative/10 border border-negative/30 text-negative text-sm">
        {{ error }}
      </div>

      <!-- Save/Cancel buttons -->
      <div v-if="selectedFile" class="flex gap-3 justify-center">
        <button
          class="px-6 py-2 rounded-lg bg-surface-light border border-surface-lighter text-text-secondary hover:text-text-primary transition-colors"
          @click="cancel"
        >
          Cancel
        </button>
        <button
          :disabled="saving"
          class="px-6 py-2 rounded-lg bg-accent hover:bg-accent-light text-white font-medium transition-colors disabled:opacity-50"
          @click="save"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>

      <!-- User info -->
      <div class="space-y-4 pt-4 border-t border-surface-lighter">
        <div>
          <label class="text-sm text-text-muted">Name</label>
          <p class="text-text-primary">{{ user.name }}</p>
        </div>
        <div>
          <label class="text-sm text-text-muted">Email</label>
          <div class="flex items-center gap-2">
            <p class="text-text-primary">{{ user.email }}</p>
            <span
              v-if="user.emailVerified"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-positive/15 text-positive"
            >
              Verified
            </span>
            <span
              v-else
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400"
            >
              Unverified
            </span>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
