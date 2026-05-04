<script setup lang="ts">
import { computed } from 'vue'
import diceSvg from './pixel-icons/dice.svg?raw'
import sunSvg from './pixel-icons/sun.svg?raw'
import chartSvg from 'pixelarticons/svg/chart.svg?raw'
import coinsSvg from 'pixelarticons/svg/coins.svg?raw'
import heartSvg from 'pixelarticons/svg/heart.svg?raw'
import usersSvg from 'pixelarticons/svg/users.svg?raw'
import moonSvg from 'pixelarticons/svg/moon.svg?raw'
import logoutSvg from 'pixelarticons/svg/logout.svg?raw'
import mailSvg from 'pixelarticons/svg/mail.svg?raw'
import cancelSvg from 'pixelarticons/svg/cancel.svg?raw'
import downloadSvg from 'pixelarticons/svg/download.svg?raw'

const ICONS: Record<string, string> = {
  dice: diceSvg,
  chart: chartSvg,
  coin: coinsSvg,
  heart: heartSvg,
  people: usersSvg,
  sun: sunSvg,
  moon: moonSvg,
  logout: logoutSvg,
  mail: mailSvg,
  close: cancelSvg,
  download: downloadSvg,
}

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 16 })

const svg = computed(() => ICONS[props.name] ?? '')
const dim = computed(() => `${props.size}px`)
</script>

<template>
  <span
    v-if="svg"
    class="pixel-icon"
    aria-hidden="true"
    :style="{ width: dim, height: dim }"
    v-html="svg"
  />
</template>

<style scoped>
.pixel-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.pixel-icon :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
