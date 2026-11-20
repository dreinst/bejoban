'use server'
// Aksi kasir. Semua cek sesi dan peran di server; aturan bisnisnya di src/lib/kasir.
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireOwner, requireUser } from '@/lib/auth'
import { catatAktivitas, penggunaDari } from '@/lib/stok/aktivitas'
import { GalatKasir } from '@/lib/kasir/logika'
import { aktifkanKasir, aturBatasMinimum, koreksiStok, ubahHargaBatch, type SumberStok } from '@/lib/kasir/stok'
import { bacaInputJual, GalatStokKurang, jual, putuskanPengajuan, voidTransaksi, type StokLain } from '@/lib/kasir/transaksi'
import { siarkan } from '@/lib/kasir/siaran'
import { bacaInputBarangMasuk, catatBarangMasuk, putuskanRestock } from '@/lib/kasir/masuk'
import { finalkanOpname, hapusBarisOpname, hapusOpname, isiBarisOpname, mulaiOpname, ubahStatusOpname } from '@/lib/kasir/opname'

const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? '').trim().slice(0, max)
const angka = (fd: FormData, k: string) => {
  const t = str(fd, k, 15).replace(/\D/g, '')
  return t ? Number(t) : null
}
const go = (path: string, msg: string, kind: 'ok' | 'err' = 'ok'): never => {
  revalidatePath('/admin', 'layout')
  redirect(`${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`)
}
const aman = (path: string, cadangan: string) => (/^\/admin\/[\w/?=&%.-]*$/.test(path) && !path.startsWith('//') ? path : cadangan)
const sumberDari = (fd: FormData): SumberStok => (str(fd, 'sumber', 10) === 'produk' ? 'produk' : 'ban')

export type HasilBayar = { ok: true; id: number; nomor: string } | { ok: false; pesan: string; nama?: string; stokLain?: StokLain[] }

// Dipanggil layar kasir. Harga dihitung ulang di server dari batch.
export async function bayarKasir(raw: unknown): Promise<HasilBayar> {
  const s = await requireUser()
  try {
    const h = await jual(s, bacaInputJual(raw))
    revalidatePath('/admin', 'layout')
    return { ok: true, id: h.id, nomor: h.nomor }
  } catch (e) {
    if (e instanceof GalatStokKurang) return { ok: false, pesan: e.message, nama: e.nama, stokLain: e.stokLain }
    if (e instanceof GalatKasir) return { ok: false, pesan: e.message }
    console.error('bayarKasir gagal', e)
    return { ok: false, pesan: 'Transaksi gagal disimpan. Stok tidak berubah. Coba lagi.' }
  }
}

export async function voidKasir(fd: FormData) {
  const s = await requireUser()
  const id = Number(str(fd, 'id', 12)) || 0
  const balik = `/admin/nota/${id}`
  try {
    const h = await voidTransaksi(s, { transaksiId: id, alasan: str(fd, 'alasan', 200) })
    go(balik, `${h.nomor} di-void, stok sudah dikembalikan`)
  } catch (e) {
    if (e instanceof GalatKasir) go(balik, e.message, 'err')
    throw e
  }
}

const PENGAJUAN = '/admin/kasir/pengajuan'

export async function putuskanDiskon(fd: FormData) {
  const s = await requireOwner()
  const keputusan = str(fd, 'keputusan', 12) === 'ditolak' ? 'ditolak' : 'disetujui'
  try {
    const h = await putuskanPengajuan(s, { id: Number(str(fd, 'id', 12)) || 0, keputusan })
    go(PENGAJUAN, `Diskon ${h.nomor} ${keputusan}`)
  } catch (e) {
    if (e instanceof GalatKasir) go(PENGAJUAN, e.message, 'err')
    throw e
  }
}

const PENGATURAN = '/admin/kasir/pengaturan'

export async function aktifkanKasirAksi(fd: FormData) {
  const s = await requireOwner()
  if (fd.get('yakin') !== 'on') go(PENGATURAN, 'Centang pernyataan dulu', 'err')
  const cabangId = Number(str(fd, 'cabang', 12)) || 0
  try {
    const h = await aktifkanKasir({ cabangId, kodeNota: str(fd, 'kodeNota', 5), pengguna: penggunaDari(s) })
    await catatAktivitas({ pengguna: penggunaDari(s), aksi: 'aktifkan_kasir', entitas: 'cabang', data: { cabangId, kodeNota: h.kodeNota, batch: h.batch, ban: h.ban, produk: h.produk } })
    siarkan({ jenis: 'stok', cabangId })
    go(PENGATURAN, `Kasir aktif di ${h.cabang}. ${h.batch} batch awal dibuat.`)
  } catch (e) {
    if (e instanceof GalatKasir) go(PENGATURAN, e.message, 'err')
    throw e
  }
}

