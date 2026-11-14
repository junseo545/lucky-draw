<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useFullscreen } from '../composables/useFullscreen.js'
import { useReducedMotion } from '../composables/useReducedMotion.js'
import { canSpin, isFinished, participantName, prizesLeft, segmentsOf, winners } from '../lib/draw.js'
import { unlockAudio } from '../lib/sound.js'
import { callNext, choose, commit, prefs, resetAll, session, showResults, spin, undo } from '../store.js'
import ConfirmReset from './ConfirmReset.vue'
import Icon from './Icon.vue'
import Wheel from './Wheel.vue'

const reduced = useReducedMotion()
const fullscreen = useFullscreen()
const wheel = ref(null)

const s = computed(() => session.value)

/** idle -> spinning -> showing -> relayout -> idle. Everything is locked unless idle. */
const stage = ref('idle')
const busy = computed(() => stage.value !== 'idle')
const shownSegments = shallowRef(segmentsOf(session.value))
const highlightId = ref(null)

const spinnable = computed(() => !busy.value && canSpin(s.value))
const isManual = computed(() => s.value.turnMode === 'manual')
const remainingPeople = computed(() => {
  const byId = new Map(s.value.participants.map((p) => [p.id, p]))
  return s.value.remaining.map((id) => byId.get(id))
})
const winnerList = computed(() => winners(s.value).slice().reverse())
const query = ref('')
const filteredPeople = computed(() => {
  const q = query.value.trim()
  return q ? remainingPeople.value.filter((p) => p.name.includes(q)) : remainingPeople.value
})

const PEOPLE_SHOWN = 500

/* What the top bar says. */
const banner = computed(() => {
  const cur = s.value.current
  const last = s.value.lastResult
  if (stage.value !== 'spinning' && cur === null && last) {
    return { label: '결과', text: `${last.name} · ${last.prizeName}`, kind: last.kind, result: true }
  }
  if (cur !== null) return { label: '지금 차례', text: participantName(s.value, cur), kind: 'turn', result: false }
  return {
    label: '지금 차례',
    text: isManual.value ? '명단에서 고르세요' : '다음 사람을 부르세요',
    kind: 'empty',
    result: false,
  }
})

/* Undo or a reload changes the session while idle: show it right away. */
watch(session, (next) => {
  if (next && stage.value === 'idle' && !next.pending) shownSegments.value = segmentsOf(next)
})

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function onSpin() {
  if (!spinnable.value) return
  if (prefs.sound) unlockAudio()
  // The result is decided and saved here, before the wheel moves.
  if (!spin({ reducedMotion: reduced.value })) return
  const pending = session.value.pending
  stage.value = 'spinning'
  shownSegments.value = pending.segments
  await wheel.value.spin({ from: pending.fromRotation, to: pending.targetRotation, duration: pending.duration })

  // The wheel has stopped: record and show the result.
  commit()
  stage.value = 'showing'
  highlightId.value = pending.segmentId
  await wait(reduced.value ? 900 : 1600)
  highlightId.value = null

  if (isFinished(session.value)) {
    stage.value = 'idle'
    showResults()
    return
  }
  stage.value = 'relayout'
  shownSegments.value = segmentsOf(session.value)
  await wait(reduced.value ? 0 : 480)
  stage.value = 'idle'
}

function onNext() {
  if (!busy.value) callNext()
}

function onChoose(id) {
  if (!busy.value) choose(id)
}

function onUndo() {
  if (!busy.value) undo()
}

function toggleSound() {
  prefs.sound = !prefs.sound
  if (prefs.sound) unlockAudio()
}

/* Space bar spins. Swallow both key events so a focused button is not also pressed. */
function onKey(e) {
  if (e.code !== 'Space' && e.key !== ' ') return
  if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"], [role="alertdialog"]')) return
  e.preventDefault()
  if (e.type === 'keydown' && !e.repeat) onSpin()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('keyup', onKey)
})

function fmt(n) {
  return n.toLocaleString('ko-KR')
}
</script>

