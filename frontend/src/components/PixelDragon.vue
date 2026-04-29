<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

const SCALE = 3
const SPRITE_W = 16
const SPRITE_H = 16
const W = SPRITE_W * SCALE
const H = SPRITE_H * SCALE
const GROUND_OFFSET = 8
const FLOOR_Y = () => window.innerHeight - H - GROUND_OFFSET

type DragonState = 'idle' | 'walk' | 'sit' | 'jump' | 'sleep' | 'peek'

const x = ref(100)
const y = ref(FLOOR_Y())
const facingLeft = ref(false)
const state = ref<DragonState>('idle')
const frame = ref(0)
const visible = ref(true)
const targetX = ref<number | null>(null)
const targetEl = ref<Element | null>(null)
const sittingOnEl = ref<Element | null>(null)
const jumpVY = ref(0)
const isJumping = ref(false)
const stateTimer = ref(0)
const sleepZ = ref(0)

const canvas = ref<HTMLCanvasElement | null>(null)

const COLORS = {
  body: '#48e858',
  bodyDark: '#18b838',
  belly: '#f0e8d8',
  eye: '#1a1028',
  eyeWhite: '#fff',
  wing: '#58a0ff',
  wingDark: '#2848e8',
  horn: '#f0a800',
  fire: '#ff4838',
  fireOrange: '#f0a800',
}

function drawPixel(ctx: CanvasRenderingContext2D, px: number, py: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(px * SCALE, py * SCALE, SCALE, SCALE)
}

function drawDragonIdle(ctx: CanvasRenderingContext2D, f: number) {
  const bob = f % 2 === 0 ? 0 : -1

  // Body
  for (let bx = 4; bx <= 10; bx++) {
    for (let by = 6 + bob; by <= 12 + bob; by++) {
      drawPixel(ctx, bx, by, COLORS.body)
    }
  }
  // Belly
  for (let bx = 5; bx <= 8; bx++) {
    for (let by = 9 + bob; by <= 12 + bob; by++) {
      drawPixel(ctx, bx, by, COLORS.belly)
    }
  }
  // Head
  for (let hx = 3; hx <= 9; hx++) {
    for (let hy = 3 + bob; hy <= 7 + bob; hy++) {
      drawPixel(ctx, hx, hy, COLORS.body)
    }
  }
  // Snout
  drawPixel(ctx, 2, 5 + bob, COLORS.body)
  drawPixel(ctx, 2, 6 + bob, COLORS.body)
  // Eye
  drawPixel(ctx, 4, 4 + bob, COLORS.eyeWhite)
  drawPixel(ctx, 5, 4 + bob, COLORS.eyeWhite)
  drawPixel(ctx, 5, 4 + bob, COLORS.eye)
  // Horns
  drawPixel(ctx, 7, 2 + bob, COLORS.horn)
  drawPixel(ctx, 9, 2 + bob, COLORS.horn)
  drawPixel(ctx, 8, 1 + bob, COLORS.horn)
  // Wing
  drawPixel(ctx, 9, 5 + bob, COLORS.wing)
  drawPixel(ctx, 10, 4 + bob, COLORS.wing)
  drawPixel(ctx, 11, 4 + bob, COLORS.wing)
  drawPixel(ctx, 11, 5 + bob, COLORS.wingDark)
  drawPixel(ctx, 12, 5 + bob, COLORS.wingDark)
  // Tail
  drawPixel(ctx, 11, 10 + bob, COLORS.body)
  drawPixel(ctx, 12, 9 + bob, COLORS.body)
  drawPixel(ctx, 13, 8 + bob, COLORS.bodyDark)
  drawPixel(ctx, 14, 8 + bob, COLORS.horn)
  // Legs
  drawPixel(ctx, 5, 13 + bob, COLORS.bodyDark)
  drawPixel(ctx, 6, 13 + bob, COLORS.bodyDark)
  drawPixel(ctx, 8, 13 + bob, COLORS.bodyDark)
  drawPixel(ctx, 9, 13 + bob, COLORS.bodyDark)
  // Feet
  drawPixel(ctx, 4, 14 + bob, COLORS.bodyDark)
  drawPixel(ctx, 5, 14 + bob, COLORS.bodyDark)
  drawPixel(ctx, 8, 14 + bob, COLORS.bodyDark)
  drawPixel(ctx, 9, 14 + bob, COLORS.bodyDark)
}

