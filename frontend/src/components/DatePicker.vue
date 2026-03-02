<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const model = defineModel<string>({ required: true })

const today = new Date()
const todayStr = formatDate(today)

const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth()) // 0-indexed

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const monthLabel = computed(() => {
  const d = new Date(viewYear.value, viewMonth.value, 1)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

const calendarDays = computed(() => {
  const year = viewYear.value
  const month = viewMonth.value
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Monday = 0, Sunday = 6
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const days: { date: string; day: number; currentMonth: boolean; future: boolean }[] = []

  // Previous month fill
  const prevLastDay = new Date(year, month, 0)
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevLastDay.getDate() - i
    const date = formatDate(new Date(year, month - 1, d))
    days.push({ date, day: d, currentMonth: false, future: false })
  }

  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = formatDate(new Date(year, month, d))
    days.push({ date, day: d, currentMonth: true, future: date > todayStr })
  }

  // Next month fill to complete final row
  const remaining = 7 - (days.length % 7)
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const date = formatDate(new Date(year, month + 1, d))
      days.push({ date, day: d, currentMonth: false, future: date > todayStr })
    }
  }

  return days
})

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11
    viewYear.value--
  } else {
    viewMonth.value--
  }
}

function nextMonth() {
  // Don't navigate past current month
  const now = new Date()
  if (viewYear.value === now.getFullYear() && viewMonth.value >= now.getMonth()) return
  if (viewMonth.value === 11) {
    viewMonth.value = 0
    viewYear.value++
  } else {
    viewMonth.value++
  }
}

function selectDay(day: { date: string; future: boolean }) {
  if (day.future) return
  model.value = day.date
}

function selectToday() {
  model.value = todayStr
  viewYear.value = today.getFullYear()
  viewMonth.value = today.getMonth()
}

const canGoNext = computed(() => {
  const now = new Date()
  return !(viewYear.value === now.getFullYear() && viewMonth.value >= now.getMonth())
})

// Sync view to model when it changes externally
watch(model, (val) => {
  if (val) {
    const [y, m] = val.split('-').map(Number)
    viewYear.value = y
    viewMonth.value = m - 1
  }
}, { immediate: true })
</script>

<template>
  <div class="bg-surface rounded-lg border border-surface-lighter p-3 select-none">
    <!-- Header: month nav -->
    <div class="flex items-center justify-between mb-2">
      <button
        class="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-lighter transition-colors"
        @click="prevMonth"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <span class="text-sm font-medium text-text-primary">{{ monthLabel }}</span>
      <button
        :disabled="!canGoNext"
        class="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-lighter transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        @click="nextMonth"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- Weekday headers -->
    <div class="grid grid-cols-7 mb-1">
      <div
        v-for="wd in weekdays"
        :key="wd"
        class="text-center text-xs text-text-muted py-1"
      >
        {{ wd }}
      </div>
    </div>

    <!-- Day grid -->
    <div class="grid grid-cols-7">
      <button
        v-for="(day, i) in calendarDays"
        :key="i"
        :disabled="day.future"
        class="w-9 h-9 mx-auto rounded-lg text-sm flex items-center justify-center transition-colors"
        :class="[
          day.date === model
            ? 'bg-accent text-white'
            : day.date === todayStr
              ? 'ring-1 ring-accent text-text-primary hover:bg-surface-lighter'
              : day.currentMonth
                ? 'text-text-primary hover:bg-surface-lighter'
                : 'text-text-muted/40',
          day.future ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer',
        ]"
        @click="selectDay(day)"
      >
        {{ day.day }}
      </button>
    </div>

    <!-- Today button -->
    <div class="mt-2 flex justify-center">
      <button
        class="text-xs text-accent hover:text-accent-light transition-colors px-2 py-1 rounded"
        @click="selectToday"
      >
        Today
      </button>
    </div>
  </div>
</template>