<template>
  <div class="screen" :data-stage="stage">
    <header class="topbar">
      <div class="banner" :class="`is-${banner.kind}`" aria-live="polite">
        <span class="banner-label">{{ banner.label }}</span>
        <span class="banner-text" :data-testid="banner.result ? 'result-line' : 'turn-name'" :data-kind="banner.kind">{{ banner.text }}</span>
      </div>
      <div class="tools">
        <button type="button" class="btn btn-quiet" :aria-pressed="prefs.sound" @click="toggleSound">
          <Icon :name="prefs.sound ? 'sound-on' : 'sound-off'" />
          효과음 {{ prefs.sound ? '켬' : '끔' }}
        </button>
        <button v-if="fullscreen.supported" type="button" class="btn btn-quiet" @click="fullscreen.toggle">
          <Icon :name="fullscreen.active.value ? 'fullscreen-exit' : 'fullscreen'" />
          {{ fullscreen.active.value ? '전체 화면 끝내기' : '전체 화면' }}
        </button>
        <ConfirmReset :disabled="busy" @confirm="resetAll" />
      </div>
    </header>

    <div class="board">
      <aside class="side lists">
        <section class="panel" :class="{ open: prefs.showRemaining }">
          <button
            type="button"
            class="panel-head"
            :aria-expanded="prefs.showRemaining"
            aria-controls="panel-remaining"
            @click="prefs.showRemaining = !prefs.showRemaining"
          >
            <span>남은 참가자</span>
            <span class="num count" data-testid="remaining-count">{{ fmt(remainingPeople.length) }}</span>
            <Icon name="chevron" class="chev" />
          </button>
          <div v-show="prefs.showRemaining" id="panel-remaining" class="panel-body">
            <input
              v-if="isManual"
              v-model="query"
              class="field search"
              type="search"
              placeholder="이름 검색"
              aria-label="남은 참가자 이름 검색"
            />
            <ul class="people" data-testid="remaining-list">
              <li v-for="p in filteredPeople.slice(0, PEOPLE_SHOWN)" :key="p.id">
                <button
                  v-if="isManual"
                  type="button"
                  class="person"
                  :aria-pressed="s.current === p.id"
                  :disabled="busy"
                  @click="onChoose(p.id)"
                >
                  {{ p.name }}
                </button>
                <span v-else class="person" :class="{ current: s.current === p.id }">{{ p.name }}</span>
              </li>
              <li v-if="filteredPeople.length > PEOPLE_SHOWN" class="muted more">
                외 {{ fmt(filteredPeople.length - PEOPLE_SHOWN) }}명{{ isManual ? '. 검색으로 찾으세요.' : '' }}
              </li>
            </ul>
          </div>
        </section>

        <section class="panel" :class="{ open: prefs.showWinners }">
          <button
            type="button"
            class="panel-head"
            :aria-expanded="prefs.showWinners"
            aria-controls="panel-winners"
            @click="prefs.showWinners = !prefs.showWinners"
          >
            <span>당첨자</span>
            <span class="num count" data-testid="winner-count">{{ fmt(winnerList.length) }}</span>
            <Icon name="chevron" class="chev" />
          </button>
          <div v-show="prefs.showWinners" id="panel-winners" class="panel-body">
            <p v-if="!winnerList.length" class="muted empty">아직 없습니다.</p>
            <ol v-else class="winners" data-testid="winner-list">
              <li v-for="w in winnerList" :key="w.seq">
                <span class="name">{{ w.name }}</span>
                <span class="prize">{{ w.prizeName }}</span>
              </li>
            </ol>
          </div>
        </section>
      </aside>

      <main class="stage">
        <div class="wheel-box">
          <Wheel
            ref="wheel"
            :segments="shownSegments"
            :rotation="s.rotation"
            :highlight-id="highlightId"
            :reduced-motion="reduced"
            :sound="prefs.sound"
          />
        </div>
      </main>

      <aside class="side controls">
        <div class="actions">
          <button
            v-if="!isManual"
            type="button"
            class="btn next"
            data-testid="next"
            :disabled="busy || !remainingPeople.length"
            @click="onNext"
          >
            다음 사람
          </button>
          <p v-else class="muted">왼쪽 명단에서 다음 사람을 고르세요.</p>
          <button type="button" class="btn btn-primary spin" data-testid="spin" :disabled="!spinnable" @click="onSpin">돌리기</button>
          <p class="muted key-hint">스페이스바로도 돌립니다.</p>
          <button type="button" class="btn undo" data-testid="undo" :disabled="busy || !s.undo" @click="onUndo">
            <Icon name="undo" />
            되돌리기
          </button>
        </div>

        <dl class="stats">
          <div>
            <dt>남은 참가자</dt>
            <dd class="num">{{ fmt(remainingPeople.length) }}명</dd>
          </div>
          <div>
            <dt>남은 경품</dt>
            <dd class="num" data-testid="prizes-left">{{ fmt(prizesLeft(s)) }}개</dd>
          </div>
        </dl>

        <table class="stock">
          <caption class="visually-hidden">경품별 남은 수량</caption>
          <thead>
            <tr>
              <th scope="col">경품</th>
              <th scope="col" class="n">남음</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in s.prizes" :key="p.id" :class="{ out: p.left === 0 }">
              <td>{{ p.name }}</td>
              <td class="n num">{{ p.left }} / {{ p.total }}</td>
            </tr>
          </tbody>
        </table>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.screen {
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-rows: var(--topbar-height) minmax(0, 1fr);
  overflow: hidden;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  padding: 0 var(--space-6);
  border-bottom: var(--border-width) solid var(--color-ink);
  background: var(--color-surface);
}

