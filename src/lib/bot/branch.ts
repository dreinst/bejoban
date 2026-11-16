// Mengenali cabang dari kalimat pembuka tombol situs, mis. "Halo kak Bejo Ban Karanglo, ...".
export type BotBranch = { slug: string; name: string; aliases?: string[] }

const label = (name: string) => name.replace(/\s*\(.*\)\s*/, '').trim().toLowerCase()
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const has = (text: string, phrase: string) => !!phrase && new RegExp(`(?<![a-z0-9])${esc(phrase)}(?![a-z0-9])`).test(text)

// Kata cabang dikenali di mana pun dalam pesan, tidak hanya di kalimat pembuka.
// Urutan: nama lengkap cabang ("bejo ban batu"), lalu kata kunci tunggal (slug dan kata terakhir nama).
// Kalau lebih dari satu cabang cocok pada tahap yang sama, hasilnya null (tidak ditebak).
export function detectBranch<T extends BotBranch>(text: string, branches: T[]): T | null {
  const t = text.toLowerCase().replace(/\s+/g, ' ')
  const full = branches.filter((b) => has(t, label(b.name)))
  if (full.length === 1) return full[0]
  if (full.length > 1) return null
  const word = (b: T) => [b.slug.toLowerCase(), label(b.name).split(' ').pop() ?? '', ...(b.aliases ?? []).map((a) => a.toLowerCase())]
  const loose = branches.filter((b) => word(b).some((w) => has(t, w)))
  return loose.length === 1 ? loose[0] : null
}
