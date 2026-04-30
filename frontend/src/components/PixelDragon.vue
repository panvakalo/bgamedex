<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

const SCALE = 3
const SPRITE_W = 24
const SPRITE_H = 28
const W = SPRITE_W * SCALE
const H = SPRITE_H * SCALE
const GROUND_OFFSET = 8
const FLOOR_Y = () => window.innerHeight - H - GROUND_OFFSET

type DragonState = 'idle' | 'walk' | 'sit' | 'jump' | 'sleep' | 'peek' | 'dragged'

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

const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragOffsetX = ref(0)
const dragOffsetY = ref(0)
const didDrag = ref(false)

const canvas = ref<HTMLCanvasElement | null>(null)

const C = {
  O: '#1a1020',
  gH: '#78c850',  // green highlight
  gM: '#58a840',  // green main
  gD: '#3d9050',  // green dark
  gS: '#1a6040',  // green shadow
  gX: '#0e3828',  // green deepest
  bH: '#f0c848',  // belly highlight
  bM: '#e8a830',  // belly main
  bD: '#c88020',  // belly dark
  eW: '#ffffff',  // eye white
  eI: '#208060',  // eye iris
  eP: '#1a1020',  // eye pupil
  wO: '#d06030',  // wing orange
  wR: '#a02820',  // wing red
  hO: '#d06030',  // horn/claw orange
  hR: '#a02820',  // horn/claw red
  f1: '#f0c848',
  f2: '#e88030',
  f3: '#d04030',
  f4: '#a02820',
}

type SpriteData = [number, number, string][]

function px(ctx: CanvasRenderingContext2D, sx: number, sy: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(sx * SCALE, sy * SCALE, SCALE, SCALE)
}

function drawSprite(ctx: CanvasRenderingContext2D, data: SpriteData) {
  for (const [sx, sy, color] of data) {
    px(ctx, sx, sy, color)
  }
}

// Helper: draw a filled rect of pixels
function rect(x1: number, y1: number, x2: number, y2: number, c: string): SpriteData {
  const d: SpriteData = []
  for (let px = x1; px <= x2; px++)
    for (let py = y1; py <= y2; py++)
      d.push([px, py, c])
  return d
}

