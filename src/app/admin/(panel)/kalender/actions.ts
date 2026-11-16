'use server'
// Aksi halaman kalender (hari libur dan promo). Hanya owner, divalidasi di server.
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { catatAktivitas, penggunaDari } from '@/lib/stok/aktivitas'
import { JENIS_KALENDER, tanggalKalenderSah } from '@/lib/stok/kalender'

const PAGE = '/admin/kalender'
const go = (msg: string, kind: 'ok' | 'err' = 'ok'): never => {
  revalidatePath(PAGE)
  redirect(`${PAGE}?${kind}=${encodeURIComponent(msg)}`)
}

export async function addKalender(fd: FormData) {
  const s = await requireOwner()
  const tanggal = String(fd.get('tanggal') ?? '').trim()
  const jenis = String(fd.get('jenis') ?? '')
  const keterangan = String(fd.get('keterangan') ?? '').trim().slice(0, 200)
  if (!tanggalKalenderSah(tanggal)) go('Tanggal tidak valid', 'err')
  if (!(JENIS_KALENDER as readonly string[]).includes(jenis)) go('Jenis harus libur, promo, atau lainnya', 'err')
  if (!keterangan) go('Keterangan wajib diisi', 'err')
  const row = await db.kalender.create({ data: { tanggal, jenis, keterangan } })
  await catatAktivitas({ pengguna: penggunaDari(s), aksi: 'tambah', entitas: 'kalender', data: { id: row.id, tanggal, jenis } })
  go('Tanggal tersimpan')
}

export async function deleteKalender(fd: FormData) {
  const s = await requireOwner()
  const id = Math.max(0, Math.round(Number(fd.get('id')) || 0))
  const { count } = await db.kalender.deleteMany({ where: { id } })
  if (count) await catatAktivitas({ pengguna: penggunaDari(s), aksi: 'hapus', entitas: 'kalender', data: { id } })
  go(count ? 'Tanggal dihapus' : 'Tanggal tidak ditemukan', count ? 'ok' : 'err')
}
