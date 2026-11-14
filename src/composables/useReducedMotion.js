import { onBeforeUnmount, ref } from 'vue'

export function useReducedMotion() {
  const reduced = ref(false)
  const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  if (mq) {
    reduced.value = mq.matches
    const onChange = (e) => (reduced.value = e.matches)
    mq.addEventListener?.('change', onChange)
    onBeforeUnmount(() => mq.removeEventListener?.('change', onChange))
  }
  return reduced
}
