import { onBeforeUnmount, onMounted, ref } from 'vue'

function currentElement() {
  return document.fullscreenElement ?? document.webkitFullscreenElement ?? null
}

export function useFullscreen() {
  const active = ref(false)
  const supported = typeof document !== 'undefined' && !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)
  const sync = () => (active.value = !!currentElement())

  onMounted(() => {
    sync()
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', sync)
    document.removeEventListener('webkitfullscreenchange', sync)
  })

  async function toggle() {
    try {
      if (currentElement()) {
        await (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.())
      } else {
        const el = document.documentElement
        await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())
      }
    } catch {
      // Refused by the browser (no user gesture, iframe policy). Nothing to do.
    }
    sync()
  }

  return { active, supported, toggle }
}