function drawDragonWalk(ctx: CanvasRenderingContext2D, f: number) {
  const bob = f % 2 === 0 ? 0 : -1
  const legShift = f % 2

  // Body
  for (let bx = 4; bx <= 10; bx++) {
    for (let by = 6 + bob; by <= 12 + bob; by++) {
      drawPixel(ctx, bx, by, COLORS.body)
    }
  }
  // Belly
  for (let bx = 5; bx <= 8; bx++) {
    for (let by = 9 + bob; by <= 12 + bob; by++) {
      drawPixel(ctx, bx, by, COLORS.belly)
    }
  }
  // Head
  for (let hx = 3; hx <= 9; hx++) {
    for (let hy = 3 + bob; hy <= 7 + bob; hy++) {
      drawPixel(ctx, hx, hy, COLORS.body)
    }
  }
  // Snout
  drawPixel(ctx, 2, 5 + bob, COLORS.body)
  drawPixel(ctx, 2, 6 + bob, COLORS.body)
  // Eye
  drawPixel(ctx, 4, 4 + bob, COLORS.eyeWhite)
  drawPixel(ctx, 5, 4 + bob, COLORS.eyeWhite)
  drawPixel(ctx, 5, 4 + bob, COLORS.eye)
  // Horns
  drawPixel(ctx, 7, 2 + bob, COLORS.horn)
  drawPixel(ctx, 9, 2 + bob, COLORS.horn)
  drawPixel(ctx, 8, 1 + bob, COLORS.horn)
  // Wing (flapping while walking)
  if (f % 4 < 2) {
    drawPixel(ctx, 9, 5 + bob, COLORS.wing)
    drawPixel(ctx, 10, 4 + bob, COLORS.wing)
    drawPixel(ctx, 11, 3 + bob, COLORS.wing)
    drawPixel(ctx, 11, 4 + bob, COLORS.wingDark)
    drawPixel(ctx, 12, 4 + bob, COLORS.wingDark)
  } else {
    drawPixel(ctx, 9, 5 + bob, COLORS.wing)
    drawPixel(ctx, 10, 5 + bob, COLORS.wing)
    drawPixel(ctx, 11, 6 + bob, COLORS.wingDark)
    drawPixel(ctx, 12, 6 + bob, COLORS.wingDark)
  }
  // Tail
  drawPixel(ctx, 11, 10 + bob, COLORS.body)
  drawPixel(ctx, 12, 9 + bob, COLORS.body)
  drawPixel(ctx, 13, 8 + bob, COLORS.bodyDark)
  drawPixel(ctx, 14, 8 + bob, COLORS.horn)
  // Legs (animated walk)
  if (legShift === 0) {
    drawPixel(ctx, 5, 13 + bob, COLORS.bodyDark)
    drawPixel(ctx, 4, 14 + bob, COLORS.bodyDark)
    drawPixel(ctx, 5, 14 + bob, COLORS.bodyDark)
    drawPixel(ctx, 9, 13 + bob, COLORS.bodyDark)
    drawPixel(ctx, 9, 14 + bob, COLORS.bodyDark)
    drawPixel(ctx, 10, 14 + bob, COLORS.bodyDark)
  } else {
    drawPixel(ctx, 6, 13 + bob, COLORS.bodyDark)
    drawPixel(ctx, 5, 14 + bob, COLORS.bodyDark)
    drawPixel(ctx, 6, 14 + bob, COLORS.bodyDark)
    drawPixel(ctx, 8, 13 + bob, COLORS.bodyDark)
    drawPixel(ctx, 7, 14 + bob, COLORS.bodyDark)
    drawPixel(ctx, 8, 14 + bob, COLORS.bodyDark)
  }
}

