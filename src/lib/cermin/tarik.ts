// Penarik riwayat (backfill) cermin chat dari API WAHA. Mengisi celah saat pertama dipasang atau sesudah webhook mati.
// Idempoten: pesan yang sudah ada dilewati (lihat simpanPesan). Jumlah chat dan pesan per tarikan dibatasi
// supaya server 1 vCPU tidak terbebani; chat diproses satu per satu.
import { adalahPesan, bacaPesan, chatDibuang, type PesanCermin } from './baca'
import { bersihkanBilaPerlu, simpanPesan } from './simpan'

export const MAKS_CHAT = 30
export const MAKS_PESAN = 50

export type HasilTarik = { chat: number; pesan: number; baru: number; gagal: number }
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

export async function tarikRiwayat(o: { ambil: Ambil; session: string; maksChat?: number; maksPesan?: number; sekarang?: Date }): Promise<HasilTarik> {
  const maksChat = Math.max(1, Math.min(o.maksChat ?? MAKS_CHAT, 100))
  const maksPesan = Math.max(1, Math.min(o.maksPesan ?? MAKS_PESAN, 200))
  const sesi = encodeURIComponent(o.session)
  const daftar = await o.ambil(`/api/${sesi}/chats/overview?limit=${maksChat}`)
  const chats = (Array.isArray(daftar) ? daftar : [])
    .map((c) => (c && typeof c === 'object' ? (c as Record<string, unknown>) : {}))
    .map((c) => ({ id: typeof c.id === 'string' ? c.id : String((c.id as { _serialized?: string })?._serialized ?? ''), nama: typeof c.name === 'string' ? c.name.trim().slice(0, 120) : '' }))
    .filter((c) => c.id && !chatDibuang(c.id))
    .slice(0, maksChat)
  const hasil: HasilTarik = { chat: 0, pesan: 0, baru: 0, gagal: 0 }
  for (const c of chats) {
    let isi: unknown
    try {
      isi = await o.ambil(`/api/${sesi}/chats/${encodeURIComponent(c.id)}/messages?limit=${maksPesan}&downloadMedia=false`)
    } catch {
      hasil.gagal++
      continue
    }
    const pesan: PesanCermin[] = (Array.isArray(isi) ? isi : []).slice(0, maksPesan).map((m) => bacaPesan(m, o.sekarang)).filter(adalahPesan)
    // Id chat di pesan mengikuti WAHA; nama dari daftar chat dipakai untuk chat yang sama.
    const nama = new Map(c.nama ? [[c.id, c.nama], ...pesan.map((p): [string, string] => [p.chatId, c.nama])] : [])
    const { baru } = await simpanPesan(pesan, nama)
    hasil.chat++
    hasil.pesan += pesan.length
    hasil.baru += baru
  }
  await bersihkanBilaPerlu(o.sekarang)
  return hasil
}