// Sprite faces RIGHT (mouth/face on right side). Canvas flip handles facingLeft.
// 24w x 28h grid.
function makeIdleFrame(f: number): SpriteData {
  const bob = f % 4 < 2 ? 0 : -1
  const blink = f % 24 < 2
  const tailWag = f % 6 < 3 ? 0 : 1
  const wingBob = f % 8 < 4 ? 0 : 1
  const b = bob
  const O = C.O
  const d: SpriteData = []

  // ─── HORNS ───
  // Left horn (2px wide, 3px tall)
  d.push([10, 0+b, C.hO], [11, 0+b, C.hR])
  d.push([10, 1+b, O], [11, 1+b, C.hO])
  d.push([11, 2+b, O])
  // Right horn
  d.push([15, 0+b, C.hO], [16, 0+b, C.hR])
  d.push([15, 1+b, O], [16, 1+b, C.hO])
  d.push([15, 2+b, O])

  // ─── HEAD (large chibi ~10x9) ───
  // Row 2: top of skull
  d.push(...rect(11, 2+b, 15, 2+b, O))
  // Row 3: skull widens
  d.push([9, 3+b, O], ...rect(10, 3+b, 16, 3+b, C.gH), [17, 3+b, O])
  // Row 4
  d.push([8, 4+b, O], ...rect(9, 4+b, 11, 4+b, C.gH), ...rect(12, 4+b, 16, 4+b, C.gM), [17, 4+b, C.gD], [18, 4+b, O])
  // Row 5: eye row
  if (!blink) {
    d.push([8, 5+b, O], [9, 5+b, C.gH], [10, 5+b, C.gM])
    // Eye: 3w x 3h outline + iris
    d.push([11, 5+b, O], [12, 5+b, O], [13, 5+b, O], [14, 5+b, O])
    d.push([15, 5+b, C.gM], [16, 5+b, C.gD], [17, 5+b, C.gD], [18, 5+b, O])
  } else {
    d.push([8, 5+b, O], [9, 5+b, C.gH], [10, 5+b, C.gM], [11, 5+b, C.gM], [12, 5+b, O], [13, 5+b, O], [14, 5+b, C.gM], [15, 5+b, C.gM], [16, 5+b, C.gD], [17, 5+b, C.gD], [18, 5+b, O])
  }
  // Row 6: eye middle
  if (!blink) {
    d.push([8, 6+b, O], [9, 6+b, C.gM], [10, 6+b, C.gM])
    d.push([11, 6+b, O], [12, 6+b, C.eW], [13, 6+b, C.eI], [14, 6+b, O])
    d.push([15, 6+b, C.gM], [16, 6+b, C.gD], [17, 6+b, C.gD], [18, 6+b, O])
    // Eye shine
    d.push([12, 6+b, C.eW])
  } else {
    d.push([8, 6+b, O], ...rect(9, 6+b, 17, 6+b, C.gM), [18, 6+b, O])
  }
  // Row 7: eye bottom / cheek
  if (!blink) {
    d.push([8, 7+b, O], [9, 7+b, C.gM], [10, 7+b, C.gM])
    d.push([11, 7+b, O], [12, 7+b, C.eI], [13, 7+b, C.eP], [14, 7+b, O])
    d.push([15, 7+b, C.gM], [16, 7+b, C.gD], [17, 7+b, C.gD], [18, 7+b, O])
  } else {
    d.push([8, 7+b, O], ...rect(9, 7+b, 17, 7+b, C.gM), [18, 7+b, O])
  }
  // Row 8: lower face
  d.push([8, 8+b, O], [9, 8+b, C.gM], ...rect(10, 8+b, 16, 8+b, C.gD), [17, 8+b, C.gS], [18, 8+b, O])
  // Row 9: jaw
  d.push([9, 9+b, O], ...rect(10, 9+b, 16, 9+b, C.gD), [17, 9+b, O])
  // Row 10: chin / neck transition
  d.push([10, 10+b, O], ...rect(11, 10+b, 15, 10+b, C.gS), [16, 10+b, O])

  // ─── WING (behind body, to the left/back) ───
  const wy = wingBob
  // Wing frame (orange) and membrane (red)
  d.push([3, 10+b-wy, O], [4, 9+b-wy, O], [5, 8+b-wy, O], [6, 8+b-wy, O])
  d.push([2, 11+b-wy, O], [3, 11+b-wy, C.wO], [4, 10+b-wy, C.wO], [5, 9+b-wy, C.wO], [6, 9+b-wy, C.wR])
  d.push([1, 12+b-wy, O], [2, 12+b-wy, C.wO], [3, 12+b-wy, C.wR], [4, 11+b-wy, C.wR], [5, 10+b-wy, C.wR], [6, 10+b-wy, O])
  d.push([1, 13+b-wy, O], [2, 13+b-wy, C.wR], [3, 13+b-wy, C.wR], [4, 12+b-wy, C.wR], [5, 11+b-wy, O])
  d.push([2, 14+b-wy, O], [3, 14+b-wy, O], [4, 13+b-wy, O])

  // ─── BODY / TORSO ───
  // Row 11
  d.push([7, 11+b, O], [8, 11+b, C.gD], [9, 11+b, C.gS], [10, 11+b, C.gS])
  d.push([11, 11+b, C.bH], [12, 11+b, C.bM], [13, 11+b, C.bM])
  d.push([14, 11+b, C.gS], [15, 11+b, C.gS], [16, 11+b, O])
  // Row 12
  d.push([6, 12+b, O], [7, 12+b, C.gM], [8, 12+b, C.gD], [9, 12+b, C.gS], [10, 12+b, C.gS])
  d.push([11, 12+b, C.bH], [12, 12+b, C.bM], [13, 12+b, C.bD])
  d.push([14, 12+b, C.gS], [15, 12+b, C.gX], [16, 12+b, O])
  // Row 13
  d.push([6, 13+b, O], [7, 13+b, C.gD], [8, 13+b, C.gS], [9, 13+b, C.gS])
  d.push([10, 13+b, C.bM], [11, 13+b, C.bM], [12, 13+b, C.bD], [13, 13+b, C.bD])
  d.push([14, 13+b, C.gX], [15, 13+b, C.gX], [16, 13+b, O])
  // Row 14
  d.push([6, 14+b, O], [7, 14+b, C.gD], [8, 14+b, C.gS], [9, 14+b, C.gS])
  d.push([10, 14+b, C.bD], [11, 14+b, C.bD], [12, 14+b, C.bD])
  d.push([13, 14+b, C.gS], [14, 14+b, C.gX], [15, 14+b, C.gX], [16, 14+b, O])
  // Row 15 (lower body)
  d.push([6, 15+b, O], [7, 15+b, C.gS], [8, 15+b, C.gS], [9, 15+b, C.gX])
  d.push([10, 15+b, C.bD], [11, 15+b, C.bD])
  d.push([12, 15+b, C.gS], [13, 15+b, C.gX], [14, 15+b, C.gX], [15, 15+b, C.gX], [16, 15+b, O])

  // ─── LEGS ───
  // Front leg (left side of body)
  d.push([6, 16+b, O], [7, 16+b, C.gD], [8, 16+b, C.gS], [9, 16+b, O])
  d.push([6, 17+b, O], [7, 17+b, C.gS], [8, 17+b, C.gS], [9, 17+b, O])
  d.push([6, 18+b, O], [7, 18+b, C.gS], [8, 18+b, C.gX], [9, 18+b, O])
  d.push([5, 19+b, O], [6, 19+b, C.hO], [7, 19+b, C.gS], [8, 19+b, C.gX], [9, 19+b, C.hO], [10, 19+b, O])
  d.push([5, 20+b, O], [6, 20+b, O], [7, 20+b, O], [8, 20+b, O], [9, 20+b, O], [10, 20+b, O])

  // Back leg (right side of body)
  d.push([11, 16+b, O], [12, 16+b, C.gS], [13, 16+b, C.gX], [14, 16+b, C.gX], [15, 16+b, O])
  d.push([11, 17+b, O], [12, 17+b, C.gX], [13, 17+b, C.gX], [14, 17+b, C.gX], [15, 17+b, O])
  d.push([11, 18+b, O], [12, 18+b, C.gX], [13, 18+b, C.gX], [14, 18+b, C.gX], [15, 18+b, O])
  d.push([10, 19+b, O], [11, 19+b, C.hO], [12, 19+b, C.gX], [13, 19+b, C.gX], [14, 19+b, C.gX], [15, 19+b, C.hO], [16, 19+b, O])
  d.push([10, 20+b, O], [11, 20+b, O], [12, 20+b, O], [13, 20+b, O], [14, 20+b, O], [15, 20+b, O], [16, 20+b, O])

  // ─── TAIL (curling left from body base) ───
  const tw = tailWag
  d.push([5, 15+b+tw, O], [6, 15+b+tw, C.gD])
  d.push([4, 16+b+tw, O], [5, 16+b+tw, C.gS])
  d.push([3, 17+b+tw, O], [4, 17+b+tw, C.gS])
  d.push([2, 18+b+tw, O], [3, 18+b+tw, C.gX])
  d.push([1, 19+b+tw, O], [2, 19+b+tw, C.gX])
  d.push([0, 20+b+tw, O], [1, 20+b+tw, C.gX])
  // Tail tip (orange)
  d.push([0, 21+b+tw, C.hO], [1, 21+b+tw, O])

  return d
}