const barangUrl = (sumber: SumberStok, id: number) => `/admin/kasir/barang?sumber=${sumber}&id=${id}`

export async function koreksiStokAksi(fd: FormData) {
  const s = await requireOwner()
  const sumber = sumberDari(fd)
  const barisId = Number(str(fd, 'id', 12)) || 0
  const balik = barangUrl(sumber, barisId)
  const setKe = angka(fd, 'stok')
  if (setKe === null) go(balik, 'Isi stok baru', 'err')
  const alasan = str(fd, 'alasan', 200)
  try {
    const h = await koreksiStok({ sumber, barisId, setKe: setKe!, alasan, harga: angka(fd, 'harga'), pengguna: penggunaDari(s) })
    await catatAktivitas({ pengguna: penggunaDari(s), aksi: 'koreksi_stok', entitas: sumber === 'ban' ? 'stok_ban' : 'listing', data: { id: barisId, dari: h.dari, ke: h.ke, alasan } })
    siarkan({ jenis: 'stok', cabangId: h.cabangId }, ...(h.peringatanBaru ? [{ jenis: 'peringatan' as const, cabangId: h.cabangId, pesan: `Stok ${h.nama} menipis` }] : []))
    go(balik, `Stok ${h.nama} dikoreksi dari ${h.dari} ke ${h.ke}`)
  } catch (e) {
    if (e instanceof GalatKasir) go(balik, e.message, 'err')
    throw e
  }
}

export async function ubahHargaBatchAksi(fd: FormData) {
  const s = await requireOwner()
  const balik = aman(str(fd, 'back', 200), PENGATURAN)
  const harga = angka(fd, 'harga')
  if (harga === null) go(balik, 'Isi harga baru', 'err')
  const batchId = Number(str(fd, 'batch', 12)) || 0
  try {
    const h = await ubahHargaBatch({ batchId, harga: harga!, pengguna: penggunaDari(s) })
    if (!h.berubah) go(balik, 'Harga sama dengan sebelumnya, tidak ada yang diubah')
    await catatAktivitas({ pengguna: penggunaDari(s), aksi: 'ubah_harga_batch', entitas: 'batch_stok', data: { batch: batchId, lama: h.lama, baru: h.baru } })
    siarkan({ jenis: 'stok', cabangId: h.cabangId })
    go(balik, `Harga batch ${h.nama} menjadi Rp ${h.baru.toLocaleString('id-ID')}`)
  } catch (e) {
    if (e instanceof GalatKasir) go(balik, e.message, 'err')
    throw e
  }
}

export async function aturBatasAksi(fd: FormData) {
  const s = await requireOwner()
  const sumber = sumberDari(fd)
  const barisId = Number(str(fd, 'id', 12)) || 0
  const balik = aman(str(fd, 'back', 200), barangUrl(sumber, barisId))
  const batas = angka(fd, 'batas')
  try {
    const h = await aturBatasMinimum({ sumber, barisId, batas })
    await catatAktivitas({ pengguna: penggunaDari(s), aksi: 'batas_minimum', entitas: sumber === 'ban' ? 'stok_ban' : 'listing', data: { id: barisId, batas } })
    if (h.peringatan !== 'tetap') siarkan({ jenis: 'peringatan', cabangId: h.cabangId, pesan: h.peringatan === 'buat' ? `Stok ${h.nama} menipis` : undefined })
    go(balik, batas === null ? `Batas minimum ${h.nama} dihapus` : `Batas minimum ${h.nama} menjadi ${batas}${h.peringatan === 'buat' ? '. Stoknya sudah di batas, peringatan dibuat.' : ''}`)
  } catch (e) {
    if (e instanceof GalatKasir) go(balik, e.message, 'err')
    throw e
  }
}

/* ---------- Bagian 2: barang masuk, harga restock, opname ---------- */

export type HasilSimpan = { ok: true; id: number; nomor: string } | { ok: false; pesan: string }

// Dipanggil formulir barang masuk. Harga lama dan pengajuan ditentukan di server.
export async function catatBarangMasukAksi(raw: unknown): Promise<HasilSimpan> {
  const s = await requireUser()
  try {
    const h = await catatBarangMasuk(s, bacaInputBarangMasuk(raw))
    revalidatePath('/admin', 'layout')
    return { ok: true, id: h.id, nomor: h.nomor }
  } catch (e) {
    if (e instanceof GalatKasir) return { ok: false, pesan: e.message }
    console.error('catatBarangMasuk gagal', e)
    return { ok: false, pesan: 'Barang masuk gagal disimpan. Stok tidak berubah. Coba lagi.' }
  }
}

