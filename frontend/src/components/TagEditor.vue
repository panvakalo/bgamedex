<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Tag } from '../types/game'
import type { TagWithCount } from '../composables/useTags'

const props = defineProps<{
  modelValue: Tag[]
  allTags: TagWithCount[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', tags: Tag[]): void
  (e: 'add', tagId: number): void
  (e: 'remove', tagId: number): void
  (e: 'create', name: string): void
}>()

const input = ref('')
const showDropdown = ref(false)

const assignedIds = computed(() => new Set(props.modelValue.map((t) => t.id)))

const suggestions = computed(() => {
  const q = input.value.toLowerCase().trim()
  return props.allTags
    .filter((t) => !assignedIds.value.has(t.id))
    .filter((t) => !q || t.name.toLowerCase().includes(q))
})

const canCreateNew = computed(() => {
  const q = input.value.trim()
  if (!q) return false
  const lower = q.toLowerCase()
  return !props.allTags.some((t) => t.name.toLowerCase() === lower)
})

function handleSelect(tag: TagWithCount) {
  emit('add', tag.id)
  input.value = ''
  showDropdown.value = false
}

function handleCreate() {
  const name = input.value.trim()
  if (!name) return
  emit('create', name)
  input.value = ''
  showDropdown.value = false
}

function handleRemove(tagId: number) {
  emit('remove', tagId)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    if (canCreateNew.value) {
      handleCreate()
    } else if (suggestions.value.length === 1) {
      handleSelect(suggestions.value[0])
    }
  }
  if (e.key === 'Escape') {
    showDropdown.value = false
  }
}

function handleFocus() {
  showDropdown.value = true
}

function handleBlur() {
  // Delay to allow click events on dropdown items
  setTimeout(() => { showDropdown.value = false }, 150)
}
</script>

<template>
  <div>
    <!-- Assigned tags -->
    <div class="flex flex-wrap gap-2 mb-3">
      <span
        v-for="tag in modelValue"
        :key="tag.id"
        class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-accent/20 text-accent-light"
      >
        {{ tag.name }}
        <button
          class="ml-0.5 hover:text-white transition-colors"
          title="Remove tag"
          @click="handleRemove(tag.id)"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>
    </div>

    <!-- Input with autocomplete -->
    <div class="relative">
      <input
        v-model="input"
        type="text"
        placeholder="Add a tag..."
        class="w-full h-9 px-3 rounded-lg bg-surface-lighter border border-surface-lighter text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown="handleKeydown"
      />

      <!-- Dropdown -->
      <div
        v-if="showDropdown && (suggestions.length > 0 || canCreateNew)"
        class="absolute z-10 top-full left-0 right-0 mt-1 bg-surface border border-surface-lighter rounded-lg shadow-xl max-h-48 overflow-y-auto"
      >
        <button
          v-for="tag in suggestions"
          :key="tag.id"
          class="w-full flex items-center justify-between px-3 py-2 text-sm text-text-primary hover:bg-surface-lighter transition-colors text-left"
          @mousedown.prevent="handleSelect(tag)"
        >
          <span>{{ tag.name }}</span>
          <span class="text-xs text-text-muted">{{ tag.game_count }} game{{ tag.game_count !== 1 ? 's' : '' }}</span>
        </button>
        <button
          v-if="canCreateNew"
          class="w-full flex items-center gap-2 px-3 py-2 text-sm text-accent-light hover:bg-surface-lighter transition-colors text-left border-t border-surface-lighter"
          @mousedown.prevent="handleCreate"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create "{{ input.trim() }}"
        </button>
      </div>
    </div>
  </div>
</template>