function makeWalkFrame(f: number): SpriteData {
  const bob = f % 4 < 2 ? 0 : -1
  const blink = f % 24 < 2
  const tailWag = f % 4 < 2 ? 0 : 1
  const wingBob = f % 4 < 2 ? 0 : 1
  const b = bob
  const O = C.O
  const d: SpriteData = []
  const step = f % 4

  // ─── HORNS ───
  d.push([10, 0+b, C.hO], [11, 0+b, C.hR], [10, 1+b, O], [11, 1+b, C.hO], [11, 2+b, O])
  d.push([15, 0+b, C.hO], [16, 0+b, C.hR], [15, 1+b, O], [16, 1+b, C.hO], [15, 2+b, O])

  // ─── HEAD (same as idle) ───
  d.push(...rect(11, 2+b, 15, 2+b, O))
  d.push([9, 3+b, O], ...rect(10, 3+b, 16, 3+b, C.gH), [17, 3+b, O])
  d.push([8, 4+b, O], ...rect(9, 4+b, 11, 4+b, C.gH), ...rect(12, 4+b, 16, 4+b, C.gM), [17, 4+b, C.gD], [18, 4+b, O])
  if (!blink) {
    d.push([8, 5+b, O], [9, 5+b, C.gH], [10, 5+b, C.gM], [11, 5+b, O], [12, 5+b, O], [13, 5+b, O], [14, 5+b, O], [15, 5+b, C.gM], [16, 5+b, C.gD], [17, 5+b, C.gD], [18, 5+b, O])
    d.push([8, 6+b, O], [9, 6+b, C.gM], [10, 6+b, C.gM], [11, 6+b, O], [12, 6+b, C.eW], [13, 6+b, C.eI], [14, 6+b, O], [15, 6+b, C.gM], [16, 6+b, C.gD], [17, 6+b, C.gD], [18, 6+b, O])
    d.push([8, 7+b, O], [9, 7+b, C.gM], [10, 7+b, C.gM], [11, 7+b, O], [12, 7+b, C.eI], [13, 7+b, C.eP], [14, 7+b, O], [15, 7+b, C.gM], [16, 7+b, C.gD], [17, 7+b, C.gD], [18, 7+b, O])
  } else {
    d.push([8, 5+b, O], [9, 5+b, C.gH], [10, 5+b, C.gM], [11, 5+b, C.gM], [12, 5+b, O], [13, 5+b, O], [14, 5+b, C.gM], [15, 5+b, C.gM], [16, 5+b, C.gD], [17, 5+b, C.gD], [18, 5+b, O])
    d.push([8, 6+b, O], ...rect(9, 6+b, 17, 6+b, C.gM), [18, 6+b, O])
    d.push([8, 7+b, O], ...rect(9, 7+b, 17, 7+b, C.gM), [18, 7+b, O])
  }
  d.push([8, 8+b, O], [9, 8+b, C.gM], ...rect(10, 8+b, 16, 8+b, C.gD), [17, 8+b, C.gS], [18, 8+b, O])
  d.push([9, 9+b, O], ...rect(10, 9+b, 16, 9+b, C.gD), [17, 9+b, O])
  d.push([10, 10+b, O], ...rect(11, 10+b, 15, 10+b, C.gS), [16, 10+b, O])

  // ─── WING ───
  const wy = wingBob
  d.push([3, 10+b-wy, O], [4, 9+b-wy, O], [5, 8+b-wy, O], [6, 8+b-wy, O])
  d.push([2, 11+b-wy, O], [3, 11+b-wy, C.wO], [4, 10+b-wy, C.wO], [5, 9+b-wy, C.wO], [6, 9+b-wy, C.wR])
  d.push([1, 12+b-wy, O], [2, 12+b-wy, C.wO], [3, 12+b-wy, C.wR], [4, 11+b-wy, C.wR], [5, 10+b-wy, C.wR], [6, 10+b-wy, O])
  d.push([1, 13+b-wy, O], [2, 13+b-wy, C.wR], [3, 13+b-wy, C.wR], [4, 12+b-wy, C.wR], [5, 11+b-wy, O])
  d.push([2, 14+b-wy, O], [3, 14+b-wy, O], [4, 13+b-wy, O])

  // ─── BODY ───
  d.push([7, 11+b, O], [8, 11+b, C.gD], [9, 11+b, C.gS], [10, 11+b, C.gS], [11, 11+b, C.bH], [12, 11+b, C.bM], [13, 11+b, C.bM], [14, 11+b, C.gS], [15, 11+b, C.gS], [16, 11+b, O])
  d.push([6, 12+b, O], [7, 12+b, C.gM], [8, 12+b, C.gD], [9, 12+b, C.gS], [10, 12+b, C.gS], [11, 12+b, C.bH], [12, 12+b, C.bM], [13, 12+b, C.bD], [14, 12+b, C.gS], [15, 12+b, C.gX], [16, 12+b, O])
  d.push([6, 13+b, O], [7, 13+b, C.gD], [8, 13+b, C.gS], [9, 13+b, C.gS], [10, 13+b, C.bM], [11, 13+b, C.bM], [12, 13+b, C.bD], [13, 13+b, C.bD], [14, 13+b, C.gX], [15, 13+b, C.gX], [16, 13+b, O])
  d.push([6, 14+b, O], [7, 14+b, C.gD], [8, 14+b, C.gS], [9, 14+b, C.gS], [10, 14+b, C.bD], [11, 14+b, C.bD], [12, 14+b, C.bD], [13, 14+b, C.gS], [14, 14+b, C.gX], [15, 14+b, C.gX], [16, 14+b, O])
  d.push([6, 15+b, O], [7, 15+b, C.gS], [8, 15+b, C.gS], [9, 15+b, C.gX], [10, 15+b, C.bD], [11, 15+b, C.bD], [12, 15+b, C.gS], [13, 15+b, C.gX], [14, 15+b, C.gX], [15, 15+b, C.gX], [16, 15+b, O])

  // ─── WALKING LEGS ───
  if (step < 2) {
    // Front leg forward
    d.push([5, 16+b, O], [6, 16+b, C.gD], [7, 16+b, C.gS], [8, 16+b, O])
    d.push([4, 17+b, O], [5, 17+b, C.gS], [6, 17+b, C.gS], [7, 17+b, C.gX], [8, 17+b, O])
    d.push([4, 18+b, O], [5, 18+b, C.hO], [6, 18+b, C.gX], [7, 18+b, C.gX], [8, 18+b, C.hO], [9, 18+b, O])
    d.push([4, 19+b, O], [5, 19+b, O], [6, 19+b, O], [7, 19+b, O], [8, 19+b, O])
    // Back leg back
    d.push([12, 16+b, O], [13, 16+b, C.gX], [14, 16+b, C.gX], [15, 16+b, C.gX], [16, 16+b, O])
    d.push([13, 17+b, O], [14, 17+b, C.gX], [15, 17+b, C.gX], [16, 17+b, O])
    d.push([13, 18+b, O], [14, 18+b, C.gX], [15, 18+b, C.gX], [16, 18+b, O])
    d.push([12, 19+b, O], [13, 19+b, C.hO], [14, 19+b, C.gX], [15, 19+b, C.gX], [16, 19+b, C.hO], [17, 19+b, O])
    d.push([12, 20+b, O], [13, 20+b, O], [14, 20+b, O], [15, 20+b, O], [16, 20+b, O])
  } else {
    // Front leg back
    d.push([7, 16+b, O], [8, 16+b, C.gD], [9, 16+b, C.gS], [10, 16+b, O])
    d.push([7, 17+b, O], [8, 17+b, C.gS], [9, 17+b, C.gX], [10, 17+b, O])
    d.push([7, 18+b, O], [8, 18+b, C.gX], [9, 18+b, C.gX], [10, 18+b, O])
    d.push([6, 19+b, O], [7, 19+b, C.hO], [8, 19+b, C.gX], [9, 19+b, C.gX], [10, 19+b, C.hO], [11, 19+b, O])
    d.push([6, 20+b, O], [7, 20+b, O], [8, 20+b, O], [9, 20+b, O], [10, 20+b, O])
    // Back leg forward
    d.push([11, 16+b, O], [12, 16+b, C.gX], [13, 16+b, C.gX], [14, 16+b, O])
    d.push([11, 17+b, O], [12, 17+b, C.gX], [13, 17+b, C.gX], [14, 17+b, O])
    d.push([10, 18+b, O], [11, 18+b, C.hO], [12, 18+b, C.gX], [13, 18+b, C.gX], [14, 18+b, C.hO], [15, 18+b, O])
    d.push([10, 19+b, O], [11, 19+b, O], [12, 19+b, O], [13, 19+b, O], [14, 19+b, O])
  }

  // ─── TAIL ───
  const tw = tailWag
  d.push([5, 15+b+tw, O], [6, 15+b+tw, C.gD])
  d.push([4, 16+b+tw, O], [5, 16+b+tw, C.gS])
  d.push([3, 17+b+tw, O], [4, 17+b+tw, C.gS])
  d.push([2, 18+b+tw, O], [3, 18+b+tw, C.gX])
  d.push([1, 19+b+tw, O], [2, 19+b+tw, C.gX])
  d.push([0, 20+b+tw, O], [1, 20+b+tw, C.gX])
  d.push([0, 21+b+tw, C.hO], [1, 21+b+tw, O])

  return d
}

