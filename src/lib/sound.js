// Optional click sound for pins passing the pointer, synthesized with Web Audio.
// Off by default; the AudioContext is only created after the host turns it on.

let ctx = null
let lastTick = 0

function audio() {
  if (ctx) return ctx
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext
  if (!AC) return null
  try {
    ctx = new AC()
  } catch {
    ctx = null
  }
  return ctx
}

/** Call from a click handler so browsers allow audio. */
export function unlockAudio() {
  const a = audio()
  if (a && a.state === 'suspended') a.resume().catch(() => {})
}

export function tick(strength = 1) {
  const a = audio()
  if (!a || a.state !== 'running') return
  const now = a.currentTime
  if (now - lastTick < 0.025) return
  lastTick = now
  const osc = a.createOscillator()
  const gain = a.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(1500, now)
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.03)
  gain.gain.setValueAtTime(0.06 * strength, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04)
  osc.connect(gain).connect(a.destination)
  osc.start(now)
  osc.stop(now + 0.05)
}
