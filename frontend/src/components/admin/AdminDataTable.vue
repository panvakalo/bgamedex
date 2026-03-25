<script setup lang="ts" generic="T extends Record<string, unknown>">
interface Column {
  key: string
  label: string
  sortable?: boolean
}

interface Props {
  columns: Column[]
  rows: T[]
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

const props = withDefaults(defineProps<Props>(), {
  sortBy: '',
  sortDir: 'asc',
})

const emit = defineEmits<{
  (e: 'sort', key: string): void
  (e: 'row-click', row: T): void
}>()
</script>

<template>
  <div class="overflow-x-auto rounded-xl border border-surface-lighter" style="box-shadow: var(--shadow-card)">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-surface-lighter bg-surface">
          <th
            v-for="col in props.columns"
            :key="col.key"
            class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider"
            :class="col.sortable ? 'cursor-pointer select-none hover:text-text-primary transition-colors' : ''"
            @click="col.sortable && emit('sort', col.key)"
          >
            <span class="inline-flex items-center gap-1">
              {{ col.label }}
              <template v-if="col.sortable && props.sortBy === col.key">
                <svg v-if="props.sortDir === 'asc'" class="w-3.5 h-3.5 text-accent-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
                </svg>
                <svg v-else class="w-3.5 h-3.5 text-accent-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </template>
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, i) in props.rows"
          :key="(row.id as string | number) ?? i"
          class="border-b border-surface-lighter last:border-0 bg-surface-light hover:bg-surface-lighter/50 cursor-pointer transition-colors"
          @click="emit('row-click', row)"
        >
          <td v-for="col in props.columns" :key="col.key" class="px-4 py-3 text-text-primary">
            <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
              {{ row[col.key] }}
            </slot>
          </td>
        </tr>
        <tr v-if="!props.rows.length">
          <td :colspan="props.columns.length" class="px-4 py-8 text-center text-text-muted">
            No results found
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