function drawDragonSit(ctx: CanvasRenderingContext2D, f: number) {
  const tailWag = f % 4 < 2 ? 0 : 1

  // Body (sitting, lower)
  for (let bx = 4; bx <= 10; bx++) {
    for (let by = 8; by <= 13; by++) {
      drawPixel(ctx, bx, by, COLORS.body)
    }
  }
  // Belly
  for (let bx = 5; bx <= 8; bx++) {
    for (let by = 10; by <= 13; by++) {
      drawPixel(ctx, bx, by, COLORS.belly)
    }
  }
  // Head
  for (let hx = 3; hx <= 9; hx++) {
    for (let hy = 5; hy <= 9; hy++) {
      drawPixel(ctx, hx, hy, COLORS.body)
    }
  }
  // Snout
  drawPixel(ctx, 2, 7, COLORS.body)
  drawPixel(ctx, 2, 8, COLORS.body)
  // Eye (happy squint)
  drawPixel(ctx, 4, 6, COLORS.eyeWhite)
  drawPixel(ctx, 5, 6, COLORS.eye)
  // Horns
  drawPixel(ctx, 7, 4, COLORS.horn)
  drawPixel(ctx, 9, 4, COLORS.horn)
  drawPixel(ctx, 8, 3, COLORS.horn)
  // Wing (folded)
  drawPixel(ctx, 9, 7, COLORS.wing)
  drawPixel(ctx, 10, 7, COLORS.wing)
  drawPixel(ctx, 10, 8, COLORS.wingDark)
  // Tail (wagging)
  drawPixel(ctx, 11, 11, COLORS.body)
  drawPixel(ctx, 12, 10 + tailWag, COLORS.body)
  drawPixel(ctx, 13, 9 + tailWag, COLORS.bodyDark)
  drawPixel(ctx, 14, 9 + tailWag, COLORS.horn)
  // Legs (tucked)
  drawPixel(ctx, 5, 14, COLORS.bodyDark)
  drawPixel(ctx, 6, 14, COLORS.bodyDark)
  drawPixel(ctx, 8, 14, COLORS.bodyDark)
  drawPixel(ctx, 9, 14, COLORS.bodyDark)
}

function drawDragonSleep(ctx: CanvasRenderingContext2D, f: number) {
  const breathe = f % 8 < 4 ? 0 : 1

  // Body (curled up)
  for (let bx = 4; bx <= 10; bx++) {
    for (let by = 9 + breathe; by <= 13; by++) {
      drawPixel(ctx, bx, by, COLORS.body)
    }
  }
  // Belly
  for (let bx = 5; bx <= 8; bx++) {
    for (let by = 11; by <= 13; by++) {
      drawPixel(ctx, bx, by, COLORS.belly)
    }
  }
  // Head (resting)
  for (let hx = 3; hx <= 8; hx++) {
    for (let hy = 7 + breathe; hy <= 10 + breathe; hy++) {
      drawPixel(ctx, hx, hy, COLORS.body)
    }
  }
  // Closed eyes
  drawPixel(ctx, 4, 8 + breathe, COLORS.eye)
  drawPixel(ctx, 5, 8 + breathe, COLORS.eye)
  // Horns
  drawPixel(ctx, 7, 6 + breathe, COLORS.horn)
  drawPixel(ctx, 8, 6 + breathe, COLORS.horn)
  // Wing (draped)
  drawPixel(ctx, 9, 8 + breathe, COLORS.wing)
  drawPixel(ctx, 10, 8 + breathe, COLORS.wing)
  drawPixel(ctx, 10, 9 + breathe, COLORS.wingDark)
  drawPixel(ctx, 11, 9 + breathe, COLORS.wingDark)
  // Tail (curled around)
  drawPixel(ctx, 11, 11, COLORS.body)
  drawPixel(ctx, 12, 12, COLORS.body)
  drawPixel(ctx, 12, 13, COLORS.bodyDark)
  drawPixel(ctx, 11, 13, COLORS.bodyDark)
  // Legs (tucked)
  drawPixel(ctx, 5, 14, COLORS.bodyDark)
  drawPixel(ctx, 8, 14, COLORS.bodyDark)

  // Z's
  const zFrame = Math.floor(f / 6) % 3
  const zColor = COLORS.wing
  if (zFrame >= 0) {
    drawPixel(ctx, 1, 5 + breathe, zColor)
    drawPixel(ctx, 2, 5 + breathe, zColor)
    drawPixel(ctx, 2, 6 + breathe, zColor)
    drawPixel(ctx, 1, 6 + breathe, zColor)
  }
  if (zFrame >= 1) {
    drawPixel(ctx, 0, 3 + breathe, zColor)
    drawPixel(ctx, 1, 3 + breathe, zColor)
    drawPixel(ctx, 0, 4 + breathe, zColor)
  }
  if (zFrame >= 2) {
    drawPixel(ctx, 0, 1 + breathe, zColor)
    drawPixel(ctx, 1, 1 + breathe, zColor)
  }
}

