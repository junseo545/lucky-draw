<script setup>
import { nextTick, ref } from 'vue'

defineProps({ disabled: { type: Boolean, default: false } })
const emit = defineEmits(['confirm'])

const open = ref(false)
const cancelBtn = ref(null)
const triggerBtn = ref(null)

function ask() {
  open.value = true
  nextTick(() => cancelBtn.value?.focus())
}

function close() {
  open.value = false
  nextTick(() => triggerBtn.value?.focus())
}

function confirm() {
  open.value = false
  emit('confirm')
}
</script>

<template>
  <div class="reset">
    <button ref="triggerBtn" type="button" class="btn" :disabled="disabled" :aria-expanded="open" @click="open ? close() : ask()">처음부터</button>
    <div v-if="open" class="confirm" role="alertdialog" aria-labelledby="reset-title" @keydown.esc="close">
      <p id="reset-title"><strong>진행 기록을 모두 지웁니다.</strong></p>
      <p class="muted">입력한 참가자와 경품은 설정 화면에 남습니다.</p>
      <div class="actions">
        <button ref="cancelBtn" type="button" class="btn" @click="close">취소</button>
        <button type="button" class="btn btn-primary" data-testid="reset-confirm" @click="confirm">초기화</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reset {
  position: relative;
}

.confirm {
  position: absolute;
  top: calc(100% + var(--space-2));
  right: 0;
  z-index: 10;
  width: 300px;
  padding: var(--space-4);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius);
  background: var(--color-surface);
  box-shadow: var(--shadow);
  display: grid;
  gap: var(--space-2);
}

.confirm .muted {
  font-size: var(--text-sm);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
</style>
