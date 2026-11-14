// All randomness in the app goes through this module and uses the Web Crypto API.

const UINT32_RANGE = 0x100000000

function cryptoSource() {
  const c = globalThis.crypto
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('crypto.getRandomValues is not available')
  }
  return c
}

/** Uniform 32-bit unsigned integer. */
export function randomUint32() {
  const buf = new Uint32Array(1)
  cryptoSource().getRandomValues(buf)
  return buf[0]
}

/**
 * Uniform integer in [0, n). Rejection sampling removes modulo bias.
 * @param {number} n positive integer, at most 2^32
 */
export function randomInt(n) {
  if (!Number.isInteger(n) || n <= 0 || n > UINT32_RANGE) {
    throw new RangeError(`randomInt: invalid upper bound ${n}`)
  }
  const limit = UINT32_RANGE - (UINT32_RANGE % n)
  let x
  do {
    x = randomUint32()
  } while (x >= limit)
  return x % n
}

/** Uniform float in [0, 1) with 53 bits of precision. */
export function randomFloat() {
  const hi = randomUint32() >>> 5 // 27 bits
  const lo = randomUint32() >>> 6 // 26 bits
  return (hi * 67108864 + lo) / 9007199254740992
}

/** Uniform float in [min, max). */
export function randomBetween(min, max) {
  return min + (max - min) * randomFloat()
}

/** Uniformly chosen element of a non-empty array. */
export function randomPick(items) {
  if (!items.length) throw new RangeError('randomPick: empty list')
  return items[randomInt(items.length)]
}
