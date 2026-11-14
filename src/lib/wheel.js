// Wheel geometry. Angles are in degrees.
//
// Segment i covers the wheel-frame angles [i * w, (i + 1) * w), measured
// clockwise from 12 o'clock when the wheel is at rotation 0, where w = 360 / n.
// The wheel is drawn with rotate(rotation) (clockwise) and the pointer sits at
// 12 o'clock, so the wheel-frame angle under the pointer is mod(-rotation, 360).
// The renderer and the judgment both use segmentIndexAt, so what the pointer
// shows and what is recorded cannot disagree.

import { randomBetween, randomInt } from './random.js'

export const BLANK_ID = '__blank'

/** Keep a stop at least this fraction of a segment away from either edge. */
export const EDGE_MARGIN = 0.12

export function mod(a, m) {
  return ((a % m) + m) % m
}

/** One segment per prize with stock left, in setup order, then the blank. */
export function buildSegments(prizes, blankLabel) {
  const segments = prizes
    .filter((p) => p.left > 0)
    .map((p) => ({ id: p.id, kind: 'prize', name: p.name, left: p.left }))
  segments.push({ id: BLANK_ID, kind: 'blank', name: blankLabel, left: null })
  return segments
}

export function segmentWidth(count) {
  return 360 / count
}

/** Index of the segment under the pointer for a given wheel rotation. */
export function segmentIndexAt(rotation, count) {
  const w = segmentWidth(count)
  const idx = Math.floor(mod(-rotation, 360) / w)
  return Math.min(idx, count - 1)
}

/** Center angle of segment i in the wheel frame. */
export function segmentCenter(i, count) {
  return (i + 0.5) * segmentWidth(count)
}

/**
 * Rotation that puts wheel-frame angle `frameAngle` under the pointer,
 * reached by turning clockwise from `from` for `turns` full turns plus the
 * remaining distance.
 */
export function rotationToShow(frameAngle, from, turns) {
  return from + turns * 360 + mod(-frameAngle - from, 360)
}

/**
 * Decide a spin before any animation runs.
 * The winning segment is chosen uniformly; the stop angle is uniform inside
 * that segment but away from its edges.
 */
export function planSpin({ fromRotation, count, reducedMotion = false }) {
  if (!Number.isInteger(count) || count < 1) throw new RangeError('planSpin: no segments')
  const index = randomInt(count)
  const w = segmentWidth(count)
  const offset = randomBetween(EDGE_MARGIN, 1 - EDGE_MARGIN)
  const frameAngle = (index + offset) * w
  const turns = reducedMotion ? 1 : 5 + randomInt(3)
  const duration = reducedMotion ? 1000 : Math.round(randomBetween(4000, 6000))
  const targetRotation = rotationToShow(frameAngle, fromRotation, turns)
  return { index, offset, frameAngle, turns, duration, fromRotation, targetRotation }
}

/**
 * Position along the spin for t in [0, 1]. Strictly increasing, starts at
 * full speed and slows to zero velocity at t = 1, like a wheel under friction.
 */
export function spinEase(t) {
  if (t <= 0) return 0
  if (t >= 1) return 1
  return 1 - Math.pow(1 - t, 3.2)
}
