<script setup>
import { computed } from 'vue'
import { setup, setupSummary, startDraw, storageAvailable } from '../store.js'
import PrizeList from './PrizeList.vue'

const summary = computed(() => setupSummary())
const count = computed(() => summary.value.participants.names.length)
const renamed = computed(() => summary.value.participants.renamed)
const prizeTypes = computed(() => summary.value.prizes.prizes.length)
const prizeTotal = computed(() => summary.value.prizes.total)

const RENAMED_SHOWN = 8

function fmt(n) {
  return n.toLocaleString('ko-KR')
}
</script>

<template>
  <div class="screen">
    <header class="topbar">
      <h1>럭키드로우</h1>
      <ol class="steps" aria-label="진행 단계">
        <li aria-current="step">설정</li>
        <li>추첨</li>
        <li>결과</li>
      </ol>
    </header>

    <main class="setup">
      <section class="col" aria-labelledby="h-participants">
        <h2 id="h-participants">참가자</h2>

        <div class="choice" role="radiogroup" aria-label="참가자 입력 방식">
          <label><input v-model="setup.inputMode" type="radio" name="inputMode" value="names" />이름 입력</label>
          <label><input v-model="setup.inputMode" type="radio" name="inputMode" value="range" />번호 생성</label>
        </div>

        <div v-if="setup.inputMode === 'names'" class="block">
          <label class="label" for="names">한 줄에 한 명. 엑셀이나 카톡에서 복사해 붙여넣을 수 있습니다.</label>
          <textarea
            id="names"
            v-model="setup.namesText"
            class="field names"
            rows="14"
            spellcheck="false"
            placeholder="김민수&#10;이영희&#10;박지훈"
            data-testid="names-input"
          ></textarea>
        </div>

        <div v-else class="block range">
          <div>
            <label class="label" for="range-start">시작 번호</label>
            <input id="range-start" v-model="setup.rangeStart" class="field num" type="number" inputmode="numeric" step="1" />
          </div>
          <span class="tilde" aria-hidden="true">~</span>
          <div>
            <label class="label" for="range-end">끝 번호</label>
            <input id="range-end" v-model="setup.rangeEnd" class="field num" type="number" inputmode="numeric" step="1" placeholder="120" />
          </div>
        </div>

        <p class="total" data-testid="participant-count">
          총 <strong class="num">{{ fmt(count) }}</strong>명
        </p>
        <p v-if="summary.participants.error && setup.inputMode === 'range' && String(setup.rangeEnd).trim()" class="error-text">
          {{ summary.participants.error }}
        </p>
        <div v-if="renamed.length" class="notice" data-testid="dedupe-notice">
          <p>같은 이름이 있어 {{ fmt(renamed.length) }}명에게 번호를 붙였습니다.</p>
          <p class="renamed">
            <span v-for="r in renamed.slice(0, RENAMED_SHOWN)" :key="r.to">{{ r.to }}</span>
            <span v-if="renamed.length > RENAMED_SHOWN">외 {{ fmt(renamed.length - RENAMED_SHOWN) }}명</span>
          </p>
        </div>
      </section>

      <section class="col" aria-labelledby="h-prizes">
        <h2 id="h-prizes">경품</h2>
        <p class="muted hint">위에서부터 원판에 시계 방향으로 놓입니다. 왼쪽 손잡이를 끌어 순서를 바꿉니다.</p>
        <PrizeList v-model="setup.prizes" />
        <p class="total" data-testid="prize-total">
          {{ fmt(prizeTypes) }}종류 · 총 <strong class="num">{{ fmt(prizeTotal) }}</strong>개
        </p>
        <p v-for="d in summary.prizes.duplicates" :key="d" class="error-text">같은 이름의 경품이 있습니다: {{ d }}</p>

        <h2 class="sub">진행 방식</h2>
        <div class="options">
          <div>
            <label class="label" for="blank-label">꽝 칸 이름</label>
            <input id="blank-label" v-model="setup.blankLabel" class="field" type="text" maxlength="16" placeholder="꽝" />
          </div>
          <div>
            <span class="label" id="l-blank">꽝이 나오면</span>
            <div class="choice" role="radiogroup" aria-labelledby="l-blank">
              <label><input v-model="setup.blankPolicy" type="radio" name="blankPolicy" value="exclude" />명단에서 제외</label>
              <label><input v-model="setup.blankPolicy" type="radio" name="blankPolicy" value="keep" />기회 유지</label>
            </div>
          </div>
          <div>
            <span class="label" id="l-turn">차례 정하기</span>
            <div class="choice" role="radiogroup" aria-labelledby="l-turn">
              <label><input v-model="setup.turnMode" type="radio" name="turnMode" value="random" />랜덤 호출</label>
              <label><input v-model="setup.turnMode" type="radio" name="turnMode" value="manual" />직접 선택</label>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer class="startbar">
      <div class="messages">
        <p class="summary">
          참가자 <strong class="num">{{ fmt(count) }}</strong>명 · 경품 <strong class="num">{{ fmt(prizeTotal) }}</strong>개 · 원판
          <strong class="num">{{ prizeTypes + 1 }}</strong>칸
        </p>
        <p v-if="summary.oversupply" class="notice" data-testid="oversupply">
          경품 {{ fmt(prizeTotal) }}개가 참가자 {{ fmt(count) }}명보다 많습니다. 경품이 남을 수 있습니다.
        </p>
        <p v-else-if="!summary.canStart" class="muted">{{ summary.problems[0] }}</p>
        <p v-if="!storageAvailable" class="muted">이 브라우저에서는 진행 상황이 저장되지 않습니다. 새로고침하면 처음부터 다시 해야 합니다.</p>
      </div>
      <button type="button" class="btn btn-primary start" :disabled="!summary.canStart" data-testid="start" @click="startDraw">
        추첨 시작
      </button>
    </footer>
  </div>