function drawDragonJump(ctx: CanvasRenderingContext2D, f: number) {
  // Body
  for (let bx = 4; bx <= 10; bx++) {
    for (let by = 6; by <= 12; by++) {
      drawPixel(ctx, bx, by, COLORS.body)
    }
  }
  // Belly
  for (let bx = 5; bx <= 8; bx++) {
    for (let by = 9; by <= 12; by++) {
      drawPixel(ctx, bx, by, COLORS.belly)
    }
  }
  // Head
  for (let hx = 3; hx <= 9; hx++) {
    for (let hy = 2; hy <= 7; hy++) {
      drawPixel(ctx, hx, hy, COLORS.body)
    }
  }
  // Snout
  drawPixel(ctx, 2, 4, COLORS.body)
  drawPixel(ctx, 2, 5, COLORS.body)
  // Eye (excited)
  drawPixel(ctx, 4, 3, COLORS.eyeWhite)
  drawPixel(ctx, 5, 3, COLORS.eyeWhite)
  drawPixel(ctx, 5, 3, COLORS.eye)
  drawPixel(ctx, 4, 4, COLORS.eyeWhite)
  // Horns
  drawPixel(ctx, 7, 1, COLORS.horn)
  drawPixel(ctx, 9, 1, COLORS.horn)
  drawPixel(ctx, 8, 0, COLORS.horn)
  // Wings (spread!)
  const wingUp = f % 2 === 0
  if (wingUp) {
    drawPixel(ctx, 10, 4, COLORS.wing)
    drawPixel(ctx, 11, 3, COLORS.wing)
    drawPixel(ctx, 12, 2, COLORS.wing)
    drawPixel(ctx, 13, 2, COLORS.wing)
    drawPixel(ctx, 12, 3, COLORS.wingDark)
    drawPixel(ctx, 13, 3, COLORS.wingDark)
    drawPixel(ctx, 14, 3, COLORS.wingDark)
  } else {
    drawPixel(ctx, 10, 5, COLORS.wing)
    drawPixel(ctx, 11, 4, COLORS.wing)
    drawPixel(ctx, 12, 4, COLORS.wing)
    drawPixel(ctx, 13, 4, COLORS.wingDark)
    drawPixel(ctx, 13, 5, COLORS.wingDark)
    drawPixel(ctx, 14, 5, COLORS.wingDark)
  }
  // Tail (up)
  drawPixel(ctx, 11, 9, COLORS.body)
  drawPixel(ctx, 12, 8, COLORS.body)
  drawPixel(ctx, 13, 7, COLORS.bodyDark)
  drawPixel(ctx, 14, 6, COLORS.horn)
  // Legs (stretched)
  drawPixel(ctx, 5, 13, COLORS.bodyDark)
  drawPixel(ctx, 5, 14, COLORS.bodyDark)
  drawPixel(ctx, 9, 13, COLORS.bodyDark)
  drawPixel(ctx, 9, 14, COLORS.bodyDark)

  // Fire breath when jumping!
  if (f % 3 < 2) {
    drawPixel(ctx, 1, 5, COLORS.fire)
    drawPixel(ctx, 0, 5, COLORS.fireOrange)
    drawPixel(ctx, 1, 6, COLORS.fireOrange)
    drawPixel(ctx, 0, 6, COLORS.fire)
    if (f % 3 === 0) {
      drawPixel(ctx, -1, 5, COLORS.fire)
      drawPixel(ctx, -1, 6, COLORS.fireOrange)
    }
  }
}