function makeSitFrame(f: number): SpriteData {
  const tailWag = f % 6 < 3 ? 0 : 1
  const blink = f % 20 < 2
  const O = C.O
  const d: SpriteData = []

  // Horns
  d.push([10, 4, C.hO], [11, 4, C.hR], [10, 5, O], [11, 5, C.hO], [11, 6, O])
  d.push([15, 4, C.hO], [16, 4, C.hR], [15, 5, O], [16, 5, C.hO], [15, 6, O])

  // Head (shifted down for sitting)
  d.push(...rect(11, 6, 15, 6, O))
  d.push([9, 7, O], ...rect(10, 7, 16, 7, C.gH), [17, 7, O])
  d.push([8, 8, O], ...rect(9, 8, 11, 8, C.gH), ...rect(12, 8, 16, 8, C.gM), [17, 8, C.gD], [18, 8, O])
  if (!blink) {
    d.push([8, 9, O], [9, 9, C.gH], [10, 9, C.gM], [11, 9, O], [12, 9, O], [13, 9, O], [14, 9, O], [15, 9, C.gM], [16, 9, C.gD], [17, 9, C.gD], [18, 9, O])
    d.push([8, 10, O], [9, 10, C.gM], [10, 10, C.gM], [11, 10, O], [12, 10, C.eW], [13, 10, C.eI], [14, 10, O], [15, 10, C.gM], [16, 10, C.gD], [17, 10, C.gD], [18, 10, O])
    d.push([8, 11, O], [9, 11, C.gM], [10, 11, C.gM], [11, 11, O], [12, 11, C.eI], [13, 11, C.eP], [14, 11, O], [15, 11, C.gM], [16, 11, C.gD], [17, 11, C.gD], [18, 11, O])
  } else {
    d.push([8, 9, O], [9, 9, C.gH], ...rect(10, 9, 17, 9, C.gM), [18, 9, O])
    d.push([8, 10, O], ...rect(9, 10, 17, 10, C.gM), [18, 10, O])
    d.push([8, 11, O], ...rect(9, 11, 17, 11, C.gM), [18, 11, O])
  }
  d.push([8, 12, O], [9, 12, C.gM], ...rect(10, 12, 16, 12, C.gD), [17, 12, C.gS], [18, 12, O])
  d.push([9, 13, O], ...rect(10, 13, 16, 13, C.gD), [17, 13, O])
  d.push([10, 14, O], ...rect(11, 14, 15, 14, C.gS), [16, 14, O])

  // Body (compressed)
  d.push([7, 15, O], [8, 15, C.gD], [9, 15, C.gS], [10, 15, C.gS], [11, 15, C.bH], [12, 15, C.bM], [13, 15, C.bM], [14, 15, C.gS], [15, 15, C.gX], [16, 15, O])
  d.push([7, 16, O], [8, 16, C.gS], [9, 16, C.gS], [10, 16, C.gX], [11, 16, C.bM], [12, 16, C.bD], [13, 16, C.bD], [14, 16, C.gX], [15, 16, C.gX], [16, 16, O])
  d.push([7, 17, O], [8, 17, C.gS], [9, 17, C.gX], [10, 17, C.gX], [11, 17, C.bD], [12, 17, C.bD], [13, 17, C.gX], [14, 17, C.gX], [15, 17, C.gX], [16, 17, O])

  // Wing (folded small)
  d.push([4, 14, O], [5, 13, O], [6, 13, O])
  d.push([3, 15, O], [4, 15, C.wO], [5, 14, C.wO], [6, 14, C.wR])
  d.push([3, 16, O], [4, 16, C.wR], [5, 15, C.wR], [6, 15, O])
  d.push([4, 17, O], [5, 16, O])

  // Tucked feet
  d.push([7, 18, O], [8, 18, C.hO], [9, 18, C.gX], [10, 18, C.gX], [11, 18, C.gX], [12, 18, C.gX], [13, 18, C.hO], [14, 18, C.gX], [15, 18, C.gX], [16, 18, O])
  d.push([7, 19, O], [8, 19, O], [9, 19, O], [10, 19, O], [11, 19, O], [12, 19, O], [13, 19, O], [14, 19, O], [15, 19, O], [16, 19, O])

  // Tail
  d.push([5, 17+tailWag, O], [6, 17+tailWag, C.gD])
  d.push([4, 18+tailWag, O], [5, 18+tailWag, C.gS])
  d.push([3, 19+tailWag, O], [4, 19+tailWag, C.gX])
  d.push([2, 20+tailWag, O], [3, 20+tailWag, C.gX])
  d.push([1, 21+tailWag, C.hO], [2, 21+tailWag, O])

  return d
}

