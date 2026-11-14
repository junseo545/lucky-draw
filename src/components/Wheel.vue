<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { tick } from '../lib/sound.js'
import { BLANK_ID, segmentWidth, spinEase } from '../lib/wheel.js'

const props = defineProps({
  segments: { type: Array, required: true },
  rotation: { type: Number, default: 0 },
  highlightId: { type: String, default: null },
  reducedMotion: { type: Boolean, default: false },
  sound: { type: Boolean, default: false },
})

/* Geometry in viewBox units. The pointer hinge sits above 12 o'clock. */
const R = 440 // segment radius
const RIM_OUTER = 478
const PIN_RADIUS = 459
const PIN_SIZE = 9
const HUB_R = 66
const HINGE_Y = -512
const LABEL_OUTER = R - 30
const LABEL_INNER = HUB_R + 20
const FONT_MAX = 54
const FONT_MIN = 20

/* Pointer physics */
const MAX_DEFLECT = 20 // degrees the flapper swings when a pin pushes it
const CONTACT = 2.6 // degrees of wheel travel during which a pin pushes the tip
const OMEGA = 2 * Math.PI * 7
const DAMPING = 2 * 0.22 * OMEGA

const rotorEl = ref(null)
const pointerEl = ref(null)

/* ------------------------------------------------------------------ */
/* Segment layout with an animated transition when segments change.   */
/* ------------------------------------------------------------------ */

function orderKey(seg) {
  if (seg.id === BLANK_ID) return Number.POSITIVE_INFINITY
  const n = Number(String(seg.id).replace(/\D/g, ''))
  return Number.isFinite(n) ? n : 0
}

function colorFor(seg, prizeIndex) {
  return seg.kind === 'blank' ? 'blank' : `seg-${(prizeIndex % 3) + 1}`
}

function withColors(segments) {
  let i = 0
  return segments.map((seg) => ({ seg, color: colorFor(seg, seg.kind === 'blank' ? 0 : i++), w: 1 }))
}

const items = shallowRef(withColors(props.segments))
let relayoutRaf = 0

watch(
  () => props.segments,
  (next) => {
    cancelAnimationFrame(relayoutRaf)
    const prev = items.value
    const target = withColors(next)
    const instant = props.reducedMotion || !prev.length
    if (instant) {
      items.value = target
      return
    }
    const byId = new Map(prev.map((it) => [it.seg.id, it]))
    const nextIds = new Set(target.map((it) => it.seg.id))
    const union = [...target]
    for (const it of prev) if (!nextIds.has(it.seg.id)) union.push({ ...it, removed: true })
    union.sort((a, b) => orderKey(a.seg) - orderKey(b.seg))
    const plan = union.map((it) => ({
      ...it,
      from: byId.get(it.seg.id)?.w ?? 0,
      to: it.removed ? 0 : 1,
    }))
    const start = performance.now()
    const duration = 450
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const e = 1 - Math.pow(1 - t, 3)
      items.value = plan.map((it) => ({ ...it, w: it.from + (it.to - it.from) * e }))
      if (t < 1) relayoutRaf = requestAnimationFrame(step)
      else items.value = target
    }
    relayoutRaf = requestAnimationFrame(step)
  },
)

function point(angleDeg, r) {
  const a = (angleDeg * Math.PI) / 180
  return [r * Math.sin(a), -r * Math.cos(a)]
}

function sectorPath(a0, a1, r) {
  if (a1 - a0 >= 359.999) {
    return `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r} Z`
  }
  const [x0, y0] = point(a0, r)
  const [x1, y1] = point(a1, r)
  const large = a1 - a0 > 180 ? 1 : 0
  return `M 0 0 L ${x0.toFixed(3)} ${y0.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(3)} ${y1.toFixed(3)} Z`
}

