<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface YouTubeVideo {
  videoId: string
  title: string
  channelTitle: string
  thumbnailUrl: string
}

interface Props {
  gameId: number
}

const props = defineProps<Props>()

const videos = ref<YouTubeVideo[]>([])
const loading = ref(true)
const expandedVideo = ref<string | null>(null)

function toggleVideo(videoId: string) {
  expandedVideo.value = expandedVideo.value === videoId ? null : videoId
}

onMounted(async () => {
  try {
    const res = await fetch(`/api/games/${props.gameId}/videos`, { credentials: 'include' })
    if (res.ok) {
      videos.value = await res.json()
    }
  } catch {
    // silently fail — videos are non-critical
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-if="loading" class="mb-8">
    <h2 class="text-lg font-semibold text-text-primary mb-3">How to Play</h2>
    <div class="flex gap-3 overflow-x-auto pb-2">
      <div v-for="i in 3" :key="i" class="shrink-0 w-64 h-40 rounded-xl bg-surface-lighter animate-pulse" />
    </div>
  </div>

  <div v-else-if="videos.length" class="mb-8">
    <h2 class="text-lg font-semibold text-text-primary mb-3">How to Play</h2>

    <!-- Expanded player -->
    <div v-if="expandedVideo" class="mb-4">
      <div class="relative w-full rounded-xl overflow-hidden border border-surface-lighter" style="aspect-ratio: 16/9; box-shadow: var(--shadow-card-hover)">
        <iframe
          :src="`https://www.youtube-nocookie.com/embed/${expandedVideo}?autoplay=1`"
          class="absolute inset-0 w-full h-full"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        />
      </div>
      <button
        class="mt-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        @click="expandedVideo = null"
      >
        Close player
      </button>
    </div>

    <!-- Thumbnail strip -->
    <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
      <button
        v-for="video in videos"
        :key="video.videoId"
        class="group shrink-0 w-64 rounded-xl overflow-hidden border transition-all"
        :class="expandedVideo === video.videoId
          ? 'border-accent ring-2 ring-accent/30'
          : 'border-surface-lighter hover:border-accent/50'"
        style="box-shadow: var(--shadow-card)"
        @click="toggleVideo(video.videoId)"
      >
        <div class="relative">
          <img
            :src="video.thumbnailUrl"
            :alt="video.title"
            class="w-full object-cover"
            style="aspect-ratio: 16/9"
            loading="lazy"
          />
          <div class="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
            <svg class="w-10 h-10 text-white drop-shadow-lg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
        <div class="p-2.5 text-left">
          <p class="text-sm font-medium text-text-primary line-clamp-2 leading-snug">{{ video.title }}</p>
          <p class="text-xs text-text-muted mt-1 truncate">{{ video.channelTitle }}</p>
        </div>
      </button>
    </div>
  </div>
</template>
