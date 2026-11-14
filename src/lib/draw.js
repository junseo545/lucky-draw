// Draw session state transitions. Every function is pure: it takes a session
// object and returns a new one (or the same one when the action is not
// allowed), so snapshots for undo and persistence are plain JSON.

import { randomInt } from './random.js'
import { BLANK_ID, buildSegments, mod, planSpin, segmentIndexAt } from './wheel.js'

export const BLANK_POLICY = { EXCLUDE: 'exclude', KEEP: 'keep' }
export const TURN_MODE = { RANDOM: 'random', MANUAL: 'manual' }

/**
 * @param {{ names: string[], prizes: {name:string, qty:number}[], blankLabel: string,
 *           blankPolicy: string, turnMode: string }} config
 */
export function createSession(config) {
  const participants = config.names.map((name, i) => ({ id: `p${i + 1}`, name }))
  return {
    participants,
    remaining: participants.map((p) => p.id),
    prizes: config.prizes.map((p, i) => ({ id: `g${i + 1}`, name: p.name, total: p.qty, left: p.qty })),
    blankLabel: (config.blankLabel ?? '').trim() || '꽝',
    blankPolicy: config.blankPolicy === BLANK_POLICY.KEEP ? BLANK_POLICY.KEEP : BLANK_POLICY.EXCLUDE,
    turnMode: config.turnMode === TURN_MODE.MANUAL ? TURN_MODE.MANUAL : TURN_MODE.RANDOM,
    current: null,
    rotation: 0,
    pending: null,
    log: [],
    lastResult: null,
    undo: null,
  }
}

export function segmentsOf(session) {
  return buildSegments(session.prizes, session.blankLabel)
}

export function participantName(session, id) {
  return session.participants.find((p) => p.id === id)?.name ?? ''
}

export function prizesLeft(session) {
  return session.prizes.reduce((sum, p) => sum + p.left, 0)
}

export function isFinished(session) {
  return prizesLeft(session) === 0 || session.remaining.length === 0
}

export function canSpin(session) {
  return !session.pending && !isFinished(session) && session.current !== null && session.remaining.includes(session.current)
}

/**
 * Call the next participant at random from those still in the pool.
 * When re-calling (the called person is absent), the current person is skipped
 * if anyone else is left; they stay in the pool.
 */
export function callRandom(session) {
  if (session.pending || isFinished(session)) return session
  let pool = session.remaining
  if (session.current !== null && pool.length > 1) pool = pool.filter((id) => id !== session.current)
  if (!pool.length) return session
  return { ...session, current: pool[randomInt(pool.length)], lastResult: null }
}

/** Pick the next participant by hand. Only someone still in the pool can be chosen. */
export function chooseParticipant(session, id) {
  if (session.pending || isFinished(session)) return session
  if (!session.remaining.includes(id)) return session
  return { ...session, current: id, lastResult: null }
}

/**
 * Decide the outcome and the exact stop rotation, before any animation.
 * The decision is stored in `pending` so a reload mid-spin can commit it.
 */
export function beginSpin(session, { reducedMotion = false } = {}) {
  if (!canSpin(session)) return session
  const segments = segmentsOf(session)
  const fromRotation = mod(session.rotation, 360)
  const plan = planSpin({ fromRotation, count: segments.length, reducedMotion })
  const landed = segments[segmentIndexAt(plan.targetRotation, segments.length)]
  if (landed !== segments[plan.index]) {
    // Cannot happen: planSpin picks the stop angle from the chosen segment.
    throw new Error('spin plan does not land on the chosen segment')
  }
  return {
    ...session,
    lastResult: null,
    pending: {
      participantId: session.current,
      segments,
      index: plan.index,
      segmentId: landed.id,
      fromRotation,
      targetRotation: plan.targetRotation,
      duration: plan.duration,
    },
  }
}

/** Apply the pending result. The pre-spin state becomes the undo snapshot. */
export function commitSpin(session) {
  const pending = session.pending
  if (!pending) return session
  const before = { ...session, pending: null, undo: null }
  const pid = pending.participantId
  const segment = pending.segments[pending.index]
  const isPrize = segment.kind === 'prize' && segment.id !== BLANK_ID

  const entry = {
    seq: session.log.length + 1,
    participantId: pid,
    name: participantName(session, pid),
    kind: isPrize ? 'prize' : 'blank',
    prizeId: isPrize ? segment.id : null,
    prizeName: isPrize ? segment.name : session.blankLabel,
    segmentId: segment.id,
  }

  const prizes = isPrize
    ? session.prizes.map((p) => (p.id === segment.id ? { ...p, left: Math.max(0, p.left - 1) } : p))
    : session.prizes
  const leaves = isPrize || session.blankPolicy === BLANK_POLICY.EXCLUDE
  const remaining = leaves ? session.remaining.filter((id) => id !== pid) : session.remaining

  return {
    ...session,
    prizes,
    remaining,
    current: null,
    rotation: mod(pending.targetRotation, 360),
    pending: null,
    log: [...session.log, entry],
    lastResult: entry,
    undo: before,
  }
}

/** Cancel the most recent draw. Only one level is kept. */
export function undoLast(session) {
  if (session.pending || !session.undo) return session
  return { ...session.undo, undo: null, lastResult: null }
}

export function winners(session) {
  return session.log.filter((e) => e.kind === 'prize')
}

export function blanks(session) {
  return session.log.filter((e) => e.kind === 'blank')
}

export function leftoverPrizes(session) {
  return session.prizes.filter((p) => p.left > 0)
}