function makeSleepFrame(f: number): SpriteData {
  const breathe = f % 12 < 6 ? 0 : 1
  const zPhase = Math.floor(f / 8) % 4
  const O = C.O
  const d: SpriteData = []

  // Head resting
  d.push(...rect(7, 13+breathe, 12, 13+breathe, O))
  d.push([6, 14+breathe, O], ...rect(7, 14+breathe, 8, 14+breathe, C.gH), ...rect(9, 14+breathe, 12, 14+breathe, C.gM), [13, 14+breathe, O])
  d.push([6, 15+breathe, O], [7, 15+breathe, C.gM], [8, 15+breathe, O], [9, 15+breathe, O], [10, 15+breathe, C.gM], [11, 15+breathe, C.gD], [12, 15+breathe, C.gD], [13, 15+breathe, O])
  d.push([6, 16+breathe, O], ...rect(7, 16+breathe, 12, 16+breathe, C.gD), [13, 16+breathe, O])
  d.push([7, 17+breathe, O], ...rect(8, 17+breathe, 12, 17+breathe, O))

  // Horn
  d.push([7, 12+breathe, C.hO], [8, 12+breathe, C.hR])

  // Body curled
  d.push(...rect(8, 17+breathe, 17, 17+breathe, O))
  d.push([7, 18+breathe, O], [8, 18+breathe, C.gM], [9, 18+breathe, C.gD], [10, 18+breathe, C.gS], [11, 18+breathe, C.bM], [12, 18+breathe, C.bM], [13, 18+breathe, C.gS], [14, 18+breathe, C.gS], [15, 18+breathe, C.gX], [16, 18+breathe, C.gX], [17, 18+breathe, O])
  d.push([7, 19+breathe, O], [8, 19+breathe, C.gD], [9, 19+breathe, C.gS], [10, 19+breathe, C.gX], [11, 19+breathe, C.bD], [12, 19+breathe, C.bD], [13, 19+breathe, C.gX], [14, 19+breathe, C.gX], [15, 19+breathe, C.gX], [16, 19+breathe, C.gX], [17, 19+breathe, O])
  d.push(...rect(7, 20+breathe, 17, 20+breathe, O))

  // Wing draped
  d.push([11, 17+breathe, C.wO], [12, 17+breathe, C.wO], [13, 17+breathe, C.wR], [14, 17+breathe, C.wR], [15, 17+breathe, C.wO])

  // Tail curled around
  d.push([17, 19+breathe, C.gX], [18, 18+breathe, O], [18, 19+breathe, C.gX])
  d.push([19, 19+breathe, C.hO], [19, 18+breathe, O])

  // Paw
  d.push([7, 19+breathe, C.hO], [8, 20+breathe, C.hO])

  // Z's
  const zc = C.bH
  if (zPhase >= 1) d.push([5, 10+breathe, zc], [6, 10+breathe, zc], [6, 11+breathe, zc], [5, 11+breathe, zc])
  if (zPhase >= 2) d.push([3, 7+breathe, zc], [4, 7+breathe, zc], [3, 8+breathe, zc])
  if (zPhase >= 3) d.push([2, 4+breathe, zc], [3, 4+breathe, zc], [2, 5+breathe, zc])

  return d
}

