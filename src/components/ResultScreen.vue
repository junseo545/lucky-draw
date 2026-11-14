<script setup>
import { computed } from 'vue'
import { useFullscreen } from '../composables/useFullscreen.js'
import { resultFileName, resultRows, toCsv } from '../lib/csv.js'
import { blanks, leftoverPrizes, prizesLeft, winners } from '../lib/draw.js'
import { resetAll, session, undo } from '../store.js'
import ConfirmReset from './ConfirmReset.vue'
import Icon from './Icon.vue'

const fullscreen = useFullscreen()
const s = computed(() => session.value)
const winnerList = computed(() => winners(s.value))
const blankList = computed(() => blanks(s.value))
const leftovers = computed(() => leftoverPrizes(s.value))
const reason = computed(() => (prizesLeft(s.value) === 0 ? '경품이 모두 나갔습니다.' : '남은 참가자가 없습니다.'))

function download() {
  const csv = toCsv(resultRows(s.value.log))
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = resultFileName()
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function fmt(n) {
  return n.toLocaleString('ko-KR')
}
</script>

<template>
  <div class="screen">
    <header class="topbar">
      <div class="title">
        <h1>결과</h1>
        <p class="muted">
          {{ reason }} 당첨 <strong class="num">{{ fmt(winnerList.length) }}</strong>명 · {{ s.blankLabel }}
          <strong class="num">{{ fmt(blankList.length) }}</strong>건
        </p>
      </div>
      <div class="tools">
        <button type="button" class="btn btn-quiet" :disabled="!s.undo" data-testid="undo" @click="undo">
          <Icon name="undo" />
          되돌리기
        </button>
        <button v-if="fullscreen.supported" type="button" class="btn btn-quiet" @click="fullscreen.toggle">
          <Icon :name="fullscreen.active.value ? 'fullscreen-exit' : 'fullscreen'" />
          {{ fullscreen.active.value ? '전체 화면 끝내기' : '전체 화면' }}
        </button>
        <button type="button" class="btn" data-testid="csv" @click="download">
          <Icon name="download" />
          CSV 내려받기
        </button>
        <ConfirmReset @confirm="resetAll" />
      </div>
    </header>

    <main class="results">
      <section class="winners" aria-labelledby="h-winners">
        <h2 id="h-winners">당첨자 <span class="num muted">{{ fmt(winnerList.length) }}</span></h2>
        <p v-if="!winnerList.length" class="muted">당첨자가 없습니다.</p>
        <table v-else class="table" data-testid="winners-table">
          <thead>
            <tr>
              <th scope="col" class="n">순서</th>
              <th scope="col">이름</th>
              <th scope="col">경품</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(w, i) in winnerList" :key="w.seq">
              <td class="n num">{{ i + 1 }}</td>
              <td class="name">{{ w.name }}</td>
              <td>{{ w.prizeName }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div class="aside">
        <section aria-labelledby="h-blanks">
          <h2 id="h-blanks">{{ s.blankLabel }} <span class="num muted">{{ fmt(blankList.length) }}</span></h2>
          <p v-if="!blankList.length" class="muted">없습니다.</p>
          <ol v-else class="blank-list" data-testid="blanks-list">
            <li v-for="b in blankList" :key="b.seq">{{ b.name }}</li>
          </ol>
        </section>

        <section v-if="leftovers.length" aria-labelledby="h-left">
          <h2 id="h-left">남은 경품</h2>
          <table class="table" data-testid="leftover-table">
            <thead>
              <tr>
                <th scope="col">경품</th>
                <th scope="col" class="n">수량</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in leftovers" :key="p.id">
                <td>{{ p.name }}</td>
                <td class="n num">{{ p.left }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.screen {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  padding: var(--space-4) var(--space-6);
  border-bottom: var(--border-width) solid var(--color-ink);
  background: var(--color-surface);
}

.title {
  display: flex;
  align-items: baseline;
  gap: var(--space-5);
  flex-wrap: wrap;
}

.tools {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.results {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: var(--space-7);
  padding: var(--space-6);
  max-width: 1400px;
  width: 100%;
}

h2 {
  margin-bottom: var(--space-3);
}

.aside {
  display: grid;
  align-content: start;
  gap: var(--space-6);
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-lg);
}

.table th {
  text-align: left;
  font-size: var(--text-sm);
  color: var(--color-ink-soft);
  font-weight: 700;
  padding: var(--space-2) var(--space-3);
  border-bottom: var(--border-width) solid var(--color-ink);
}

.table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-line);
}

.table .n {
  width: 72px;
  text-align: right;
}

.table .name {
  font-weight: 750;
}

.blank-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--text-lg);
}

@media (max-width: 1000px) {
  .results {
    grid-template-columns: 1fr;
  }
  .topbar {
    flex-wrap: wrap;
  }
}
</style>
