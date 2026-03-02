<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{ (e: 'done'): void }>()

const canvas = ref<HTMLCanvasElement | null>(null)
let animationId = 0

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
  trail: boolean
}

const colors = ['#22c55e', '#818cf8', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#a855f7', '#facc15']

function random(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function createBurst(particles: Particle[], cx: number, cy: number) {
  const count = 50 + Math.floor(random(0, 40))
  const burstColor = colors[Math.floor(random(0, colors.length))]
  const mixColors = Math.random() > 0.5

  for (let i = 0; i < count; i++) {
    const angle = random(0, Math.PI * 2)
    const speed = random(1.5, 7)
    const life = random(60, 120)
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      color: mixColors ? colors[Math.floor(random(0, colors.length))] : burstColor,
      size: random(2, 5),
      trail: Math.random() > 0.6,
    })
  }
}

onMounted(() => {
  const el = canvas.value!
  const ctx = el.getContext('2d')!
  el.width = window.innerWidth
  el.height = window.innerHeight

  const particles: Particle[] = []
  const pendingBursts: { time: number; x: number; y: number }[] = []

  // Wave 1: immediate — 3 bursts
  for (let i = 0; i < 3; i++) {
    pendingBursts.push({
      time: 0,
      x: random(el.width * 0.15, el.width * 0.85),
      y: random(el.height * 0.1, el.height * 0.4),
    })
  }

  // Wave 2: ~0.6s — 3 bursts
  for (let i = 0; i < 3; i++) {
    pendingBursts.push({
      time: 36,
      x: random(el.width * 0.1, el.width * 0.9),
      y: random(el.height * 0.15, el.height * 0.45),
    })
  }

  // Wave 3: ~1.3s — 3 bursts
  for (let i = 0; i < 3; i++) {
    pendingBursts.push({
      time: 78,
      x: random(el.width * 0.2, el.width * 0.8),
      y: random(el.height * 0.1, el.height * 0.35),
    })
  }

  // Wave 4: ~2s — 2 bursts
  for (let i = 0; i < 2; i++) {
    pendingBursts.push({
      time: 120,
      x: random(el.width * 0.25, el.width * 0.75),
      y: random(el.height * 0.15, el.height * 0.4),
    })
  }

  let frame = 0

  function animate() {
    frame++
    ctx.clearRect(0, 0, el.width, el.height)

    // Spawn pending bursts
    for (let i = pendingBursts.length - 1; i >= 0; i--) {
      if (frame >= pendingBursts[i].time) {
        createBurst(particles, pendingBursts[i].x, pendingBursts[i].y)
        pendingBursts.splice(i, 1)
      }
    }

    let alive = false
    for (const p of particles) {
      if (p.life <= 0) continue
      alive = true
      p.life--
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.04
      p.vx *= 0.988

      const progress = p.life / p.maxLife

      // Draw trail
      if (p.trail && progress > 0.3) {
        ctx.globalAlpha = progress * 0.3
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x - p.vx, p.y - p.vy, p.size * progress * 0.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // Draw particle
      ctx.globalAlpha = progress
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * Math.max(progress, 0.3), 0, Math.PI * 2)
      ctx.fill()

      // Sparkle effect on bright particles
      if (progress > 0.5 && Math.random() > 0.9) {
        ctx.globalAlpha = progress * 0.6
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * progress * 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    ctx.globalAlpha = 1

    if (alive || pendingBursts.length > 0) {
      animationId = requestAnimationFrame(animate)
    } else {
      emit('done')
    }
  }

  animationId = requestAnimationFrame(animate)
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
})
</script>

<template>
  <canvas
    ref="canvas"
    class="fixed inset-0 z-[100] pointer-events-none"
  />
</template>