function makeJumpFrame(f: number): SpriteData {
  const wingFlap = f % 3
  const fireFrame = f % 4
  const O = C.O
  const d: SpriteData = []

  // Horns
  d.push([10, 0, C.hO], [11, 0, C.hR], [10, 1, O], [11, 1, C.hO], [11, 2, O])
  d.push([15, 0, C.hO], [16, 0, C.hR], [15, 1, O], [16, 1, C.hO], [15, 2, O])

  // Head
  d.push(...rect(11, 2, 15, 2, O))
  d.push([9, 3, O], ...rect(10, 3, 16, 3, C.gH), [17, 3, O])
  d.push([8, 4, O], ...rect(9, 4, 11, 4, C.gH), ...rect(12, 4, 16, 4, C.gM), [17, 4, C.gD], [18, 4, O])
  // Excited eye
  d.push([8, 5, O], [9, 5, C.gH], [10, 5, C.gM], [11, 5, O], [12, 5, O], [13, 5, O], [14, 5, O], [15, 5, C.gM], [16, 5, C.gD], [17, 5, C.gD], [18, 5, O])
  d.push([8, 6, O], [9, 6, C.gM], [10, 6, C.gM], [11, 6, O], [12, 6, C.eW], [13, 6, C.eI], [14, 6, O], [15, 6, C.gM], [16, 6, C.gD], [17, 6, C.gD], [18, 6, O])
  d.push([8, 7, O], [9, 7, C.gM], [10, 7, C.gM], [11, 7, O], [12, 7, C.eI], [13, 7, C.eP], [14, 7, O], [15, 7, C.gM], [16, 7, C.gD], [17, 7, C.gD], [18, 7, O])
  d.push([8, 8, O], [9, 8, C.gM], ...rect(10, 8, 16, 8, C.gD), [17, 8, C.gS], [18, 8, O])

  // Open mouth
  d.push([9, 9, O], ...rect(10, 9, 14, 9, C.gD), [15, 9, C.f3], [16, 9, C.f2], [17, 9, O])

  // Neck
  d.push([10, 10, O], ...rect(11, 10, 15, 10, C.gS), [16, 10, O])

  // Body
  d.push([7, 11, O], [8, 11, C.gD], [9, 11, C.gS], [10, 11, C.gS], [11, 11, C.bH], [12, 11, C.bM], [13, 11, C.bM], [14, 11, C.gS], [15, 11, C.gS], [16, 11, O])
  d.push([6, 12, O], [7, 12, C.gM], [8, 12, C.gD], [9, 12, C.gS], [10, 12, C.gS], [11, 12, C.bH], [12, 12, C.bM], [13, 12, C.bD], [14, 12, C.gS], [15, 12, C.gX], [16, 12, O])
  d.push([6, 13, O], [7, 13, C.gD], [8, 13, C.gS], [9, 13, C.gS], [10, 13, C.bM], [11, 13, C.bM], [12, 13, C.bD], [13, 13, C.bD], [14, 13, C.gX], [15, 13, C.gX], [16, 13, O])
  d.push([6, 14, O], [7, 14, C.gD], [8, 14, C.gS], [9, 14, C.gS], [10, 14, C.bD], [11, 14, C.bD], [12, 14, C.bD], [13, 14, C.gS], [14, 14, C.gX], [15, 14, C.gX], [16, 14, O])
  d.push([6, 15, O], [7, 15, C.gS], [8, 15, C.gS], [9, 15, C.gX], [10, 15, C.bD], [11, 15, C.bD], [12, 15, C.gS], [13, 15, C.gX], [14, 15, C.gX], [15, 15, C.gX], [16, 15, O])

  // Wings spread!
  if (wingFlap === 0) {
    d.push([2, 5, O], [3, 5, O], [4, 6, O], [5, 7, O], [6, 7, O])
    d.push([1, 6, O], [2, 6, C.wO], [3, 6, C.wO], [4, 7, C.wO], [5, 8, C.wO])
    d.push([0, 7, O], [1, 7, C.wO], [2, 7, C.wR], [3, 7, C.wR], [4, 8, C.wR], [5, 9, O])
    d.push([0, 8, O], [1, 8, C.wR], [2, 8, C.wR], [3, 8, O], [4, 9, O])
    d.push([1, 9, O], [2, 9, O])
  } else if (wingFlap === 1) {
    d.push([0, 9, O], [1, 9, O], [2, 9, O], [3, 9, O], [4, 9, O], [5, 9, O], [6, 9, O])
    d.push([0, 10, O], [1, 10, C.wO], [2, 10, C.wO], [3, 10, C.wO], [4, 10, C.wO], [5, 10, C.wR], [6, 10, O])
    d.push([0, 11, O], [1, 11, C.wR], [2, 11, C.wR], [3, 11, C.wR], [4, 11, C.wR], [5, 11, O])
    d.push([1, 12, O], [2, 12, O], [3, 12, O], [4, 12, O])
  } else {
    d.push([1, 12, O], [2, 12, O], [3, 12, O], [4, 12, O], [5, 12, O], [6, 12, O])
    d.push([0, 13, O], [1, 13, C.wO], [2, 13, C.wO], [3, 13, C.wR], [4, 13, C.wR], [5, 13, O])
    d.push([0, 14, O], [1, 14, C.wR], [2, 14, C.wR], [3, 14, O])
    d.push([1, 15, O], [2, 15, O])
  }

  // Legs dangling
  d.push([7, 16, O], [8, 16, C.gS], [9, 16, O])
  d.push([7, 17, O], [8, 17, C.gX], [9, 17, O])
  d.push([7, 18, O], [8, 18, C.gX], [9, 18, O])
  d.push([6, 19, C.hO], [7, 19, O], [8, 19, O], [9, 19, C.hO])

  d.push([13, 16, O], [14, 16, C.gX], [15, 16, O])
  d.push([13, 17, O], [14, 17, C.gX], [15, 17, O])
  d.push([13, 18, O], [14, 18, C.gX], [15, 18, O])
  d.push([12, 19, C.hO], [13, 19, O], [14, 19, O], [15, 19, C.hO])

  // Tail up
  d.push([5, 14, O], [6, 14, C.gD])
  d.push([4, 13, O], [5, 13, C.gS])
  d.push([3, 12, O], [4, 12, C.gX])
  d.push([2, 11, C.hO], [3, 11, O])

  // Fire breath
  if (fireFrame < 3) {
    d.push([18, 8, C.f1], [19, 8, C.f2], [20, 8, C.f3])
    d.push([18, 9, C.f2], [19, 9, C.f3], [20, 9, C.f4])
    if (fireFrame < 2) {
      d.push([21, 8, C.f4], [21, 9, C.f4])
      d.push([18, 7, C.f1], [19, 7, C.f2])
      d.push([18, 10, C.f2], [19, 10, C.f3])
    }
  }

  return d
}