/* Rough glyph widths in em, enough to keep labels inside their segment. */
function textWidth(str, size) {
  let w = 0
  for (const ch of str) {
    if (/[ᄀ-ᇿ㄰-㆏가-힯぀-ヿ一-鿿＀-￯]/.test(ch)) w += 0.98
    else if (ch === ' ') w += 0.28
    else if (/[A-Z0-9#%&@MW]/.test(ch)) w += 0.68
    else if (ch === '×') w += 0.62
    else w += 0.56
  }
  return w * size
}

function fitLabel(name, suffix, span) {
  const half = Math.min(span, 179) / 2
  const sin = Math.sin((half * Math.PI) / 180)
  const maxLen = LABEL_OUTER - LABEL_INNER
  const fits = (text, size) => {
    const width = textWidth(text, size) + (suffix ? textWidth(suffix, size * 0.78) : 0)
    if (width > maxLen) return false
    const innerEnd = LABEL_OUTER - width
    return size * 1.1 <= 2 * innerEnd * sin * 0.92
  }
  for (let size = FONT_MAX; size >= FONT_MIN; size -= 2) {
    if (fits(name, size)) return { text: name, size }
  }
  const chars = [...name]
  for (let n = chars.length - 1; n >= 1; n -= 1) {
    const t = chars.slice(0, n).join('') + '…'
    if (fits(t, FONT_MIN)) return { text: t, size: FONT_MIN }
  }
  return { text: chars[0] ?? '', size: FONT_MIN }
}

const layout = computed(() => {
  const list = items.value
  const total = list.reduce((s, it) => s + it.w, 0) || 1
  let acc = 0
  return list.map((it, index) => {
    const a0 = (acc / total) * 360
    acc += it.w
    const a1 = (acc / total) * 360
    const span = a1 - a0
    const suffix = it.seg.kind === 'prize' ? ` ×${it.seg.left}` : ''
    const label = span > 0.5 ? fitLabel(it.seg.name, suffix, span) : null
    return {
      key: it.seg.id,
      seg: it.seg,
      index,
      color: it.color,
      a0,
      a1,
      center: (a0 + a1) / 2,
      path: span > 0.01 ? sectorPath(a0, a1, R) : null,
      label,
      suffix,
      fade: Math.min(1, it.w),
    }
  })
})

const pins = computed(() => layout.value.map((s) => point(s.a0, PIN_RADIUS)))
const winner = computed(() => (props.highlightId ? layout.value.find((s) => s.seg.id === props.highlightId && s.path) : null))

/* ------------------------------------------------------------------ */
/* Rotation and pointer, updated directly on the DOM per frame.        */
/* ------------------------------------------------------------------ */

let currentRotation = props.rotation
let spinRaf = 0
let pointerRaf = 0
let pointerAngle = 0
let pointerVel = 0
let spinning = false

function setRotor(rot) {
  currentRotation = rot
  rotorEl.value?.setAttribute('transform', `rotate(${rot.toFixed(4)})`)
}

function setPointer(deg) {
  pointerAngle = deg
  // A pin moving clockwise pushes the tip to the right, which turns the
  // flapper counterclockwise about its hinge.
  pointerEl.value?.setAttribute('transform', `rotate(${(-deg).toFixed(3)} 0 ${HINGE_Y})`)
}

/** Deflection forced by the next pin when it is touching the tip. */
function contactAt(rot, pinStep) {
  const gap = Math.ceil(rot / pinStep) * pinStep - rot
  return gap < CONTACT ? MAX_DEFLECT * (1 - gap / CONTACT) : 0
}

function stepPointer(prevRot, rot, dt, pinStep) {
  if (props.reducedMotion) {
    setPointer(0)
    return
  }
  const crossings = Math.floor(rot / pinStep) - Math.floor(prevRot / pinStep)
  let p = pointerAngle
  let v = pointerVel
  if (crossings > 0) {
    p = Math.max(p, MAX_DEFLECT * 0.9)
    v = 0
    if (props.sound) tick(Math.min(1, crossings))
  }
  const sub = 3
  const h = dt / sub
  for (let i = 0; i < sub; i += 1) {
    v += (-OMEGA * OMEGA * p - DAMPING * v) * h
    p += v * h
  }
  // A pin approaching the tip holds the flapper up against it.
  const contact = contactAt(rot, pinStep)
  if (contact > p) {
    p = contact
    v = 0
  }
  p = Math.max(-MAX_DEFLECT * 0.6, Math.min(MAX_DEFLECT, p))
  pointerVel = v
  setPointer(p)
}

function settlePointer(pinStep) {
  cancelAnimationFrame(pointerRaf)
  let last = performance.now()
  const loop = (now) => {
    const dt = Math.min(1 / 30, (now - last) / 1000)
    last = now
    stepPointer(currentRotation, currentRotation, dt, pinStep)
    // At rest the flapper hangs straight, or leans on a pin that stopped at its tip.
    const rest = props.reducedMotion ? 0 : contactAt(currentRotation, pinStep)
    if (Math.abs(pointerAngle - rest) > 0.05 || Math.abs(pointerVel) > 0.5) {
      pointerRaf = requestAnimationFrame(loop)
    } else {
      pointerVel = 0
      setPointer(rest)
    }
  }
  pointerRaf = requestAnimationFrame(loop)
}

/**
 * Animate from `from` to `to` (clockwise, `to` > `from`). Resolves when the
 * wheel has fully stopped at `to`; the flapper may still be settling.
 */
function spin({ from, to, duration }) {
  cancelAnimationFrame(spinRaf)
  cancelAnimationFrame(pointerRaf)
  const pinStep = segmentWidth(props.segments.length)
  spinning = true
  setRotor(from)
  return new Promise((resolve) => {
    const start = performance.now()
    let prevRot = from
    let last = start
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const rot = t >= 1 ? to : from + (to - from) * spinEase(t)
      const dt = Math.min(1 / 30, Math.max(0, (now - last) / 1000))
      last = now
      setRotor(rot)
      stepPointer(prevRot, rot, dt, pinStep)
      prevRot = rot
      if (t < 1) {
        spinRaf = requestAnimationFrame(step)
      } else {
        spinning = false
        settlePointer(pinStep)
        resolve()
      }
    }
    spinRaf = requestAnimationFrame(step)
  })
}

defineExpose({ spin })

watch(
  () => props.rotation,
  (rot) => {
    if (!spinning) setRotor(rot)
  },
)

onMounted(() => {
  setRotor(props.rotation)
  setPointer(0)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(spinRaf)
  cancelAnimationFrame(pointerRaf)
  cancelAnimationFrame(relayoutRaf)
})
</script>

<template>
  <svg
    class="wheel"
    :class="{ 'has-highlight': highlightId, 'reduced-motion': reducedMotion }"
    viewBox="-500 -540 1000 1040"
    role="img"
    :aria-label="`원판: ${segments.map((s) => (s.kind === 'prize' ? `${s.name} ${s.left}개` : s.name)).join(', ')}`"
    data-testid="wheel"
  >
    <g class="body">
      <circle class="shadow" r="478" cy="12" />
      <circle class="rim" r="478" />
      <g ref="rotorEl" class="rotor">
        <circle class="underlay" :r="R" />
        <template v-for="s in layout" :key="s.key">
          <path
            v-if="s.path"
            class="segment"
            :class="[`fill-${s.color}`, { 'is-dim': highlightId && s.seg.id !== highlightId }]"
            :d="s.path"
            :data-segment-id="s.seg.id"
            :data-segment-name="s.seg.name"
            :data-segment-kind="s.seg.kind"
            :data-segment-index="s.index"
          />
        </template>
        <path v-if="winner" class="win-outline" :d="winner.path" data-testid="win-outline" :data-segment-id="winner.seg.id" />
        <template v-for="s in layout" :key="`label-${s.key}`">
          <g
            v-if="s.label"
            class="label"
            :class="[`text-${s.color}`, { 'is-dim': highlightId && s.seg.id !== highlightId }]"
            :transform="`rotate(${(s.center - 90).toFixed(3)})`"
            :opacity="s.fade"
          >
            <text :x="LABEL_OUTER" y="0" dy="0.36em" text-anchor="end" :font-size="s.label.size">
              {{ s.label.text }}<tspan v-if="s.suffix" class="qty" :font-size="s.label.size * 0.78">{{ s.suffix }}</tspan>
            </text>
          </g>
        </template>
        <circle class="rim-line" :r="R" />
        <circle v-for="(p, i) in pins" :key="`pin-${i}`" class="pin" :cx="p[0]" :cy="p[1]" :r="PIN_SIZE" />
      </g>
      <circle class="hub" :r="HUB_R" />
      <circle class="hub-cap" r="20" />
    </g>
    <g ref="pointerEl" class="pointer">
      <path :d="`M -24 ${HINGE_Y} A 24 24 0 0 1 24 ${HINGE_Y} L 6 -452 Q 0 -442 -6 -452 Z`" />
      <circle class="pointer-bolt" cx="0" :cy="HINGE_Y" r="8" />
    </g>
  </svg>
</template>

<style scoped>
.wheel {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
  user-select: none;
}

.shadow {
  fill: var(--color-wheel-shadow);
  pointer-events: none;
}

.rim {
  fill: var(--color-rim);
}

/* Dimmed segments fade toward paper instead of toward the dark rim. */
.underlay {
  fill: var(--color-paper);
  pointer-events: none;
}

.segment {
  stroke: var(--color-rim);
  stroke-width: 3;
  stroke-linejoin: round;
  transition:
    fill 300ms ease,
    opacity var(--duration-fast) ease;
}

.fill-seg-1 {
  fill: var(--color-seg-1);
}
.fill-seg-2 {
  fill: var(--color-seg-2);
}
.fill-seg-3 {
  fill: var(--color-seg-3);
}
.fill-blank {
  fill: var(--color-blank);
}

.label {
  pointer-events: none;
  font-weight: 800;
  letter-spacing: -0.01em;
  transition: opacity var(--duration-fast) ease;
}

.label .qty {
  font-weight: 700;
}

.text-seg-1 {
  fill: var(--color-seg-1-text);
}
.text-seg-2 {
  fill: var(--color-seg-2-text);
}
.text-seg-3 {
  fill: var(--color-seg-3-text);
}
.text-blank {
  fill: var(--color-blank-text);
}

.is-dim {
  opacity: 0.38;
}

.label.is-dim {
  opacity: 0.3;
}

.win-outline {
  fill: none;
  stroke: var(--color-surface);
  stroke-width: 12;
  stroke-linejoin: round;
  pointer-events: none;
  animation: win-pulse 700ms ease-in-out 2;
}

.reduced-motion .win-outline {
  animation: none;
}

@keyframes win-pulse {
  0%,
  100% {
    stroke-width: 12;
  }
  50% {
    stroke-width: 24;
  }
}

.rim-line {
  fill: none;
  stroke: var(--color-rim);
  stroke-width: 6;
  pointer-events: none;
}

.pin {
  fill: var(--color-pin);
  stroke: var(--color-pin-edge);
  stroke-width: 2.5;
  pointer-events: none;
}

.hub {
  fill: var(--color-rim);
  pointer-events: none;
}

.hub-cap {
  fill: var(--color-pin);
  stroke: var(--color-pin-edge);
  stroke-width: 3;
  pointer-events: none;
}

.pointer {
  pointer-events: none;
}

.pointer path {
  fill: var(--color-pointer);
  stroke: var(--color-surface);
  stroke-width: 3;
  stroke-linejoin: round;
}

.pointer-bolt {
  fill: var(--color-pin);
  stroke: var(--color-pin-edge);
  stroke-width: 2;
}
</style>
