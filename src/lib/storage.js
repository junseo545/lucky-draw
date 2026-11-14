// localStorage wrapper that never throws. In private browsing or when storage
// is blocked, reads return null and writes are dropped; the app keeps working.

export const STORAGE_KEY = 'lucky-draw:v1'

function resolve(getStorage) {
  try {
    const s = getStorage()
    return s && typeof s.getItem === 'function' ? s : null
  } catch {
    return null
  }
}

export function createStore(getStorage = () => globalThis.localStorage, key = STORAGE_KEY) {
  let available = null

  function probe() {
    const s = resolve(getStorage)
    if (!s) return false
    try {
      const k = `${key}:probe`
      s.setItem(k, '1')
      s.removeItem(k)
      return true
    } catch {
      return false
    }
  }

  return {
    get available() {
      if (available === null) available = probe()
      return available
    },
    load() {
      const s = resolve(getStorage)
      if (!s) return null
      try {
        const raw = s.getItem(key)
        return raw ? JSON.parse(raw) : null
      } catch {
        return null
      }
    },
    save(value) {
      const s = resolve(getStorage)
      if (!s) return false
      try {
        s.setItem(key, JSON.stringify(value))
        return true
      } catch {
        available = false
        return false
      }
    },
    clear() {
      const s = resolve(getStorage)
      if (!s) return
      try {
        s.removeItem(key)
      } catch {
        // ignore
      }
    },
  }
}
