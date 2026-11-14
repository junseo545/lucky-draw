<script setup>
import { nextTick, ref } from 'vue'
import { normalizeQty, parsePrizeLines } from '../lib/prizes.js'
import { newPrizeRow } from '../store.js'
import Icon from './Icon.vue'

const rows = defineModel({ type: Array, required: true })

const listEl = ref(null)
const dragId = ref(null)

function add() {
  rows.value.push(newPrizeRow())
  focusRow(rows.value.length - 1)
}

function remove(index) {
  rows.value.splice(index, 1)
  if (!rows.value.length) rows.value.push(newPrizeRow())
}

function focusRow(index) {
  nextTick(() => listEl.value?.querySelectorAll('input[data-role="name"]')[index]?.focus())
}

function move(from, to) {
  if (to < 0 || to >= rows.value.length || from === to) return
  const [row] = rows.value.splice(from, 1)
  rows.value.splice(to, 0, row)
}

/* Multi-line paste into a name field becomes several rows. */
function onPaste(event, index) {
  const text = event.clipboardData?.getData('text') ?? ''
  if (!/[\r\n\t]/.test(text.trim())) return
  const parsed = parsePrizeLines(text)
  if (!parsed.length) return
  event.preventDefault()
  const fresh = parsed.map((p) => newPrizeRow(p.name, p.qty))
  const replaceCurrent = !String(rows.value[index].name).trim()
  rows.value.splice(index, replaceCurrent ? 1 : 0, ...fresh)
  focusRow(index + fresh.length - (replaceCurrent ? 1 : 0))
}

function onQtyBlur(row) {
  row.qty = normalizeQty(row.qty)
}

/* Drag to reorder with pointer events (mouse, pen and touch). */
function onHandleDown(event, row) {
  if (event.button !== undefined && event.button !== 0) return
  event.preventDefault()
  dragId.value = row.id

  const onMove = (e) => {
    const els = [...listEl.value.querySelectorAll('[data-row]')]
    const from = rows.value.findIndex((r) => r.id === dragId.value)
    let to = from
    for (let i = 0; i < els.length; i += 1) {
      const box = els[i].getBoundingClientRect()
      const mid = box.top + box.height / 2
      if (i < from && e.clientY < mid) {
        to = i
        break
      }
      if (i > from && e.clientY > mid) to = i
    }
    move(from, to)
  }
  // Listen on window: the row's DOM node moves while dragging.
  const onUp = () => {
    dragId.value = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}

function onHandleKey(event, index) {
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault()
    const to = index + (event.key === 'ArrowUp' ? -1 : 1)
    move(index, to)
    nextTick(() => listEl.value?.querySelectorAll('[data-role="handle"]')[Math.max(0, Math.min(rows.value.length - 1, to))]?.focus())
  }
}
</script>

<template>
  <div class="prizes">
    <div class="head" aria-hidden="true">
      <span></span>
      <span class="label">경품 이름</span>
      <span class="label">수량</span>
      <span></span>
    </div>
    <ol ref="listEl" class="rows" data-testid="prize-rows">
      <li v-for="(row, i) in rows" :key="row.id" data-row :class="{ dragging: dragId === row.id }">
        <button
          type="button"
          class="handle"
          data-role="handle"
          :aria-label="`${i + 1}번째 경품 순서 바꾸기. 위아래 화살표로 이동`"
          @pointerdown="onHandleDown($event, row)"
          @keydown="onHandleKey($event, i)"
        >
          <Icon name="grip" />
        </button>
        <input
          v-model="row.name"
          class="field"
          data-role="name"
          type="text"
          :aria-label="`${i + 1}번째 경품 이름`"
          placeholder="예: 에어팟 프로"
          maxlength="40"
          @paste="onPaste($event, i)"
          @keydown.enter.prevent="i === rows.length - 1 ? add() : focusRow(i + 1)"
        />
        <input
          v-model.number="row.qty"
          class="field qty num"
          data-role="qty"
          type="number"
          inputmode="numeric"
          min="1"
          max="9999"
          step="1"
          :aria-label="`${i + 1}번째 경품 수량`"
          @blur="onQtyBlur(row)"
        />
        <button type="button" class="btn btn-quiet btn-icon" :aria-label="`${i + 1}번째 경품 삭제`" @click="remove(i)">
          <Icon name="remove" />
        </button>
      </li>
    </ol>
    <button type="button" class="btn add" @click="add">
      <Icon name="add" />
      경품 추가
    </button>
  </div>
</template>

<style scoped>
.head,
.rows li {
  display: grid;
  grid-template-columns: 36px 1fr 88px 44px;
  gap: var(--space-2);
  align-items: center;
}

.head .label {
  margin-bottom: 0;
}

.rows {
  list-style: none;
  margin: var(--space-2) 0 var(--space-3);
  padding: 0;
  display: grid;
  gap: var(--space-2);
}

.rows li.dragging {
  background: var(--color-paper);
  outline: var(--border-width) dashed var(--color-ink);
  outline-offset: 2px;
}

.handle {
  display: grid;
  place-items: center;
  width: 36px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--color-ink-soft);
  cursor: grab;
  touch-action: none;
}

.handle:active {
  cursor: grabbing;
}

.handle svg {
  width: 20px;
  height: 20px;
}

.qty {
  text-align: right;
}

.add {
  width: 100%;
  border-style: dashed;
}
</style>