</template>

<style scoped>
.screen {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr auto;
}

.topbar {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-4) var(--space-6);
  border-bottom: var(--border-width) solid var(--color-ink);
}

.steps {
  display: flex;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
  font-weight: 700;
  color: var(--color-ink-soft);
}

.steps li + li::before {
  content: '';
  display: inline-block;
  width: 24px;
  height: var(--border-width);
  margin-right: var(--space-2);
  vertical-align: middle;
  background: var(--color-line);
}

.steps li[aria-current] {
  color: var(--color-ink);
}

.setup {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-7);
  max-width: 1200px;
  width: 100%;
  padding: var(--space-6);
}

.col {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  align-items: flex-start;
}

.col > * {
  width: 100%;
}

.col > .choice {
  width: auto;
}

.sub {
  margin-top: var(--space-5);
  padding-top: var(--space-5);
  border-top: var(--border-width) solid var(--color-line);
}

.hint {
  font-size: var(--text-sm);
}

.names {
  min-height: 320px;
}

.range {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: end;
  gap: var(--space-3);
  max-width: 420px;
}

.tilde {
  padding-bottom: var(--space-2);
  font-size: var(--text-lg);
  font-weight: 700;
}

.total {
  font-size: var(--text-lg);
}

.renamed {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  margin-top: var(--space-1);
  font-weight: 600;
}

.options {
  display: grid;
  gap: var(--space-4);
}

.options .field {
  max-width: 280px;
}

.startbar {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  padding: var(--space-4) var(--space-6);
  border-top: var(--border-width) solid var(--color-ink);
  background: var(--color-surface);
}

.messages {
  display: grid;
  gap: var(--space-1);
}

.summary {
  font-size: var(--text-lg);
}

.start {
  min-width: 200px;
  min-height: 56px;
  font-size: var(--text-lg);
}

@media (max-width: 900px) {
  .setup {
    grid-template-columns: 1fr;
    gap: var(--space-6);
    padding: var(--space-5);
  }
  .topbar,
  .startbar {
    padding-left: var(--space-5);
    padding-right: var(--space-5);
  }
}
</style>
