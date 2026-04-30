<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

const SCALE = 3
const SPRITE_W = 16
const SPRITE_H = 18
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

const canvas = ref<HTMLCanvasElement | null>(null)

// Colors sampled from reference image
const C = {
  outline: '#1a1020',
  bodyHi: '#78c850',     // bright green highlight
  body: '#58a840',        // main green
  bodyMid: '#3d9050',     // mid green shadow
  bodyDk: '#1a6040',      // deep teal shadow
  bodyDkr: '#0e3828',     // darkest shadow
  bellyHi: '#f0c848',     // yellow belly highlight
  belly: '#e8a830',       // orange belly
  bellyDk: '#c88020',     // belly shadow
  eyeWhite: '#ffffff',
  eyeIris: '#208060',     // teal-green iris
  eyePupil: '#1a1020',
  eyeShine: '#ffffff',
  wingOrange: '#d06030',  // wing outer
  wingRed: '#a02820',     // wing membrane
  wingDk: '#1a1020',      // wing outline
  hornBase: '#d06030',    // horn/claw orange-red
  hornTip: '#a02820',     // horn tip darker
  fire1: '#f0c848',
  fire2: '#e88030',
  fire3: '#d04030',
  fire4: '#a02820',
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

// Base idle sprite — matches the reference image pixel art dragon
// Sprite faces RIGHT. Canvas flip handles facingLeft.
// Grid: 16 wide x 18 tall (0-indexed)
function makeIdleFrame(f: number): SpriteData {
  const bob = f % 4 < 2 ? 0 : -1
  const blink = f % 24 < 2
  const tailWag = f % 6 < 3 ? 0 : 1
  const wingBob = f % 8 < 4 ? 0 : 1
  const b = bob
  const O = C.outline
  const d: SpriteData = []

  // === HORNS (two small horns on top of head) ===
  // Left horn
  d.push([7, 0+b, C.hornBase], [7, 1+b, O])
  d.push([8, 0+b, C.hornTip], [8, 1+b, C.hornBase])
  // Right horn
  d.push([10, 0+b, C.hornBase], [10, 1+b, O])
  d.push([11, 0+b, C.hornTip], [11, 1+b, C.hornBase])

  // === HEAD (big chibi head ~7x7) ===
  // Row 1+b (top of head)
  d.push([8, 1+b, O], [9, 1+b, O], [10, 1+b, O])
  // Row 2+b
  d.push([7, 2+b, O], [8, 2+b, C.bodyHi], [9, 2+b, C.bodyHi], [10, 2+b, C.bodyHi], [11, 2+b, O])
  // Row 3+b
  d.push([6, 3+b, O], [7, 3+b, C.bodyHi], [8, 3+b, C.bodyHi], [9, 3+b, C.body], [10, 3+b, C.body], [11, 3+b, C.body], [12, 3+b, O])
  // Row 4+b — eye row
  if (!blink) {
    d.push([6, 4+b, O], [7, 4+b, C.body], [8, 4+b, O], [9, 4+b, C.eyeIris], [10, 4+b, O], [11, 4+b, C.body], [12, 4+b, O])
    d.push([9, 3+b, C.eyeShine]) // shine pixel above iris
  } else {
    d.push([6, 4+b, O], [7, 4+b, C.body], [8, 4+b, C.body], [9, 4+b, O], [10, 4+b, C.body], [11, 4+b, C.body], [12, 4+b, O])
  }
  // Row 5+b
  d.push([6, 5+b, O], [7, 5+b, C.body], [8, 5+b, C.body], [9, 5+b, C.body], [10, 5+b, C.body], [11, 5+b, C.bodyMid], [12, 5+b, O])
  // Row 6+b (bottom of head, meets neck)
  d.push([7, 6+b, O], [8, 6+b, C.bodyMid], [9, 6+b, C.bodyMid], [10, 6+b, C.bodyMid], [11, 6+b, O])

  // === NECK / BODY ===
  // Row 7+b (neck connects to body, belly starts)
  d.push([5, 7+b, O], [6, 7+b, C.bodyMid], [7, 7+b, C.bodyDk], [8, 7+b, C.belly], [9, 7+b, C.belly], [10, 7+b, C.bodyDk], [11, 7+b, O])

  // === WING (behind body, to the left) ===
  const wy = wingBob
  d.push([2, 7+b-wy, O], [3, 6+b-wy, O], [4, 6+b-wy, O])
  d.push([1, 8+b-wy, O], [2, 8+b-wy, C.wingOrange], [3, 7+b-wy, C.wingOrange], [4, 7+b-wy, C.wingRed])
  d.push([1, 9+b-wy, O], [2, 9+b-wy, C.wingRed], [3, 8+b-wy, C.wingRed], [4, 8+b-wy, O])
  d.push([2, 10+b-wy, O], [3, 9+b-wy, O])

  // === BODY (main torso) ===
  // Row 8+b
  d.push([4, 8+b, O], [5, 8+b, C.body], [6, 8+b, C.bodyMid], [7, 8+b, C.bodyDk], [8, 8+b, C.bellyHi], [9, 8+b, C.belly], [10, 8+b, C.bodyDk], [11, 8+b, O])
  // Row 9+b
  d.push([4, 9+b, O], [5, 9+b, C.bodyMid], [6, 9+b, C.bodyDk], [7, 9+b, C.bodyDk], [8, 9+b, C.belly], [9, 9+b, C.bellyDk], [10, 9+b, C.bodyDk], [11, 9+b, O])
  // Row 10+b
  d.push([4, 10+b, O], [5, 10+b, C.bodyMid], [6, 10+b, C.bodyDk], [7, 10+b, C.bodyDk], [8, 10+b, C.bellyDk], [9, 10+b, C.bellyDk], [10, 10+b, C.bodyDkr], [11, 10+b, O])

  // === LEGS ===
  // Row 11+b (top of legs)
  d.push([4, 11+b, O], [5, 11+b, C.bodyMid], [6, 11+b, O], [7, 11+b, C.bodyDk], [8, 11+b, C.bodyDk], [9, 11+b, O], [10, 11+b, C.bodyDkr], [11, 11+b, O])
  // Row 12+b (legs)
  d.push([4, 12+b, O], [5, 12+b, C.bodyDk], [6, 12+b, O], [7, 12+b, C.bodyDk], [8, 12+b, C.bodyDkr], [9, 12+b, O], [10, 12+b, C.bodyDkr], [11, 12+b, O])
  // Row 13+b (feet)
  d.push([3, 13+b, O], [4, 13+b, C.hornBase], [5, 13+b, C.bodyDk], [6, 13+b, C.hornBase], [7, 13+b, O],
         [8, 13+b, O], [9, 13+b, C.hornBase], [10, 13+b, C.bodyDkr], [11, 13+b, C.hornBase], [12, 13+b, O])
  // Row 14+b (bottom of feet outlines)
  d.push([3, 14+b, O], [4, 14+b, O], [5, 14+b, O], [6, 14+b, O],
         [8, 14+b, O], [9, 14+b, O], [10, 14+b, O], [11, 14+b, O])

  // === TAIL (curling left from body base) ===
  const tw = tailWag
  d.push([3, 10+b+tw, O], [4, 10+b+tw, C.bodyMid])
  d.push([2, 11+b+tw, O], [3, 11+b+tw, C.bodyDk])
  d.push([1, 12+b+tw, O], [2, 12+b+tw, C.bodyDk])
  d.push([0, 13+b+tw, O], [1, 13+b+tw, C.bodyDkr])
  d.push([0, 14+b+tw, C.hornBase], [1, 14+b+tw, O])

  return d
}

function makeWalkFrame(f: number): SpriteData {
  const bob = f % 4 < 2 ? 0 : -1
  const blink = f % 24 < 2
  const tailWag = f % 4 < 2 ? 0 : 1
  const wingBob = f % 4 < 2 ? 0 : 1
  const b = bob
  const O = C.outline
  const d: SpriteData = []
  const step = f % 4

  // Reuse head, horns, body from idle (but rebuild for walk anim)
  // Horns
  d.push([7, 0+b, C.hornBase], [7, 1+b, O], [8, 0+b, C.hornTip], [8, 1+b, C.hornBase])
  d.push([10, 0+b, C.hornBase], [10, 1+b, O], [11, 0+b, C.hornTip], [11, 1+b, C.hornBase])

  // Head
  d.push([8, 1+b, O], [9, 1+b, O], [10, 1+b, O])
  d.push([7, 2+b, O], [8, 2+b, C.bodyHi], [9, 2+b, C.bodyHi], [10, 2+b, C.bodyHi], [11, 2+b, O])
  d.push([6, 3+b, O], [7, 3+b, C.bodyHi], [8, 3+b, C.bodyHi], [9, 3+b, C.body], [10, 3+b, C.body], [11, 3+b, C.body], [12, 3+b, O])
  if (!blink) {
    d.push([6, 4+b, O], [7, 4+b, C.body], [8, 4+b, O], [9, 4+b, C.eyeIris], [10, 4+b, O], [11, 4+b, C.body], [12, 4+b, O])
    d.push([9, 3+b, C.eyeShine])
  } else {
    d.push([6, 4+b, O], [7, 4+b, C.body], [8, 4+b, C.body], [9, 4+b, O], [10, 4+b, C.body], [11, 4+b, C.body], [12, 4+b, O])
  }
  d.push([6, 5+b, O], [7, 5+b, C.body], [8, 5+b, C.body], [9, 5+b, C.body], [10, 5+b, C.body], [11, 5+b, C.bodyMid], [12, 5+b, O])
  d.push([7, 6+b, O], [8, 6+b, C.bodyMid], [9, 6+b, C.bodyMid], [10, 6+b, C.bodyMid], [11, 6+b, O])

  // Neck
  d.push([5, 7+b, O], [6, 7+b, C.bodyMid], [7, 7+b, C.bodyDk], [8, 7+b, C.belly], [9, 7+b, C.belly], [10, 7+b, C.bodyDk], [11, 7+b, O])

  // Wing
  const wy = wingBob
  d.push([2, 7+b-wy, O], [3, 6+b-wy, O], [4, 6+b-wy, O])
  d.push([1, 8+b-wy, O], [2, 8+b-wy, C.wingOrange], [3, 7+b-wy, C.wingOrange], [4, 7+b-wy, C.wingRed])
  d.push([1, 9+b-wy, O], [2, 9+b-wy, C.wingRed], [3, 8+b-wy, C.wingRed], [4, 8+b-wy, O])
  d.push([2, 10+b-wy, O], [3, 9+b-wy, O])

  // Body
  d.push([4, 8+b, O], [5, 8+b, C.body], [6, 8+b, C.bodyMid], [7, 8+b, C.bodyDk], [8, 8+b, C.bellyHi], [9, 8+b, C.belly], [10, 8+b, C.bodyDk], [11, 8+b, O])
  d.push([4, 9+b, O], [5, 9+b, C.bodyMid], [6, 9+b, C.bodyDk], [7, 9+b, C.bodyDk], [8, 9+b, C.belly], [9, 9+b, C.bellyDk], [10, 9+b, C.bodyDk], [11, 9+b, O])
  d.push([4, 10+b, O], [5, 10+b, C.bodyMid], [6, 10+b, C.bodyDk], [7, 10+b, C.bodyDk], [8, 10+b, C.bellyDk], [9, 10+b, C.bellyDk], [10, 10+b, C.bodyDkr], [11, 10+b, O])

  // Walking legs — alternate front/back
  if (step < 2) {
    // Front leg forward, back leg back
    d.push([4, 11+b, O], [5, 11+b, C.bodyMid], [6, 11+b, O])
    d.push([3, 12+b, O], [4, 12+b, C.bodyDk], [5, 12+b, C.bodyDk], [6, 12+b, O])
    d.push([3, 13+b, C.hornBase], [4, 13+b, O], [5, 13+b, O])

    d.push([8, 11+b, O], [9, 11+b, C.bodyDk], [10, 11+b, C.bodyDkr], [11, 11+b, O])
    d.push([9, 12+b, O], [10, 12+b, C.bodyDkr], [11, 12+b, O])
    d.push([9, 13+b, O], [10, 13+b, C.hornBase], [11, 13+b, C.bodyDkr], [12, 13+b, O])
    d.push([9, 14+b, O], [10, 14+b, O], [11, 14+b, O])
  } else {
    // Front leg back, back leg forward
    d.push([5, 11+b, O], [6, 11+b, C.bodyMid], [7, 11+b, O])
    d.push([5, 12+b, O], [6, 12+b, C.bodyDk], [7, 12+b, O])
    d.push([5, 13+b, O], [6, 13+b, C.hornBase], [7, 13+b, O])
    d.push([5, 14+b, O], [6, 14+b, O])

    d.push([8, 11+b, O], [9, 11+b, O], [10, 11+b, C.bodyDkr], [11, 11+b, O])
    d.push([8, 12+b, O], [9, 12+b, C.hornBase], [10, 12+b, C.bodyDkr], [11, 12+b, C.hornBase], [12, 12+b, O])
    d.push([8, 13+b, O], [9, 13+b, O], [10, 13+b, O], [11, 13+b, O])
  }

  // Tail
  const tw = tailWag
  d.push([3, 10+b+tw, O], [4, 10+b+tw, C.bodyMid])
  d.push([2, 11+b+tw, O], [3, 11+b+tw, C.bodyDk])
  d.push([1, 12+b+tw, O], [2, 12+b+tw, C.bodyDk])
  d.push([0, 13+b+tw, O], [1, 13+b+tw, C.bodyDkr])
  d.push([0, 14+b+tw, C.hornBase], [1, 14+b+tw, O])

  return d
}

function makeSitFrame(f: number): SpriteData {
  const tailWag = f % 6 < 3 ? 0 : 1
  const blink = f % 20 < 2
  const O = C.outline
  const d: SpriteData = []

  // Horns
  d.push([7, 3, C.hornBase], [7, 4, O], [8, 3, C.hornTip], [8, 4, C.hornBase])
  d.push([10, 3, C.hornBase], [10, 4, O], [11, 3, C.hornTip], [11, 4, C.hornBase])

  // Head (lowered for sitting)
  d.push([8, 4, O], [9, 4, O], [10, 4, O])
  d.push([7, 5, O], [8, 5, C.bodyHi], [9, 5, C.bodyHi], [10, 5, C.bodyHi], [11, 5, O])
  d.push([6, 6, O], [7, 6, C.bodyHi], [8, 6, C.bodyHi], [9, 6, C.body], [10, 6, C.body], [11, 6, C.body], [12, 6, O])
  if (!blink) {
    d.push([6, 7, O], [7, 7, C.body], [8, 7, O], [9, 7, C.eyeIris], [10, 7, O], [11, 7, C.body], [12, 7, O])
    d.push([9, 6, C.eyeShine])
  } else {
    d.push([6, 7, O], [7, 7, C.body], [8, 7, C.body], [9, 7, O], [10, 7, C.body], [11, 7, C.body], [12, 7, O])
  }
  d.push([6, 8, O], [7, 8, C.body], [8, 8, C.body], [9, 8, C.body], [10, 8, C.body], [11, 8, C.bodyMid], [12, 8, O])
  d.push([7, 9, O], [8, 9, C.bodyMid], [9, 9, C.bodyMid], [10, 9, C.bodyMid], [11, 9, O])

  // Neck + body (compressed for sitting)
  d.push([5, 10, O], [6, 10, C.bodyMid], [7, 10, C.bodyDk], [8, 10, C.belly], [9, 10, C.belly], [10, 10, C.bodyDk], [11, 10, O])
  d.push([5, 11, O], [6, 11, C.bodyMid], [7, 11, C.bodyDk], [8, 11, C.bellyHi], [9, 11, C.belly], [10, 11, C.bodyDk], [11, 11, O])
  d.push([5, 12, O], [6, 12, C.bodyDk], [7, 12, C.bodyDk], [8, 12, C.belly], [9, 12, C.bellyDk], [10, 12, C.bodyDkr], [11, 12, O])

  // Wing (folded)
  d.push([3, 9, O], [4, 9, O])
  d.push([2, 10, O], [3, 10, C.wingOrange], [4, 10, C.wingRed])
  d.push([2, 11, O], [3, 11, C.wingRed], [4, 11, O])
  d.push([3, 12, O])

  // Tucked legs (sitting)
  d.push([5, 13, O], [6, 13, C.hornBase], [7, 13, C.bodyDk], [8, 13, C.bodyDk], [9, 13, C.hornBase], [10, 13, C.bodyDkr], [11, 13, O])
  d.push([5, 14, O], [6, 14, O], [7, 14, O], [8, 14, O], [9, 14, O], [10, 14, O], [11, 14, O])

  // Tail
  d.push([3, 12+tailWag, O], [4, 12+tailWag, C.bodyMid])
  d.push([2, 13+tailWag, O], [3, 13+tailWag, C.bodyDk])
  d.push([1, 14+tailWag, O], [2, 14+tailWag, C.bodyDkr])
  d.push([0, 15+tailWag, C.hornBase], [1, 15+tailWag, O])

  return d
}

function makeSleepFrame(f: number): SpriteData {
  const breathe = f % 12 < 6 ? 0 : 1
  const zPhase = Math.floor(f / 8) % 4
  const O = C.outline
  const d: SpriteData = []

  // Curled up body blob
  // Body
  d.push([4, 10+breathe, O], [5, 10+breathe, O], [6, 10+breathe, O], [7, 10+breathe, O], [8, 10+breathe, O], [9, 10+breathe, O], [10, 10+breathe, O], [11, 10+breathe, O])
  d.push([3, 11+breathe, O], [4, 11+breathe, C.body], [5, 11+breathe, C.bodyMid], [6, 11+breathe, C.bodyDk], [7, 11+breathe, C.belly], [8, 11+breathe, C.belly], [9, 11+breathe, C.bodyDk], [10, 11+breathe, C.bodyDk], [11, 11+breathe, O])
  d.push([3, 12+breathe, O], [4, 12+breathe, C.bodyMid], [5, 12+breathe, C.bodyDk], [6, 12+breathe, C.bodyDk], [7, 12+breathe, C.bellyDk], [8, 12+breathe, C.bellyDk], [9, 12+breathe, C.bodyDkr], [10, 12+breathe, C.bodyDkr], [11, 12+breathe, O])
  d.push([3, 13+breathe, O], [4, 13+breathe, O], [5, 13+breathe, O], [6, 13+breathe, O], [7, 13+breathe, O], [8, 13+breathe, O], [9, 13+breathe, O], [10, 13+breathe, O], [11, 13+breathe, O])

  // Head (resting, eyes closed)
  d.push([5, 8+breathe, O], [6, 8+breathe, O], [7, 8+breathe, O], [8, 8+breathe, O], [9, 8+breathe, O])
  d.push([4, 9+breathe, O], [5, 9+breathe, C.bodyHi], [6, 9+breathe, C.body], [7, 9+breathe, C.body], [8, 9+breathe, C.body], [9, 9+breathe, O])
  d.push([4, 10+breathe, O], [5, 10+breathe, C.body], [6, 10+breathe, O], [7, 10+breathe, O], [8, 10+breathe, C.bodyMid], [9, 10+breathe, O])

  // Horn (one visible)
  d.push([5, 7+breathe, C.hornBase], [6, 7+breathe, C.hornTip])

  // Wing draped over body
  d.push([7, 10+breathe, C.wingOrange], [8, 10+breathe, C.wingRed], [9, 10+breathe, C.wingRed], [10, 10+breathe, C.wingOrange])

  // Tail curled
  d.push([11, 12+breathe, C.bodyDk], [12, 11+breathe, O], [12, 12+breathe, C.bodyDkr])
  d.push([13, 12+breathe, C.hornBase], [13, 11+breathe, O])

  // Paw visible
  d.push([3, 12+breathe, C.hornBase], [4, 13+breathe, C.hornBase])

  // Z's
  const zc = C.bellyHi
  if (zPhase >= 1) d.push([3, 6+breathe, zc], [4, 6+breathe, zc], [4, 7+breathe, zc], [3, 7+breathe, zc])
  if (zPhase >= 2) d.push([2, 4+breathe, zc], [3, 4+breathe, zc], [2, 5+breathe, zc])
  if (zPhase >= 3) d.push([1, 2+breathe, zc], [2, 2+breathe, zc], [1, 3+breathe, zc])

  return d
}

function makeJumpFrame(f: number): SpriteData {
  const wingFlap = f % 3
  const fireFrame = f % 4
  const O = C.outline
  const d: SpriteData = []

  // Horns
  d.push([7, 0, C.hornBase], [7, 1, O], [8, 0, C.hornTip], [8, 1, C.hornBase])
  d.push([10, 0, C.hornBase], [10, 1, O], [11, 0, C.hornTip], [11, 1, C.hornBase])

  // Head
  d.push([8, 1, O], [9, 1, O], [10, 1, O])
  d.push([7, 2, O], [8, 2, C.bodyHi], [9, 2, C.bodyHi], [10, 2, C.bodyHi], [11, 2, O])
  d.push([6, 3, O], [7, 3, C.bodyHi], [8, 3, C.bodyHi], [9, 3, C.body], [10, 3, C.body], [11, 3, C.body], [12, 3, O])
  // Excited wide eye
  d.push([6, 4, O], [7, 4, C.body], [8, 4, O], [9, 4, C.eyeIris], [10, 4, O], [11, 4, C.body], [12, 4, O])
  d.push([9, 3, C.eyeShine])
  d.push([6, 5, O], [7, 5, C.body], [8, 5, C.body], [9, 5, C.body], [10, 5, C.body], [11, 5, C.bodyMid], [12, 5, O])

  // Open mouth for fire
  d.push([7, 6, O], [8, 6, C.bodyMid], [9, 6, C.fire3], [10, 6, C.fire2], [11, 6, O])

  // Body
  d.push([5, 7, O], [6, 7, C.bodyMid], [7, 7, C.bodyDk], [8, 7, C.belly], [9, 7, C.belly], [10, 7, C.bodyDk], [11, 7, O])
  d.push([4, 8, O], [5, 8, C.body], [6, 8, C.bodyMid], [7, 8, C.bodyDk], [8, 8, C.bellyHi], [9, 8, C.belly], [10, 8, C.bodyDk], [11, 8, O])
  d.push([4, 9, O], [5, 9, C.bodyMid], [6, 9, C.bodyDk], [7, 9, C.bodyDk], [8, 9, C.belly], [9, 9, C.bellyDk], [10, 9, C.bodyDk], [11, 9, O])
  d.push([4, 10, O], [5, 10, C.bodyMid], [6, 10, C.bodyDk], [7, 10, C.bodyDk], [8, 10, C.bellyDk], [9, 10, C.bellyDk], [10, 10, C.bodyDkr], [11, 10, O])

  // Wings spread!
  if (wingFlap === 0) {
    // Up
    d.push([1, 3, O], [2, 3, O], [3, 4, O], [4, 5, O])
    d.push([0, 4, O], [1, 4, C.wingOrange], [2, 4, C.wingOrange], [3, 5, C.wingOrange], [4, 6, C.wingRed])
    d.push([0, 5, O], [1, 5, C.wingRed], [2, 5, C.wingRed], [3, 6, C.wingRed])
    d.push([1, 6, O], [2, 6, O])
  } else if (wingFlap === 1) {
    // Mid
    d.push([0, 6, O], [1, 6, O], [2, 6, O], [3, 6, O], [4, 6, O])
    d.push([0, 7, O], [1, 7, C.wingOrange], [2, 7, C.wingOrange], [3, 7, C.wingOrange], [4, 7, C.wingRed])
    d.push([0, 8, O], [1, 8, C.wingRed], [2, 8, C.wingRed], [3, 8, C.wingRed], [4, 8, O])
    d.push([1, 9, O], [2, 9, O], [3, 9, O])
  } else {
    // Down
    d.push([1, 8, O], [2, 8, O], [3, 8, O], [4, 8, O])
    d.push([0, 9, O], [1, 9, C.wingOrange], [2, 9, C.wingOrange], [3, 9, C.wingRed], [4, 9, O])
    d.push([0, 10, O], [1, 10, C.wingRed], [2, 10, C.wingRed], [3, 10, O])
    d.push([1, 11, O], [2, 11, O])
  }

  // Legs stretched down
  d.push([5, 11, O], [6, 11, C.bodyDk], [7, 11, O])
  d.push([5, 12, O], [6, 12, C.bodyDk], [7, 12, O])
  d.push([5, 13, C.hornBase], [6, 13, O], [7, 13, O])

  d.push([9, 11, O], [10, 11, C.bodyDkr], [11, 11, O])
  d.push([9, 12, O], [10, 12, C.bodyDkr], [11, 12, O])
  d.push([9, 13, O], [10, 13, C.hornBase], [11, 13, O])

  // Tail up
  d.push([3, 9, O], [4, 9, C.bodyMid])
  d.push([2, 8, O], [3, 8, C.bodyDk])
  d.push([1, 7, C.hornBase], [2, 7, O])

  // Fire breath
  if (fireFrame < 3) {
    d.push([12, 5, C.fire1], [13, 5, C.fire2], [14, 5, C.fire3])
    d.push([12, 6, C.fire2], [13, 6, C.fire3], [14, 6, C.fire4])
    if (fireFrame < 2) {
      d.push([15, 5, C.fire4], [15, 6, C.fire4])
      d.push([12, 4, C.fire1], [13, 4, C.fire2])
    }
  }

  return d
}

function makePeekFrame(f: number): SpriteData {
  const blink = f % 16 < 2
  const O = C.outline
  const d: SpriteData = []

  // Just head + claw peeking from edge
  // Horns
  d.push([7, 0, C.hornBase], [8, 0, C.hornTip])
  d.push([10, 0, C.hornBase], [11, 0, C.hornTip])

  // Head
  d.push([7, 1, O], [8, 1, O], [9, 1, O], [10, 1, O], [11, 1, O])
  d.push([6, 2, O], [7, 2, C.bodyHi], [8, 2, C.bodyHi], [9, 2, C.bodyHi], [10, 2, C.bodyHi], [11, 2, O])
  d.push([6, 3, O], [7, 3, C.bodyHi], [8, 3, C.body], [9, 3, C.body], [10, 3, C.body], [11, 3, C.body], [12, 3, O])
  if (!blink) {
    d.push([6, 4, O], [7, 4, C.body], [8, 4, O], [9, 4, C.eyeIris], [10, 4, O], [11, 4, C.body], [12, 4, O])
    d.push([9, 3, C.eyeShine])
  } else {
    d.push([6, 4, O], [7, 4, C.body], [8, 4, C.body], [9, 4, O], [10, 4, C.body], [11, 4, C.body], [12, 4, O])
  }
  d.push([6, 5, O], [7, 5, C.body], [8, 5, C.body], [9, 5, C.body], [10, 5, C.bodyMid], [11, 5, C.bodyMid], [12, 5, O])
  d.push([7, 6, O], [8, 6, O], [9, 6, O], [10, 6, O], [11, 6, O])

  // Claws gripping edge
  d.push([8, 7, O], [9, 7, C.bodyMid], [10, 7, C.bodyDk], [11, 7, O])
  d.push([8, 8, O], [9, 8, C.bodyDk], [10, 8, C.bodyDkr], [11, 8, O])
  d.push([8, 9, C.hornBase], [9, 9, O], [10, 9, O], [11, 9, C.hornBase])

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
  }

  x.value = Math.max(-10, Math.min(window.innerWidth - W + 10, x.value))
  render()
  tickId = requestAnimationFrame(tick)
}

function handleClick() {
  if (state.value === 'sleep') {
    state.value = 'jump'
    isJumping.value = true
    jumpVY.value = -10
    y.value = FLOOR_Y()
    return
  }
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