export async function putuskanRestockAksi(fd: FormData) {
  const s = await requireOwner()
  const keputusan = str(fd, 'keputusan', 12) === 'ditolak' ? 'ditolak' : 'disetujui'
  try {
    const h = await putuskanRestock(s, { id: Number(str(fd, 'id', 12)) || 0, keputusan })
    go(PENGAJUAN, keputusan === 'disetujui' ? `Harga ${h.nama} menjadi Rp ${h.hargaBaru.toLocaleString('id-ID')}` : `Usulan harga ${h.nama} ditolak, harga lama tetap`)
  } catch (e) {
    if (e instanceof GalatKasir) go(PENGAJUAN, e.message, 'err')
    throw e
  }
}

const OPNAME = '/admin/kasir/opname'
const opnameUrl = (id: number) => `${OPNAME}/${id}`

export async function mulaiOpnameAksi(fd: FormData) {
  const s = await requireUser()
  const cabangId = s.role === 'OWNER' ? Number(str(fd, 'cabang', 12)) || 0 : (s.branchId ?? 0)
  let id = 0
  try {
    id = (await mulaiOpname(s, { cabangId, catatan: str(fd, 'catatan', 300) })).id
  } catch (e) {
    if (e instanceof GalatKasir) go(OPNAME, e.message, 'err')
    throw e
  }
  go(opnameUrl(id), 'Opname dimulai. Hitung barangnya lalu isi stok fisik.')
}

export type HasilBarisOpname = { ok: true; pesan: string } | { ok: false; pesan: string }

// Dipanggil formulir baris opname (tanpa pindah halaman, supaya pencarian tetap terbuka).
export async function isiBarisOpnameAksi(raw: unknown): Promise<HasilBarisOpname> {
  const s = await requireUser()
  const o = (raw ?? {}) as Record<string, unknown>
  const fisik = typeof o.stokFisik === 'string' && /^\d{1,6}$/.test(o.stokFisik) ? Number(o.stokFisik) : NaN
  try {
    const h = await isiBarisOpname(s, {
      opnameId: Number(o.opnameId) || 0,
      sumber: o.sumber === 'produk' ? 'produk' : 'ban',
      barisId: Number(o.barisId) || 0,
      stokFisik: fisik,
      alasan: typeof o.alasan === 'string' ? o.alasan : '',
    })
    revalidatePath(opnameUrl(Number(o.opnameId) || 0))
    return { ok: true, pesan: `${h.nama} tersimpan: sistem ${h.stokSistem}, selisih ${h.selisih > 0 ? '+' : ''}${h.selisih}` }
  } catch (e) {
    if (e instanceof GalatKasir) return { ok: false, pesan: e.message }
    console.error('isiBarisOpname gagal', e)
    return { ok: false, pesan: 'Baris gagal disimpan. Coba lagi.' }
  }
}

const idOpname = (fd: FormData) => Number(str(fd, 'opname', 12)) || 0

export async function hapusBarisOpnameAksi(fd: FormData) {
  const s = await requireUser()
  const opnameId = idOpname(fd)
  try {
    await hapusBarisOpname(s, { opnameId, detailId: Number(str(fd, 'baris', 12)) || 0 })
    go(opnameUrl(opnameId), 'Baris dihapus')
  } catch (e) {
    if (e instanceof GalatKasir) go(opnameUrl(opnameId), e.message, 'err')
    throw e
  }
}

export async function statusOpnameAksi(fd: FormData) {
  const s = await requireUser()
  const id = idOpname(fd)
  const ke = str(fd, 'ke', 10) === 'draft' ? 'draft' : 'review'
  try {
    const o = await ubahStatusOpname(s, { id, ke })
    siarkan({ jenis: 'pengajuan', cabangId: o.cabangId, hanyaOwner: true, ...(ke === 'review' && { pesan: 'Opname baru menunggu tinjauan' }) })
    go(opnameUrl(id), ke === 'review' ? 'Opname dikirim ke owner untuk ditinjau' : 'Opname dikembalikan ke draft')
  } catch (e) {
    if (e instanceof GalatKasir) go(opnameUrl(id), e.message, 'err')
    throw e
  }
}

export async function hapusOpnameAksi(fd: FormData) {
  const s = await requireUser()
  const id = idOpname(fd)
  try {
    await hapusOpname(s, id)
  } catch (e) {
    if (e instanceof GalatKasir) go(opnameUrl(id), e.message, 'err')
    throw e
  }
  go(OPNAME, 'Draft opname dihapus')
}

export async function finalkanOpnameAksi(fd: FormData) {
  const s = await requireOwner()
  const id = idOpname(fd)
  try {
    const h = await finalkanOpname(s, id)
    go(opnameUrl(id), `Opname final. ${h.berubah} dari ${h.baris} baris mengubah stok.`)
  } catch (e) {
    if (e instanceof GalatKasir) go(opnameUrl(id), e.message, 'err')
    throw e
  }
}
