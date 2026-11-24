// Penarik riwayat (backfill) cermin chat dari API WAHA. Mengisi celah saat pertama dipasang atau sesudah webhook mati.
// Idempoten: pesan yang sudah ada dilewati (lihat simpanPesan). Jumlah chat dan pesan per tarikan dibatasi
// supaya server 1 vCPU tidak terbebani; chat diproses satu per satu.
import { db } from '../db'
import { adalahPesan, bacaPesan, chatDibuang, chatLid, pnDari, type PesanCermin } from './baca'
import { catatLid, petakanLid, type CariPn } from './lid'
import { bersihkanBilaPerlu, simpanPesan } from './simpan'

export const MAKS_CHAT = 30
export const MAKS_PESAN = 50
// Chat LID lama yang dicari satu per satu lewat API lids WAHA per tarikan (sisanya di tarikan berikutnya).
export const MAKS_CARI_LID = 20

export type HasilTarik = { chat: number; pesan: number; baru: number; gagal: number; lid: number }
type Ambil = (path: string) => Promise<unknown>

export function pengambilWaha(url: string, kunci: string): Ambil {
  const dasar = url.replace(/\/$/, '')
  return async (path) => {
    const res = await fetch(`${dasar}${path}`, { headers: { 'X-Api-Key': kunci, Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) })
    // Hanya status dan jalurnya yang disebut di galat, tanpa query atau isi jawaban.
    if (!res.ok) throw new Error(`WAHA ${res.status} di ${path.split('?')[0]}`)
    return res.json()
  }
}

export async function tarikRiwayat(o: { ambil: Ambil; session: string; cari?: CariPn; maksChat?: number; maksPesan?: number; sekarang?: Date }): Promise<HasilTarik> {
  const maksChat = Math.max(1, Math.min(o.maksChat ?? MAKS_CHAT, 100))
  const maksPesan = Math.max(1, Math.min(o.maksPesan ?? MAKS_PESAN, 200))
  const sesi = encodeURIComponent(o.session)
  const daftar = await o.ambil(`/api/${sesi}/chats/overview?limit=${maksChat}`)
  const chats = (Array.isArray(daftar) ? daftar : [])
    .map((c) => (c && typeof c === 'object' ? (c as Record<string, unknown>) : {}))
    .map((c) => ({ id: typeof c.id === 'string' ? c.id : String((c.id as { _serialized?: string })?._serialized ?? ''), nama: typeof c.name === 'string' ? c.name.trim().slice(0, 120) : '' }))
    .filter((c) => c.id && !chatDibuang(c.id))
    .slice(0, maksChat)
  const hasil: HasilTarik = { chat: 0, pesan: 0, baru: 0, gagal: 0, lid: 0 }
  for (const c of chats) {
    let isi: unknown
    try {
      isi = await o.ambil(`/api/${sesi}/chats/${encodeURIComponent(c.id)}/messages?limit=${maksPesan}&downloadMedia=false`)
    } catch {
      hasil.gagal++
      continue
    }
    // Pesan dari chat bernomor bisa membawa id chat LID; nomornya diketahui dari chat yang sedang dibaca.
    const nomorChat = pnDari(c.id)
    const pesan: PesanCermin[] = (Array.isArray(isi) ? isi : [])
      .slice(0, maksPesan)
      .map((m) => bacaPesan(m, o.sekarang))
      .filter(adalahPesan)
      .map((p) => (nomorChat && !p.grup && chatLid(p.chatId) && !p.chatAlt ? { ...p, chatAlt: nomorChat } : p))
    // Id chat di pesan mengikuti WAHA; nama dari daftar chat dipakai untuk chat yang sama.
    const nama = new Map(c.nama ? [[c.id, c.nama], ...pesan.map((p): [string, string] => [p.chatId, c.nama])] : [])
    const { baru } = await simpanPesan(pesan, nama, o.cari)
    hasil.chat++
    hasil.pesan += pesan.length
    hasil.baru += baru
  }
  hasil.lid = await gabungLidLama(o.ambil, sesi, o.cari)
  await bersihkanBilaPerlu(o.sekarang)
  return hasil
}

// Chat yang masih tersimpan dengan id LID (pesan lama sebelum pemetaan ada) digabung ke nomornya.
// Satu permintaan daftar lids WAHA dulu, lalu paling banyak MAKS_CARI_LID pencarian satu per satu.
async function gabungLidLama(ambil: Ambil, sesi: string, cari?: CariPn): Promise<number> {
  const sisa = (await db.waChat.findMany({ where: { grup: false, chatId: { endsWith: '@lid' } }, select: { chatId: true }, take: 200 })).map((c) => c.chatId)
  if (!sisa.length) return 0
  const butuh = new Set(sisa)
  let digabung = 0
  try {
    const daftar = await ambil(`/api/${sesi}/lids?limit=1000`)
    for (const r of Array.isArray(daftar) ? daftar : []) {
      const lidMentah = String((r as { lid?: unknown })?.lid ?? '')
      const lid = lidMentah && !lidMentah.includes('@') ? `${lidMentah}@lid` : lidMentah
      const pn = pnDari((r as { pn?: unknown })?.pn)
      if (!butuh.has(lid) || !pn) continue
      await catatLid(lid, pn)
      butuh.delete(lid)
      digabung++
    }
  } catch {
    // Daftar lids tidak tersedia: lanjut ke pencarian satu per satu.
  }
  if (butuh.size && cari) digabung += (await petakanLid([...butuh].slice(0, MAKS_CARI_LID), new Map(), cari)).size
  return digabung
}