function drawDragonPeek(ctx: CanvasRenderingContext2D, f: number) {
  const blink = f % 12 < 2

  // Only head + upper body visible (peeking from edge)
  // Head
  for (let hx = 8; hx <= 14; hx++) {
    for (let hy = 4; hy <= 9; hy++) {
      drawPixel(ctx, hx, hy, COLORS.body)
    }
  }
  // Snout
  drawPixel(ctx, 15, 6, COLORS.body)
  drawPixel(ctx, 15, 7, COLORS.body)
  // Eye
  if (!blink) {
    drawPixel(ctx, 12, 5, COLORS.eyeWhite)
    drawPixel(ctx, 13, 5, COLORS.eyeWhite)
    drawPixel(ctx, 13, 5, COLORS.eye)
  } else {
    drawPixel(ctx, 12, 5, COLORS.eye)
    drawPixel(ctx, 13, 5, COLORS.eye)
  }
  // Horns
  drawPixel(ctx, 9, 3, COLORS.horn)
  drawPixel(ctx, 10, 2, COLORS.horn)
  drawPixel(ctx, 11, 3, COLORS.horn)
  // Claw on edge
  drawPixel(ctx, 10, 10, COLORS.bodyDark)
  drawPixel(ctx, 11, 10, COLORS.bodyDark)
  drawPixel(ctx, 12, 10, COLORS.bodyDark)
  drawPixel(ctx, 10, 11, COLORS.body)
  drawPixel(ctx, 11, 11, COLORS.body)
  drawPixel(ctx, 12, 11, COLORS.body)
}

function render() {
  const cvs = canvas.value
  if (!cvs) return
  const ctx = cvs.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, cvs.width, cvs.height)
  ctx.save()

  if (facingLeft.value) {
    ctx.translate(cvs.width, 0)
    ctx.scale(-1, 1)
  }

  switch (state.value) {
    case 'idle': drawDragonIdle(ctx, frame.value); break
    case 'walk': drawDragonWalk(ctx, frame.value); break
    case 'sit': drawDragonSit(ctx, frame.value); break
    case 'sleep': drawDragonSleep(ctx, frame.value); break
    case 'jump': drawDragonJump(ctx, frame.value); break
    case 'peek': drawDragonPeek(ctx, frame.value); break
  }

  ctx.restore()
}

function findInteractiveTarget(): { el: Element; rect: DOMRect } | null {
  const candidates = [
    ...document.querySelectorAll('.card-tactile'),
    ...document.querySelectorAll('.fab-play'),
    ...document.querySelectorAll('[data-dragon-target]'),
  ]

  const visible = candidates.filter(el => {
    const r = el.getBoundingClientRect()
    return r.top < window.innerHeight && r.bottom > 0 && r.width > 0
  })

  if (visible.length === 0) return null
  const el = visible[Math.floor(Math.random() * visible.length)]
  return { el, rect: el.getBoundingClientRect() }
}

function pickNextAction() {
  const roll = Math.random()

  if (roll < 0.3) {
    // Walk to a random spot
    state.value = 'walk'
    targetX.value = Math.random() * (window.innerWidth - W - 80) + 40
    targetEl.value = null
    stateTimer.value = 0
  } else if (roll < 0.55) {
    // Walk to a card and sit on it
    const target = findInteractiveTarget()
    if (target) {
      state.value = 'walk'
      targetX.value = target.rect.left + target.rect.width / 2 - W / 2 + window.scrollX
      targetEl.value = target.el
      stateTimer.value = 0
    } else {
      state.value = 'idle'
      stateTimer.value = 80
    }
  } else if (roll < 0.7) {
    // Jump!
    state.value = 'jump'
    isJumping.value = true
    jumpVY.value = -8
    stateTimer.value = 0
  } else if (roll < 0.85) {
    // Sleep
    state.value = 'sleep'
    stateTimer.value = 200
  } else {
    // Peek from sidebar
    state.value = 'peek'
    const sidebar = document.querySelector('.sidebar-surface')
    if (sidebar) {
      const sidebarRect = sidebar.getBoundingClientRect()
      x.value = sidebarRect.right - W + 10
      y.value = sidebarRect.top + sidebarRect.height / 3
    } else {
      x.value = -W + 20
      y.value = window.innerHeight / 3
    }
    stateTimer.value = 120
  }
}

