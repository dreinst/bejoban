'use server'
// Aksi cermin chat WhatsApp: tarik riwayat dari WAHA dan lama simpan. Khusus owner, dicek di server.
// Tidak ada aksi kirim, balas, atau hapus pesan WhatsApp di sini (panel cermin hanya baca).
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { catatAktivitas, penggunaDari } from '@/lib/stok/aktivitas'
import { bersihkan } from '@/lib/cermin/simpan'
import { pengambilWaha, tarikRiwayat } from '@/lib/cermin/tarik'
import { pencariWaha } from '@/lib/cermin/lid'

const go = (path: string, msg: string, kind: 'ok' | 'err' = 'ok'): never => {
  revalidatePath('/admin', 'layout')
  redirect(`${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`)
}

const CERMIN = '/admin/chatbot/cermin'
const PENGATURAN = '/admin/chatbot/pengaturan'
// Satu tarikan sekali jalan per proses, supaya klik berulang tidak menumpuk beban di server.
let sedangTarik = false

export async function tarikRiwayatCermin() {
  const s = await requireOwner()
  const url = process.env.WAHA_URL ?? ''
  const kunci = process.env.WAHA_API_KEY ?? ''
  if (!url || !kunci) go(CERMIN, 'Sambungan WAHA belum diisi (WAHA_URL dan WAHA_API_KEY). Hubungi pengelola sistem.', 'err')
  if (sedangTarik) go(CERMIN, 'Tarik riwayat masih berjalan. Coba lagi sebentar lagi.', 'err')
  sedangTarik = true
  let pesan: string
  let jenis: 'ok' | 'err' = 'ok'
  try {
    const session = process.env.WAHA_SESSION || 'default'
    const h = await tarikRiwayat({ ambil: pengambilWaha(url, kunci), session, cari: pencariWaha(url, kunci, session) })
    await catatAktivitas({ pengguna: penggunaDari(s), aksi: 'tarik', entitas: 'cermin_chat', data: { chat: h.chat, baru: h.baru, gagal: h.gagal, lid: h.lid } })
    pesan = `Riwayat ditarik dari ${h.chat} chat: ${h.baru} pesan baru, ${h.pesan - h.baru} sudah ada.${h.lid ? ` ${h.lid} chat lama digabung ke nomornya.` : ''}${h.gagal ? ` ${h.gagal} chat gagal dibaca.` : ''}`
  } catch (e) {
    console.error('Tarik riwayat cermin gagal:', (e as Error).message)
    pesan = 'WAHA tidak bisa dihubungi. Cek sambungan WhatsApp lalu coba lagi.'
    jenis = 'err'
  } finally {
    sedangTarik = false
  }
  go(CERMIN, pesan, jenis)
}

export async function simpanRetensiCermin(fd: FormData) {
  const s = await requireOwner()
  const n = Math.round(Number(String(fd.get('hari') ?? '').replace(/\D/g, '')))
  if (!Number.isFinite(n) || n < 7 || n > 730) go(PENGATURAN, 'Lama simpan cermin chat harus 7 sampai 730 hari.', 'err')
  await db.setting.upsert({ where: { key: 'cermin' }, create: { key: 'cermin', value: JSON.stringify({ hari: n }) }, update: { value: JSON.stringify({ hari: n }) } })
  const hasil = await bersihkan(n)
  await catatAktivitas({ pengguna: penggunaDari(s), aksi: 'simpan', entitas: 'cermin_chat', data: { hari: n, dihapus: hasil.pesan } })
  go(PENGATURAN, `Lama simpan cermin chat ${n} hari.${hasil.pesan ? ` ${hasil.pesan} pesan lama dihapus.` : ''}`)
}
