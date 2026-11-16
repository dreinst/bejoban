// Label WhatsApp Business per cabang lewat WAHA. Modul murni: hanya membentuk permintaan, tidak mengirim apa pun.
// Pengirimnya ada di scripts/bot-wa.ts. Endpoint mengikuti dokumentasi WAHA (https://waha.devlike.pro/docs/how-to/labels/,
// dibaca 16 November 2026), didukung engine WEBJS, WPP, NOWEB, dan GOWS.
//
// Urutan: daftar label (cari label cabang menurut nama), buat label kalau belum ada, baca label chat,
// lalu PUT daftar label chat. PUT mengganti SELURUH label chat, jadi label lain yang dipasang admin dipertahankan
// dan hanya label cabang lain (mis. "Karanglo" saat chat pindah ke "Batu") yang dilepas.

export type LabelWaha = { id: string; name: string; color?: number; colorHex?: string }
export type Langkah = { method: 'GET' | 'POST' | 'PUT'; path: string; body?: unknown; ket: string }

// Warna label per cabang (nomor palet WAHA 0 sampai 19). Cabang lain memakai warna netral.
const WARNA: Record<string, number> = { batu: 1, karanglo: 5 }
export const warnaLabel = (slug: string) => WARNA[slug] ?? 4

const s = (session: string) => encodeURIComponent(session)
const sama = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export const cariLabel = (labels: LabelWaha[], nama: string) => labels.find((l) => sama(l.name, nama)) ?? null

export const mintaDaftarLabel = (session: string): Langkah => ({ method: 'GET', path: `/api/${s(session)}/labels`, ket: 'daftar label' })

export const mintaBuatLabel = (session: string, nama: string, slug: string): Langkah => ({
  method: 'POST',
  path: `/api/${s(session)}/labels`,
  body: { name: nama, color: warnaLabel(slug) },
  ket: `buat label "${nama}"`,
})

export const mintaLabelChat = (session: string, chatId: string): Langkah => ({
  method: 'GET',
  path: `/api/${s(session)}/labels/chats/${encodeURIComponent(chatId)}/`,
  ket: 'label chat sekarang',
})

// Daftar label baru untuk chat: label sekarang tanpa label cabang lain, ditambah label cabang tujuan.
// null kalau tidak ada yang berubah (label sudah terpasang dan tidak ada label cabang lain).
export function labelBaruChat(sekarang: LabelWaha[], idTujuan: string, idCabangLain: string[]): { id: string }[] | null {
  const lepas = new Set(idCabangLain.filter((id) => id !== idTujuan))
  const tetap = sekarang.filter((l) => !lepas.has(l.id))
  const sudah = tetap.some((l) => l.id === idTujuan)
  if (sudah && tetap.length === sekarang.length) return null
  return [...tetap.map((l) => ({ id: l.id })), ...(sudah ? [] : [{ id: idTujuan }])]
}

export const mintaPasangLabel = (session: string, chatId: string, labels: { id: string }[], nama: string): Langkah => ({
  method: 'PUT',
  path: `/api/${s(session)}/labels/chats/${encodeURIComponent(chatId)}/`,
  body: { labels },
  ket: `pasang label "${nama}"`,
})

// Seluruh langkah untuk dicetak di mode uji kering, tanpa memanggil WAHA. Id yang belum diketahui ditulis sebagai
// penanda <id label ...>. idDiketahui berisi id label yang sudah tersimpan di memori worker (kunci: nama kecil).
export function rencanaLabelKering(p: { session: string; chatId: string; nama: string; slug: string; idDiketahui?: Record<string, string> }): Langkah[] {
  const id = p.idDiketahui?.[p.nama.toLowerCase()]
  return [
    ...(id ? [] : [mintaDaftarLabel(p.session), { ...mintaBuatLabel(p.session, p.nama, p.slug), ket: `buat label "${p.nama}" kalau belum ada di daftar` }]),
    mintaLabelChat(p.session, p.chatId),
    mintaPasangLabel(p.session, p.chatId, [{ id: '<label lain chat ini, kecuali label cabang lain>' }, { id: id ?? `<id label ${p.nama}>` }], p.nama),
  ]
}