const WALK_SPEED = 2
let tickId: number | null = null
let frameCount = 0

function tick() {
  frameCount++

  // Animate at ~8fps for pixel feel
  if (frameCount % 8 === 0) {
    frame.value++
  }

  const floorY = FLOOR_Y()

  switch (state.value) {
    case 'idle': {
      stateTimer.value--
      if (stateTimer.value <= 0) pickNextAction()
      y.value = floorY
      break
    }

    case 'walk': {
      if (targetX.value !== null) {
        const dx = targetX.value - x.value
        if (Math.abs(dx) < WALK_SPEED + 1) {
          x.value = targetX.value
          targetX.value = null
          if (targetEl.value) {
            // Arrived at element — sit on top of it
            const rect = targetEl.value.getBoundingClientRect()
            state.value = 'sit'
            y.value = rect.top + window.scrollY - H + 4
            stateTimer.value = 150 + Math.floor(Math.random() * 100)
            sittingOnEl.value = targetEl.value
            targetEl.value = null
          } else {
            state.value = 'idle'
            stateTimer.value = 60 + Math.floor(Math.random() * 80)
            y.value = floorY
          }
        } else {
          facingLeft.value = dx < 0
          x.value += dx > 0 ? WALK_SPEED : -WALK_SPEED
          y.value = floorY
        }
      } else {
        state.value = 'idle'
        stateTimer.value = 60
        y.value = floorY
      }
      break
    }

    case 'sit': {
      stateTimer.value--
      if (sittingOnEl.value) {
        const rect = sittingOnEl.value.getBoundingClientRect()
        y.value = rect.top - H + 4
        x.value = rect.left + rect.width / 2 - W / 2
      }
      if (stateTimer.value <= 0) {
        sittingOnEl.value = null
        y.value = floorY
        pickNextAction()
      }
      break
    }

    case 'jump': {
      y.value += jumpVY.value
      jumpVY.value += 0.5
      if (y.value >= floorY) {
        y.value = floorY
        isJumping.value = false
        state.value = 'idle'
        stateTimer.value = 40 + Math.floor(Math.random() * 40)
      }
      break
    }

    case 'sleep': {
      stateTimer.value--
      y.value = floorY
      if (stateTimer.value <= 0) {
        pickNextAction()
      }
      break
    }

    case 'peek': {
      stateTimer.value--
      if (stateTimer.value <= 0) {
        y.value = floorY
        x.value = 80
        state.value = 'idle'
        stateTimer.value = 40
      }
      break
    }
  }

  // Clamp position
  x.value = Math.max(-10, Math.min(window.innerWidth - W + 10, x.value))

  render()
  tickId = requestAnimationFrame(tick)
}

function handleClick() {
  if (state.value === 'sleep') {
    // Wake up!
    state.value = 'jump'
    isJumping.value = true
    jumpVY.value = -10
    y.value = FLOOR_Y()
    return
  }
  // Jump on click
  if (!isJumping.value) {
    state.value = 'jump'
    isJumping.value = true
    jumpVY.value = -10
  }
}

function handleResize() {
  y.value = FLOOR_Y()
}

onMounted(() => {
  y.value = FLOOR_Y()
  state.value = 'idle'
  stateTimer.value = 60
  tickId = requestAnimationFrame(tick)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (tickId !== null) cancelAnimationFrame(tickId)
  window.removeEventListener('resize', handleResize)
})

const style = computed(() => ({
  position: 'fixed' as const,
  left: `${x.value}px`,
  top: `${y.value}px`,
  zIndex: 9999,
  cursor: 'pointer',
  imageRendering: 'pixelated' as const,
  pointerEvents: 'auto' as const,
}))
</script>

<template>
  <canvas
    v-show="visible"
    ref="canvas"
    :width="W"
    :height="H"
    :style="style"
    @click="handleClick"
  />
</template>
