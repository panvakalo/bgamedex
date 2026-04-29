<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

const SCALE = 2
const SPRITE_W = 32
const SPRITE_H = 32
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

const C = {
  bodyHi: '#6ae878',
  body: '#38c848',
  bodyMid: '#28a038',
  bodyDk: '#187828',
  bodyDkr: '#105818',
  bellyHi: '#fff8e0',
  belly: '#f0dca0',
  bellyDk: '#d8b870',
  eyeWhite: '#ffffff',
  eyeIris: '#c02020',
  eyePupil: '#280808',
  eyeShine: '#ffffff',
  hornHi: '#ffe870',
  horn: '#f0c030',
  hornDk: '#c89818',
  wingHi: '#78d0f8',
  wing: '#48a8e0',
  wingMid: '#3080b8',
  wingDk: '#205888',
  wingMem: '#60c0f0',
  wingMemDk: '#3898c8',
  clawHi: '#fff0d0',
  claw: '#e8d0a0',
  clawDk: '#c0a060',
  fire1: '#fff870',
  fire2: '#f8a830',
  fire3: '#e84020',
  fire4: '#a02010',
  noseDk: '#105818',
  cheek: '#f08080',
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

function makeIdleFrame(f: number): SpriteData {
  const bob = f % 4 < 2 ? 0 : -1
  const blink = f % 24 < 2
  const tailWag = f % 6 < 3 ? 0 : 1
  const wingBob = f % 8 < 4 ? 0 : 1
  const b = bob
  const d: SpriteData = []

  // Horns
  d.push([13, 4+b, C.hornHi], [14, 3+b, C.horn], [14, 4+b, C.horn], [15, 2+b, C.hornHi], [15, 3+b, C.horn])
  d.push([17, 4+b, C.hornHi], [18, 3+b, C.horn], [18, 4+b, C.horn], [19, 2+b, C.hornHi], [19, 3+b, C.horn])

  // Head
  for (let hx = 8; hx <= 20; hx++)
    for (let hy = 5+b; hy <= 14+b; hy++) {
      if (hx < 10 && hy < 7+b) continue
      if (hx > 19 && hy < 7+b) continue
      if (hx < 9 && hy > 12+b) continue
      d.push([hx, hy, C.body])
    }
  // Head highlight
  for (let hx = 10; hx <= 18; hx++)
    d.push([hx, 5+b, C.bodyHi])
  for (let hx = 9; hx <= 11; hx++)
    d.push([hx, 6+b, C.bodyHi])

  // Snout
  for (let sx = 5; sx <= 9; sx++)
    for (let sy = 9+b; sy <= 13+b; sy++)
      d.push([sx, sy, C.body])
  d.push([5, 9+b, C.bodyHi], [6, 9+b, C.bodyHi], [5, 10+b, C.bodyHi])
  d.push([5, 12+b, C.bodyMid], [5, 13+b, C.bodyDk], [6, 13+b, C.bodyDk])
  // Nostrils
  d.push([6, 10+b, C.noseDk], [6, 11+b, C.noseDk])
  // Mouth line
  for (let mx = 7; mx <= 9; mx++)
    d.push([mx, 13+b, C.bodyDk])

  // Eye
  if (!blink) {
    for (let ex = 11; ex <= 14; ex++)
      for (let ey = 8+b; ey <= 11+b; ey++)
        d.push([ex, ey, C.eyeWhite])
    d.push([12, 9+b, C.eyeIris], [13, 9+b, C.eyeIris], [12, 10+b, C.eyeIris], [13, 10+b, C.eyeIris])
    d.push([13, 9+b, C.eyePupil], [13, 10+b, C.eyePupil])
    d.push([12, 9+b, C.eyeShine])
    // Brow
    d.push([11, 7+b, C.bodyDk], [12, 7+b, C.bodyDk], [13, 7+b, C.bodyDk], [14, 7+b, C.bodyDk])
  } else {
    d.push([11, 9+b, C.bodyDk], [12, 9+b, C.bodyDk], [13, 9+b, C.bodyDk], [14, 9+b, C.bodyDk])
  }

  // Cheek
  d.push([9, 11+b, C.cheek], [9, 12+b, C.cheek])

  // Head bottom shadow
  for (let hx = 10; hx <= 19; hx++)
    d.push([hx, 14+b, C.bodyDk])

  // Body
  for (let bx = 10; bx <= 22; bx++)
    for (let by = 14+b; by <= 24+b; by++) {
      if (bx > 21 && by < 16+b) continue
      if (bx > 22 && by > 23+b) continue
      d.push([bx, by, C.body])
    }
  // Body highlight
  for (let bx = 10; bx <= 14; bx++)
    d.push([bx, 15+b, C.bodyHi])
  // Body shadow
  for (let bx = 18; bx <= 22; bx++)
    d.push([bx, 24+b, C.bodyDk])

  // Belly
  for (let bx = 11; bx <= 17; bx++)
    for (let by = 19+b; by <= 24+b; by++)
      d.push([bx, by, C.belly])
  for (let bx = 12; bx <= 16; bx++)
    d.push([bx, 19+b, C.bellyHi])
  for (let bx = 11; bx <= 17; bx++)
    d.push([bx, 24+b, C.bellyDk])
  // Belly lines
  d.push([13, 21+b, C.bellyDk], [15, 21+b, C.bellyDk])
  d.push([13, 23+b, C.bellyDk], [15, 23+b, C.bellyDk])

  // Wing
  const wy = wingBob
  d.push([20, 12+b-wy, C.wingHi], [21, 11+b-wy, C.wingHi], [22, 10+b-wy, C.wing])
  d.push([23, 9+b-wy, C.wing], [24, 9+b-wy, C.wing], [25, 10+b-wy, C.wingMid])
  d.push([21, 12+b-wy, C.wing], [22, 11+b-wy, C.wing], [23, 11+b-wy, C.wingMid])
  d.push([24, 11+b-wy, C.wingMid], [25, 11+b-wy, C.wingDk])
  // Wing membrane
  d.push([22, 12+b-wy, C.wingMem], [23, 12+b-wy, C.wingMem], [24, 12+b-wy, C.wingMemDk])
  d.push([23, 13+b-wy, C.wingMemDk], [24, 13+b-wy, C.wingDk])
  // Wing bone highlight
  d.push([21, 10+b-wy, C.wingHi])

  // Tail
  d.push([22, 22+b, C.body], [23, 21+b+tailWag, C.body], [24, 20+b+tailWag, C.bodyMid])
  d.push([25, 19+b+tailWag, C.bodyMid], [26, 18+b+tailWag, C.bodyDk], [27, 17+b+tailWag, C.bodyDk])
  d.push([28, 17+b+tailWag, C.hornDk])
  // Tail spade
  d.push([28, 16+b+tailWag, C.horn], [29, 16+b+tailWag, C.horn], [29, 17+b+tailWag, C.hornDk])
  d.push([28, 18+b+tailWag, C.horn], [29, 18+b+tailWag, C.hornDk])

  // Front legs
  for (let ly = 24+b; ly <= 28+b; ly++) {
    d.push([12, ly, C.bodyMid], [13, ly, C.body], [14, ly, C.bodyMid])
  }
  d.push([12, 25+b, C.bodyHi], [13, 25+b, C.bodyHi])
  // Front foot
  d.push([11, 29+b, C.clawHi], [12, 29+b, C.claw], [13, 29+b, C.claw], [14, 29+b, C.claw], [15, 29+b, C.clawDk])
  d.push([11, 28+b, C.claw], [15, 28+b, C.clawDk])
  // Claws
  d.push([10, 29+b, C.clawDk], [15, 30+b, C.clawDk])

  // Back legs
  for (let ly = 23+b; ly <= 28+b; ly++) {
    d.push([18, ly, C.bodyDk], [19, ly, C.bodyMid], [20, ly, C.bodyDk])
  }
  // Thigh (thicker)
  d.push([17, 23+b, C.bodyMid], [21, 23+b, C.bodyDk])
  d.push([17, 24+b, C.bodyMid], [21, 24+b, C.bodyDk])
  // Back foot
  d.push([17, 29+b, C.clawHi], [18, 29+b, C.claw], [19, 29+b, C.claw], [20, 29+b, C.claw], [21, 29+b, C.clawDk])
  d.push([17, 28+b, C.claw], [21, 28+b, C.clawDk])
  d.push([16, 29+b, C.clawDk], [21, 30+b, C.clawDk])

  // Spines along back
  d.push([16, 4+b, C.hornHi])
  d.push([15, 14+b, C.horn], [17, 14+b, C.horn])
  d.push([16, 13+b, C.hornHi], [16, 14+b, C.horn])
  d.push([19, 16+b, C.horn], [19, 15+b, C.hornHi])

  return d
}

function makeWalkFrame(f: number): SpriteData {
  const d = makeIdleFrame(f)
  const b = f % 4 < 2 ? 0 : -1
  const step = f % 4

  // Override legs with walking animation
  // Remove idle leg pixels by overdrawing
  const legOverride: SpriteData = []

  if (step < 2) {
    // Front leg forward, back leg back
    for (let ly = 24+b; ly <= 27+b; ly++) {
      legOverride.push([11, ly, C.bodyMid], [12, ly, C.body], [13, ly, C.bodyMid])
    }
    legOverride.push([10, 28+b, C.clawHi], [11, 28+b, C.claw], [12, 28+b, C.claw], [13, 28+b, C.claw])
    legOverride.push([9, 28+b, C.clawDk], [13, 29+b, C.clawDk])

    for (let ly = 23+b; ly <= 27+b; ly++) {
      legOverride.push([19, ly, C.bodyDk], [20, ly, C.bodyMid], [21, ly, C.bodyDk])
    }
    legOverride.push([19, 28+b, C.clawHi], [20, 28+b, C.claw], [21, 28+b, C.claw], [22, 28+b, C.clawDk])
  } else {
    // Front leg back, back leg forward
    for (let ly = 24+b; ly <= 27+b; ly++) {
      legOverride.push([13, ly, C.bodyMid], [14, ly, C.body], [15, ly, C.bodyMid])
    }
    legOverride.push([13, 28+b, C.clawHi], [14, 28+b, C.claw], [15, 28+b, C.claw], [16, 28+b, C.clawDk])
    legOverride.push([12, 28+b, C.clawDk], [16, 29+b, C.clawDk])

    for (let ly = 23+b; ly <= 27+b; ly++) {
      legOverride.push([17, ly, C.bodyDk], [18, ly, C.bodyMid], [19, ly, C.bodyDk])
    }
    legOverride.push([16, 28+b, C.clawHi], [17, 28+b, C.claw], [18, 28+b, C.claw], [19, 28+b, C.claw])
    legOverride.push([15, 28+b, C.clawDk], [19, 29+b, C.clawDk])
  }

  return [...d, ...legOverride]
}

function makeSitFrame(f: number): SpriteData {
  const tailWag = f % 6 < 3 ? 0 : 1
  const blink = f % 20 < 2
  const d: SpriteData = []

  // Horns (lowered position)
  d.push([13, 8, C.hornHi], [14, 7, C.horn], [14, 8, C.horn], [15, 6, C.hornHi])
  d.push([17, 8, C.hornHi], [18, 7, C.horn], [18, 8, C.horn], [19, 6, C.hornHi])

  // Head
  for (let hx = 8; hx <= 20; hx++)
    for (let hy = 9; hy <= 18; hy++) {
      if (hx < 10 && hy < 11) continue
      if (hx > 19 && hy < 11) continue
      d.push([hx, hy, C.body])
    }
  for (let hx = 10; hx <= 18; hx++) d.push([hx, 9, C.bodyHi])

  // Snout
  for (let sx = 5; sx <= 9; sx++)
    for (let sy = 13; sy <= 17; sy++)
      d.push([sx, sy, C.body])
  d.push([5, 13, C.bodyHi], [6, 13, C.bodyHi])
  d.push([6, 14, C.noseDk], [6, 15, C.noseDk])

  // Happy eyes (squinting)
  if (!blink) {
    d.push([11, 12, C.eyeWhite], [12, 12, C.eyeWhite], [13, 12, C.eyeWhite], [14, 12, C.eyeWhite])
    d.push([11, 13, C.eyeWhite], [12, 13, C.eyeIris], [13, 13, C.eyePupil], [14, 13, C.eyeWhite])
    d.push([12, 12, C.eyeShine])
    // Happy brow
    d.push([11, 11, C.bodyDk], [14, 11, C.bodyDk])
  } else {
    d.push([11, 13, C.bodyDk], [12, 13, C.bodyDk], [13, 13, C.bodyDk], [14, 13, C.bodyDk])
  }
  d.push([9, 15, C.cheek], [9, 16, C.cheek])

  // Body (sitting — compressed)
  for (let bx = 10; bx <= 22; bx++)
    for (let by = 18; by <= 27; by++)
      d.push([bx, by, C.body])
  // Belly
  for (let bx = 11; bx <= 17; bx++)
    for (let by = 22; by <= 27; by++)
      d.push([bx, by, C.belly])
  for (let bx = 12; bx <= 16; bx++) d.push([bx, 22, C.bellyHi])

  // Wing (folded)
  d.push([20, 16, C.wingHi], [21, 15, C.wing], [22, 15, C.wingMid])
  d.push([21, 16, C.wing], [22, 16, C.wingMid], [23, 16, C.wingDk])
  d.push([22, 17, C.wingMemDk], [23, 17, C.wingDk])

  // Tail (wagging)
  d.push([22, 25, C.body], [23, 24+tailWag, C.body], [24, 23+tailWag, C.bodyMid])
  d.push([25, 22+tailWag, C.bodyMid], [26, 21+tailWag, C.bodyDk])
  d.push([27, 20+tailWag, C.horn], [27, 21+tailWag, C.hornDk], [28, 20+tailWag, C.horn])

  // Legs (tucked)
  d.push([12, 28, C.claw], [13, 28, C.claw], [14, 28, C.claw])
  d.push([11, 29, C.clawHi], [12, 29, C.claw], [13, 29, C.claw], [14, 29, C.claw], [15, 29, C.clawDk])
  d.push([18, 28, C.claw], [19, 28, C.claw], [20, 28, C.claw])
  d.push([17, 29, C.clawHi], [18, 29, C.claw], [19, 29, C.claw], [20, 29, C.claw], [21, 29, C.clawDk])

  // Spines
  d.push([16, 8, C.hornHi])
  d.push([16, 17, C.horn], [18, 17, C.horn])

  return d
}

function makeSleepFrame(f: number): SpriteData {
  const breathe = f % 12 < 6 ? 0 : 1
  const zPhase = Math.floor(f / 8) % 4
  const d: SpriteData = []

  // Curled body
  for (let bx = 8; bx <= 24; bx++)
    for (let by = 20+breathe; by <= 28; by++) {
      if (bx < 10 && by < 22+breathe) continue
      if (bx > 23 && by < 22+breathe) continue
      d.push([bx, by, C.body])
    }
  // Belly showing
  for (let bx = 12; bx <= 18; bx++)
    for (let by = 24; by <= 28; by++)
      d.push([bx, by, C.belly])

  // Head (resting on paws)
  for (let hx = 6; hx <= 16; hx++)
    for (let hy = 16+breathe; hy <= 22+breathe; hy++) {
      if (hx < 8 && hy < 18+breathe) continue
      d.push([hx, hy, C.body])
    }
  for (let hx = 7; hx <= 14; hx++) d.push([hx, 16+breathe, C.bodyHi])

  // Closed eyes
  d.push([9, 18+breathe, C.bodyDk], [10, 18+breathe, C.bodyDk], [11, 18+breathe, C.bodyDk])
  d.push([9, 19+breathe, C.bodyDk], [11, 19+breathe, C.bodyDk])
  // Cheek
  d.push([8, 20+breathe, C.cheek], [8, 21+breathe, C.cheek])

  // Snout
  for (let sx = 4; sx <= 7; sx++)
    for (let sy = 19+breathe; sy <= 22+breathe; sy++)
      d.push([sx, sy, C.body])
  d.push([4, 20+breathe, C.noseDk])

  // Horns
  d.push([13, 15+breathe, C.horn], [14, 14+breathe, C.hornHi], [15, 15+breathe, C.horn])

  // Wing (draped over body)
  for (let wx = 16; wx <= 22; wx++)
    for (let wy = 19+breathe; wy <= 22+breathe; wy++)
      d.push([wx, wy, C.wingMem])
  for (let wx = 16; wx <= 22; wx++) d.push([wx, 19+breathe, C.wingHi])
  for (let wx = 16; wx <= 22; wx++) d.push([wx, 22+breathe, C.wingDk])
  d.push([16, 20+breathe, C.wingHi], [22, 20+breathe, C.wingDk])

  // Tail (curled around)
  d.push([24, 24, C.body], [25, 25, C.bodyMid], [25, 26, C.bodyDk])
  d.push([24, 27, C.bodyDk], [23, 28, C.bodyMid], [22, 29, C.body])
  d.push([21, 29, C.bodyMid])
  // Tail tip
  d.push([20, 29, C.horn], [19, 29, C.hornDk])

  // Paws
  d.push([5, 23+breathe, C.clawHi], [6, 23+breathe, C.claw], [7, 23+breathe, C.claw])

  // Z's
  const zc = C.wingHi
  if (zPhase >= 1) {
    d.push([4, 14+breathe, zc], [5, 14+breathe, zc], [5, 15+breathe, zc], [4, 15+breathe, zc])
  }
  if (zPhase >= 2) {
    d.push([2, 11+breathe, zc], [3, 11+breathe, zc], [3, 12+breathe, zc], [2, 12+breathe, zc])
    d.push([2, 10+breathe, zc])
  }
  if (zPhase >= 3) {
    d.push([1, 7+breathe, zc], [2, 7+breathe, zc], [1, 8+breathe, zc])
  }

  return d
}

function makeJumpFrame(f: number): SpriteData {
  const wingFlap = f % 3
  const fireFrame = f % 4
  const d: SpriteData = []

  // Head (looking up slightly)
  for (let hx = 8; hx <= 20; hx++)
    for (let hy = 4; hy <= 12; hy++) {
      if (hx < 10 && hy < 6) continue
      if (hx > 19 && hy < 6) continue
      d.push([hx, hy, C.body])
    }
  for (let hx = 10; hx <= 18; hx++) d.push([hx, 4, C.bodyHi])

  // Horns
  d.push([13, 3, C.hornHi], [14, 2, C.horn], [15, 1, C.hornHi])
  d.push([17, 3, C.hornHi], [18, 2, C.horn], [19, 1, C.hornHi])

  // Excited eye (wide)
  for (let ex = 11; ex <= 15; ex++)
    for (let ey = 6; ey <= 10; ey++)
      d.push([ex, ey, C.eyeWhite])
  d.push([12, 7, C.eyeIris], [13, 7, C.eyeIris], [14, 7, C.eyeIris])
  d.push([12, 8, C.eyeIris], [13, 8, C.eyePupil], [14, 8, C.eyeIris])
  d.push([12, 9, C.eyeIris], [13, 9, C.eyeIris], [14, 9, C.eyeIris])
  d.push([12, 7, C.eyeShine])

  // Snout
  for (let sx = 5; sx <= 9; sx++)
    for (let sy = 8; sy <= 12; sy++)
      d.push([sx, sy, C.body])
  d.push([6, 9, C.noseDk], [6, 10, C.noseDk])

  // Open mouth for fire
  d.push([5, 12, C.fire3], [6, 12, C.fire3], [7, 12, C.fire2])

  // Body
  for (let bx = 10; bx <= 22; bx++)
    for (let by = 12; by <= 22; by++)
      d.push([bx, by, C.body])
  // Belly
  for (let bx = 11; bx <= 17; bx++)
    for (let by = 17; by <= 22; by++)
      d.push([bx, by, C.belly])

  // Wings (spread wide!)
  if (wingFlap === 0) {
    // Up
    for (let wx = 20; wx <= 30; wx++) {
      const wy = 6 - Math.floor((wx - 20) / 3)
      d.push([wx, wy, C.wing], [wx, wy+1, C.wingMem], [wx, wy+2, C.wingMemDk])
    }
    for (let wx = 20; wx <= 28; wx++) d.push([wx, 5 - Math.floor((wx-20)/3), C.wingHi])
    d.push([29, 3, C.wingDk], [30, 2, C.wingDk])
  } else if (wingFlap === 1) {
    // Mid
    for (let wx = 20; wx <= 29; wx++) {
      d.push([wx, 9, C.wing], [wx, 10, C.wingMem], [wx, 11, C.wingMemDk])
    }
    for (let wx = 20; wx <= 29; wx++) d.push([wx, 8, C.wingHi])
    d.push([29, 8, C.wingDk], [30, 9, C.wingDk])
  } else {
    // Down
    for (let wx = 20; wx <= 28; wx++) {
      const wy = 10 + Math.floor((wx - 20) / 4)
      d.push([wx, wy, C.wing], [wx, wy+1, C.wingMem], [wx, wy+2, C.wingMemDk])
    }
    for (let wx = 20; wx <= 28; wx++) d.push([wx, 9 + Math.floor((wx-20)/4), C.wingHi])
  }

  // Tail (up and energetic)
  d.push([22, 19, C.body], [23, 18, C.bodyMid], [24, 17, C.bodyMid])
  d.push([25, 16, C.bodyDk], [26, 15, C.bodyDk], [27, 14, C.hornDk])
  d.push([27, 13, C.horn], [28, 13, C.horn], [28, 14, C.hornDk])
  d.push([27, 15, C.horn])

  // Legs (stretched down)
  for (let ly = 22; ly <= 28; ly++) {
    d.push([12, ly, C.bodyMid], [13, ly, C.body])
    d.push([19, ly, C.bodyDk], [20, ly, C.bodyMid])
  }
  d.push([11, 29, C.clawHi], [12, 29, C.claw], [13, 29, C.claw], [14, 29, C.clawDk])
  d.push([18, 29, C.clawHi], [19, 29, C.claw], [20, 29, C.claw], [21, 29, C.clawDk])

  // Fire breath!
  if (fireFrame < 3) {
    const fireY = 11
    d.push([4, fireY, C.fire1], [3, fireY, C.fire2], [2, fireY, C.fire3])
    d.push([4, fireY+1, C.fire2], [3, fireY+1, C.fire3], [2, fireY+1, C.fire4])
    d.push([1, fireY, C.fire3], [0, fireY, C.fire4])
    d.push([1, fireY+1, C.fire2], [0, fireY+1, C.fire3])
    if (fireFrame < 2) {
      d.push([4, fireY-1, C.fire1], [3, fireY-1, C.fire2])
      d.push([4, fireY+2, C.fire2], [3, fireY+2, C.fire3])
      d.push([-1, fireY, C.fire4], [-1, fireY+1, C.fire4])
    }
  }

  // Spines
  d.push([16, 3, C.hornHi], [16, 12, C.horn], [19, 11, C.hornHi])

  return d
}

function makePeekFrame(f: number): SpriteData {
  const blink = f % 16 < 2
  const d: SpriteData = []

  // Only head + one claw visible (peeking from right side)
  // Head
  for (let hx = 14; hx <= 26; hx++)
    for (let hy = 6; hy <= 16; hy++) {
      if (hx < 16 && hy < 8) continue
      d.push([hx, hy, C.body])
    }
  for (let hx = 16; hx <= 24; hx++) d.push([hx, 6, C.bodyHi])

  // Horns
  d.push([19, 5, C.hornHi], [20, 4, C.horn], [21, 3, C.hornHi])
  d.push([23, 5, C.hornHi], [24, 4, C.horn], [25, 3, C.hornHi])

  // Eye (curious, looking left)
  if (!blink) {
    for (let ex = 16; ex <= 20; ex++)
      for (let ey = 9; ey <= 13; ey++)
        d.push([ex, ey, C.eyeWhite])
    d.push([17, 10, C.eyeIris], [18, 10, C.eyeIris])
    d.push([17, 11, C.eyeIris], [18, 11, C.eyePupil])
    d.push([17, 10, C.eyeShine])
    d.push([16, 8, C.bodyDk], [17, 8, C.bodyDk], [18, 8, C.bodyDk], [19, 8, C.bodyDk], [20, 8, C.bodyDk])
  } else {
    for (let ex = 16; ex <= 20; ex++) d.push([ex, 11, C.bodyDk])
  }

  // Cheek
  d.push([15, 13, C.cheek], [15, 14, C.cheek])

  // Claws gripping edge
  for (let cy = 17; cy <= 22; cy++)
    d.push([16, cy, C.body], [17, cy, C.bodyMid])
  d.push([15, 17, C.clawHi], [15, 18, C.claw], [15, 19, C.claw])
  d.push([18, 17, C.clawDk], [18, 18, C.clawDk])

  // Spines
  d.push([22, 5, C.hornHi])

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