.banner {
  display: flex;
  align-items: baseline;
  gap: var(--space-5);
  min-width: 0;
}

.banner-label {
  flex: none;
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-ink-soft);
}

.banner-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-display);
  font-weight: 850;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.is-empty .banner-text {
  color: var(--color-ink-soft);
  font-weight: 600;
  font-size: var(--text-xl);
}

.is-prize .banner-text {
  color: var(--color-primary);
}

.tools {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: none;
}

.board {
  display: grid;
  grid-template-columns: var(--side-width) minmax(0, 1fr) var(--side-width);
  gap: var(--space-6);
  padding: var(--space-5) var(--space-6);
  min-height: 0;
}

.side {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.stage {
  min-width: 0;
  min-height: 0;
  display: grid;
  place-items: center;
}

.wheel-box {
  width: min(100%, calc((100dvh - var(--topbar-height) - 2 * var(--space-5)) * 1000 / 1040));
}

/* Collapsible lists */
.panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-top: var(--border-width) solid var(--color-ink);
}

.panel.open {
  flex: 1 1 0;
}

.panel-head {
  display: grid;
  grid-template-columns: 1fr auto 20px;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: 44px;
  padding: var(--space-2) 0;
  border: 0;
  background: transparent;
  font-weight: 750;
  text-align: left;
  cursor: pointer;
}

.panel-head .count {
  color: var(--color-ink-soft);
}

.chev {
  width: 20px;
  height: 20px;
  transition: transform var(--duration-fast) ease;
}

.panel-head[aria-expanded='false'] .chev {
  transform: rotate(-90deg);
}

.panel-body {
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.search {
  min-height: 36px;
  flex: none;
}

.people,
.winners {
  list-style: none;
  margin: 0;
  padding: 0;
}

.people li,
.winners li {
  border-bottom: 1px solid var(--color-line);
}

.person {
  display: block;
  width: 100%;
  padding: var(--space-1) var(--space-2);
  border: 0;
  background: transparent;
  text-align: left;
  overflow-wrap: anywhere;
}

button.person {
  cursor: pointer;
}

button.person:hover:not(:disabled) {
  background: var(--color-paper);
}

button.person:disabled {
  cursor: not-allowed;
}

.person[aria-pressed='true'],
.person.current {
  background: var(--color-ink);
  color: var(--color-surface);
  font-weight: 700;
}

.more,
.empty {
  padding: var(--space-2);
  font-size: var(--text-sm);
}

.winners li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-1) var(--space-2);
}

.winners .name {
  font-weight: 700;
  overflow-wrap: anywhere;
}

.winners .prize {
  color: var(--color-ink-soft);
  text-align: right;
}

/* Controls */
.actions {
  display: grid;
  gap: var(--space-3);
}

.spin {
  min-height: 88px;
  font-size: var(--text-xl);
  font-weight: 850;
}

.next {
  min-height: 56px;
  font-size: var(--text-lg);
}

.key-hint {
  font-size: var(--text-sm);
  margin-top: calc(-1 * var(--space-2));
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  margin: var(--space-2) 0 0;
  padding-top: var(--space-4);
  border-top: var(--border-width) solid var(--color-ink);
}

.stats dt {
  font-size: var(--text-sm);
  color: var(--color-ink-soft);
  font-weight: 700;
}

.stats dd {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: 800;
}

.stock {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.stock th {
  text-align: left;
  color: var(--color-ink-soft);
  font-weight: 700;
  padding: var(--space-1) 0;
  border-bottom: var(--border-width) solid var(--color-ink);
}

.stock td {
  padding: var(--space-1) 0;
  border-bottom: 1px solid var(--color-line);
}

.stock .n {
  text-align: right;
  white-space: nowrap;
  padding-left: var(--space-3);
}

.stock tr.out td {
  color: var(--color-ink-soft);
  text-decoration: line-through;
}

@media (max-width: 1200px) {
  .topbar,
  .board {
    padding-left: var(--space-4);
    padding-right: var(--space-4);
  }
  .board {
    gap: var(--space-4);
  }
  .tools .btn {
    padding-left: var(--space-2);
    padding-right: var(--space-2);
  }
}
</style>
