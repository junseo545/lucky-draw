// App state: setup form, draw session and view prefs. Saved to localStorage
// on every change when storage works; the app runs the same when it does not.

import { reactive, shallowRef, ref, watch } from 'vue'
import {
  beginSpin,
  callRandom,
  chooseParticipant,
  commitSpin,
  createSession,
  isFinished,
  undoLast,
} from './lib/draw.js'
import { resolveParticipants } from './lib/participants.js'
import { resolvePrizes } from './lib/prizes.js'
import { createStore } from './lib/storage.js'

const VERSION = 1
const storage = createStore()

let rowSeq = 0
export function newPrizeRow(name = '', qty = 1) {
  rowSeq += 1
  return { id: `r${rowSeq}`, name, qty }
}

function defaultSetup() {
  return {
    inputMode: 'names',
    namesText: '',
    rangeStart: '1',
    rangeEnd: '',
    prizes: [newPrizeRow()],
    blankLabel: '꽝',
    blankPolicy: 'exclude',
    turnMode: 'random',
  }
}

function defaultPrefs() {
  return { sound: false, showRemaining: true, showWinners: true }
}

export const phase = ref('setup') // 'setup' | 'draw' | 'result'
export const setup = reactive(defaultSetup())
export const prefs = reactive(defaultPrefs())
/** Draw session; replaced as a whole by the pure functions in lib/draw.js. */
export const session = shallowRef(null)
export const storageAvailable = storage.available

function snapshot() {
  return { v: VERSION, phase: phase.value, setup, prefs, session: session.value }
}

export function persist() {
  storage.save(snapshot())
}

function restore() {
  const saved = storage.load()
  if (!saved || saved.v !== VERSION) return
  try {
    if (saved.setup && typeof saved.setup === 'object') {
      const s = { ...defaultSetup(), ...saved.setup }
      if (!Array.isArray(s.prizes) || !s.prizes.length) s.prizes = [newPrizeRow()]
      s.prizes = s.prizes.map((p) => newPrizeRow(String(p.name ?? ''), p.qty ?? 1))
      Object.assign(setup, s)
    }
    if (saved.prefs && typeof saved.prefs === 'object') Object.assign(prefs, defaultPrefs(), saved.prefs)
    const s = saved.session
    if (s && Array.isArray(s.participants) && Array.isArray(s.prizes) && Array.isArray(s.remaining)) {
      // A reload during a spin: the result was decided before the wheel moved,
      // so it is final. Commit it instead of letting anyone spin again.
      const restored = s.pending ? commitSpin(s) : s
      session.value = restored
      phase.value = isFinished(restored) ? 'result' : saved.phase === 'result' ? 'result' : 'draw'
    }
  } catch {
    // Corrupt or incompatible data: start fresh.
    Object.assign(setup, defaultSetup())
    session.value = null
    phase.value = 'setup'
  }
}

restore()
persist()

watch(phase, persist, { flush: 'sync' })
watch(session, persist, { flush: 'sync' })
watch(setup, persist, { deep: true })
watch(prefs, persist, { deep: true })

/* Setup ----------------------------------------------------------------- */

export function setupSummary() {
  const participants = resolveParticipants(setup)
  const prizes = resolvePrizes(setup.prizes)
  const problems = []
  if (participants.error) problems.push(participants.error)
  if (!participants.names.length && !participants.error) problems.push('참가자를 입력하세요.')
  if (!prizes.prizes.length) problems.push('경품을 하나 이상 입력하세요.')
  if (prizes.duplicates.length) problems.push(`같은 이름의 경품이 있습니다: ${prizes.duplicates.join(', ')}`)
  return {
    participants,
    prizes,
    canStart: problems.length === 0,
    problems,
    oversupply: prizes.total > participants.names.length && participants.names.length > 0,
  }
}

export function startDraw() {
  const summary = setupSummary()
  if (!summary.canStart) return false
  session.value = createSession({
    names: summary.participants.names,
    prizes: summary.prizes.prizes,
    blankLabel: setup.blankLabel,
    blankPolicy: setup.blankPolicy,
    turnMode: setup.turnMode,
  })
  phase.value = 'draw'
  return true
}

/* Draw ------------------------------------------------------------------ */

export function callNext() {
  if (session.value) session.value = callRandom(session.value)
}

export function choose(id) {
  if (session.value) session.value = chooseParticipant(session.value, id)
}

/** Decide the result and save it before the animation starts. */
export function spin({ reducedMotion = false } = {}) {
  if (!session.value) return false
  const next = beginSpin(session.value, { reducedMotion })
  if (next === session.value) return false
  session.value = next // persisted synchronously by the watcher
  return true
}

export function commit() {
  if (session.value?.pending) session.value = commitSpin(session.value)
}

export function undo() {
  if (!session.value) return
  const next = undoLast(session.value)
  if (next === session.value) return
  session.value = next
  if (phase.value === 'result') phase.value = 'draw'
}

export function showResults() {
  phase.value = 'result'
}

/** Back to setup. The setup form keeps what was typed. */
export function resetAll() {
  session.value = null
  phase.value = 'setup'
}