function makePeekFrame(f: number): SpriteData {
  const blink = f % 16 < 2
  const O = C.O
  const d: SpriteData = []

  // Horns
  d.push([10, 0, C.hO], [11, 0, C.hR], [15, 0, C.hO], [16, 0, C.hR])

  // Head
  d.push([10, 1, O], [11, 1, O], ...rect(11, 2, 15, 2, O), [16, 1, O])
  d.push([9, 3, O], ...rect(10, 3, 16, 3, C.gH), [17, 3, O])
  d.push([8, 4, O], ...rect(9, 4, 11, 4, C.gH), ...rect(12, 4, 16, 4, C.gM), [17, 4, C.gD], [18, 4, O])
  if (!blink) {
    d.push([8, 5, O], [9, 5, C.gH], [10, 5, C.gM], [11, 5, O], [12, 5, O], [13, 5, O], [14, 5, O], [15, 5, C.gM], [16, 5, C.gD], [17, 5, C.gD], [18, 5, O])
    d.push([8, 6, O], [9, 6, C.gM], [10, 6, C.gM], [11, 6, O], [12, 6, C.eW], [13, 6, C.eI], [14, 6, O], [15, 6, C.gM], [16, 6, C.gD], [17, 6, C.gD], [18, 6, O])
    d.push([8, 7, O], [9, 7, C.gM], [10, 7, C.gM], [11, 7, O], [12, 7, C.eI], [13, 7, C.eP], [14, 7, O], [15, 7, C.gM], [16, 7, C.gD], [17, 7, C.gD], [18, 7, O])
  } else {
    d.push([8, 5, O], [9, 5, C.gH], ...rect(10, 5, 17, 5, C.gM), [18, 5, O])
    d.push([8, 6, O], ...rect(9, 6, 17, 6, C.gM), [18, 6, O])
    d.push([8, 7, O], ...rect(9, 7, 17, 7, C.gM), [18, 7, O])
  }
  d.push([8, 8, O], [9, 8, C.gM], ...rect(10, 8, 16, 8, C.gD), [17, 8, O])
  d.push([9, 9, O], ...rect(10, 9, 16, 9, O))

  // Claws gripping
  d.push([10, 10, O], [11, 10, C.gD], [12, 10, C.gS], [13, 10, C.gS], [14, 10, C.gX], [15, 10, O])
  d.push([10, 11, O], [11, 11, C.gS], [12, 11, C.gX], [13, 11, C.gX], [14, 11, C.gX], [15, 11, O])
  d.push([10, 12, C.hO], [11, 12, O], [12, 12, O], [13, 12, O], [14, 12, O], [15, 12, C.hO])

  return d
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

  let spriteData: SpriteData
  switch (state.value) {
    case 'idle': spriteData = makeIdleFrame(frame.value); break
    case 'walk': spriteData = makeWalkFrame(frame.value); break
    case 'sit': spriteData = makeSitFrame(frame.value); break
    case 'sleep': spriteData = makeSleepFrame(frame.value); break
    case 'jump': spriteData = makeJumpFrame(frame.value); break
    case 'dragged': spriteData = makeJumpFrame(frame.value); break
    case 'peek': spriteData = makePeekFrame(frame.value); break
  }

  drawSprite(ctx, spriteData)
  ctx.restore()
}

