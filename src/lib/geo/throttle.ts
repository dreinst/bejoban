// Aturan pakai layanan peta publik: permintaan diserialkan dengan jeda minimal (Nominatim: 1 per detik).
let chain: Promise<unknown> = Promise.resolve()
let last = 0
export const GAP_MS = 1100

export function throttled<T>(fn: () => Promise<T>, gapMs = GAP_MS): Promise<T> {
  const run = chain.then(async () => {
    const wait = last + gapMs - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    try {
      return await fn()
    } finally {
      last = Date.now()
    }
  })
  chain = run.catch(() => null)
  return run
}