function findInteractiveTarget(): { el: Element; rect: DOMRect } | null {
  const candidates = [
    ...document.querySelectorAll('.card-tactile'),
    ...document.querySelectorAll('.fab-play'),
    ...document.querySelectorAll('[data-dragon-target]'),
  ]

  const vis = candidates.filter(el => {
    const r = el.getBoundingClientRect()
    return r.top < window.innerHeight && r.bottom > 0 && r.width > 0
  })

  if (vis.length === 0) return null
  const el = vis[Math.floor(Math.random() * vis.length)]
  return { el, rect: el.getBoundingClientRect() }
}

function pickNextAction() {
  const roll = Math.random()

  if (roll < 0.3) {
    state.value = 'walk'
    targetX.value = Math.random() * (window.innerWidth - W - 80) + 40
    targetEl.value = null
    stateTimer.value = 0
  } else if (roll < 0.55) {
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
    state.value = 'jump'
    isJumping.value = true
    jumpVY.value = -8
    stateTimer.value = 0
  } else if (roll < 0.85) {
    state.value = 'sleep'
    stateTimer.value = 200
  } else {
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

  if (frameCount % 6 === 0) {
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
            const rect = targetEl.value.getBoundingClientRect()
            state.value = 'sit'
            y.value = rect.top - H + 4
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
      if (stateTimer.value <= 0) pickNextAction()
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

    case 'dragged': {
      break
    }
  }

  x.value = Math.max(-10, Math.min(window.innerWidth - W + 10, x.value))
  render()
  tickId = requestAnimationFrame(tick)
}

function findDropTarget(): { el: Element; rect: DOMRect } | null {
  const dragonCenterX = x.value + W / 2
  const dragonBottom = y.value + H
  const candidates = [
    ...document.querySelectorAll('.card-tactile'),
    ...document.querySelectorAll('.fab-play'),
    ...document.querySelectorAll('[data-dragon-target]'),
  ]

  let best: { el: Element; rect: DOMRect; dist: number } | null = null
  const MAX_DIST = 200

  for (const el of candidates) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const elCenterX = r.left + r.width / 2
    const elTop = r.top
    const dx = dragonCenterX - elCenterX
    const dy = dragonBottom - elTop
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < MAX_DIST && (!best || dist < best.dist)) {
      best = { el, rect: r, dist }
    }
  }

  return best ? { el: best.el, rect: best.rect } : null
}

function getPointerPos(e: MouseEvent | TouchEvent): { px: number; py: number } {
  if ('touches' in e) {
    return { px: e.touches[0].clientX, py: e.touches[0].clientY }
  }
  return { px: e.clientX, py: e.clientY }
}

const DRAG_THRESHOLD = 5

function handleDragStart(e: MouseEvent | TouchEvent) {
  e.preventDefault()
  const { px, py } = getPointerPos(e)
  dragOffsetX.value = px - x.value
  dragOffsetY.value = py - y.value
  dragStartX.value = px
  dragStartY.value = py
  isDragging.value = true
  didDrag.value = false
  sittingOnEl.value = null
  window.addEventListener('mousemove', handleDragMove)
  window.addEventListener('mouseup', handleDragEnd)
  window.addEventListener('touchmove', handleDragMove, { passive: false })
  window.addEventListener('touchend', handleDragEnd)
}

function handleDragMove(e: MouseEvent | TouchEvent) {
  if (!isDragging.value) return
  e.preventDefault()
  const { px, py } = getPointerPos(e)

  if (!didDrag.value) {
    const dx = px - dragStartX.value
    const dy = py - dragStartY.value
    if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return
    didDrag.value = true
    state.value = 'dragged'
  }

  x.value = px - dragOffsetX.value
  y.value = py - dragOffsetY.value
}

function handleDragEnd() {
  if (!isDragging.value) return
  isDragging.value = false
  window.removeEventListener('mousemove', handleDragMove)
  window.removeEventListener('mouseup', handleDragEnd)
  window.removeEventListener('touchmove', handleDragMove)
  window.removeEventListener('touchend', handleDragEnd)

  if (!didDrag.value) {
    handleClick()
    return
  }

  const target = findDropTarget()
  if (target) {
    const rect = target.rect
    state.value = 'sit'
    x.value = rect.left + rect.width / 2 - W / 2
    y.value = rect.top - H + 4
    sittingOnEl.value = target.el
    stateTimer.value = 150 + Math.floor(Math.random() * 100)
  } else {
    state.value = 'jump'
    isJumping.value = true
    jumpVY.value = 0
  }
}

function handleClick() {
  if (state.value === 'sleep') {
    state.value = 'jump'
    isJumping.value = true
    jumpVY.value = -10
    y.value = FLOOR_Y()
    return
  }
  if (!isJumping.value && !isDragging.value) {
    state.value = 'jump'
    isJumping.value = true
    jumpVY.value = -10
  }
}

function handleResize() {
  if (!isDragging.value) y.value = FLOOR_Y()
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
  window.removeEventListener('mousemove', handleDragMove)
  window.removeEventListener('mouseup', handleDragEnd)
  window.removeEventListener('touchmove', handleDragMove)
  window.removeEventListener('touchend', handleDragEnd)
})

const style = computed(() => ({
  position: 'fixed' as const,
  left: `${x.value}px`,
  top: `${y.value}px`,
  zIndex: 9999,
  cursor: isDragging.value ? 'grabbing' : 'grab',
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
    @mousedown="handleDragStart"
    @touchstart="handleDragStart"
  />
</template>
