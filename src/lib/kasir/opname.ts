// Stok opname (UC-08). Admin mengisi cabang sendiri, owner meninjau dan memfinalkan. Aturan: docs/KASIR.md.
// Saat final, selisih tiap baris diterapkan ke stok sekarang dalam satu transaksi basis data. Pengurangan memakai
// FIFO, penambahan membentuk batch jenis opname, semuanya tercatat di buku_stok tipe opname.
// Urutan kunci: baris stok_opname FOR UPDATE, baris cabang FOR SHARE, baris stok (ban lalu produk, id), batch.
import { db } from '../db'
import { catatAktivitas } from '../stok/aktivitas'
import { GalatStok } from '../stok/logika'
import { ubahStokTx, type HasilUbahStok, type Tx } from '../stok/ubah'
import { GalatKasir, hasilOpname } from './logika'
import { buatBatchTx, hargaLamaTx, kunciBarisTx, kunciCabangTx, kurangiFifoTx, samakanHargaTx, type SumberStok } from './stok'
import { siarkan } from './siaran'
import { bolehCabang, type SesiKasir } from './transaksi'

export const STATUS_OPNAME = ['draft', 'review', 'final'] as const
export type StatusOpname = (typeof STATUS_OPNAME)[number]
export const STATUS_OPNAME_LABEL: Record<StatusOpname, string> = { draft: 'Draft', review: 'Menunggu tinjauan owner', final: 'Final' }

export const PESAN_OPNAME_SHEET = 'Cabang ini belum memakai kasir. Stoknya masih diisi dari sheet, jadi opname dicatat di sheet.'

const KUNCI_OPNAME_CABANG = 4207004
const MAKS_BARIS = 1000

type Opname = { id: number; cabangId: number; status: StatusOpname }

const galat = (e: unknown): never => {
  if (e instanceof GalatStok) throw new GalatKasir(e.message)
  throw e
}

async function kunciOpnameTx(tx: Tx, id: number): Promise<Opname> {
  const [o] = await tx.$queryRaw<Opname[]>`SELECT "id", "cabang_id" AS "cabangId", "status" FROM "stok_opname" WHERE "id" = ${id} FOR UPDATE`
  if (!o) throw new GalatKasir('Opname tidak ditemukan')
  return o
}

// Siapa boleh mengubah baris: admin cabang itu selama draft, owner selama draft atau review.
function bolehUbah(sesi: SesiKasir, o: Opname) {
  if (!bolehCabang(sesi, o.cabangId)) throw new GalatKasir('Opname ini milik cabang lain')
  if (o.status === 'final') throw new GalatKasir('Opname ini sudah final dan tidak bisa diubah')
  if (o.status === 'review' && sesi.role !== 'OWNER') throw new GalatKasir('Opname ini sedang ditinjau owner. Minta owner mengembalikannya ke draft kalau perlu diubah.')
}

// Mulai opname baru (draft). Satu cabang hanya boleh punya satu opname yang belum final.
export async function mulaiOpname(sesi: SesiKasir, p: { cabangId: number; catatan?: string }) {
  if (!bolehCabang(sesi, p.cabangId)) throw new GalatKasir('Kamu hanya bisa membuat opname untuk cabang sendiri')
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KUNCI_OPNAME_CABANG}, ${p.cabangId})`
    const c = await kunciCabangTx(tx, p.cabangId)
    if (c.mode !== 'kasir') throw new GalatKasir(PESAN_OPNAME_SHEET)
    const buka = await tx.stokOpname.findFirst({ where: { cabangId: p.cabangId, status: { not: 'final' } }, select: { id: true } })
    if (buka) throw new GalatKasir('Masih ada opname cabang ini yang belum final. Lanjutkan yang itu dulu.')
    return tx.stokOpname.create({ data: { cabangId: p.cabangId, penginputId: sesi.uid, namaPenginput: sesi.name.slice(0, 60), catatan: (p.catatan ?? '').trim().slice(0, 300) }, select: { id: true } })
  })
}

// Isi atau ubah satu baris. stok_sistem diambil dari stok saat baris disimpan. Alasan wajib kalau selisih tidak 0.
export async function isiBarisOpname(sesi: SesiKasir, p: { opnameId: number; sumber: SumberStok; barisId: number; stokFisik: number; alasan: string }) {
  if (!Number.isInteger(p.stokFisik) || p.stokFisik < 0 || p.stokFisik > 100_000) throw new GalatKasir('Stok fisik harus bilangan bulat 0 atau lebih')
  const alasan = p.alasan.trim().replace(/\s+/g, ' ').slice(0, 200)
  return db
    .$transaction(async (tx) => {
      const o = await kunciOpnameTx(tx, p.opnameId)
      bolehUbah(sesi, o)
      const baris = await kunciBarisTx(tx, p.sumber, p.barisId)
      if (baris.cabangId !== o.cabangId) throw new GalatKasir(`${baris.nama} bukan stok cabang ini`)
      const selisih = p.stokFisik - baris.stok
      if (selisih !== 0 && alasan.length < 3) throw new GalatKasir(`Tulis alasan selisih untuk ${baris.nama} (sistem ${baris.stok}, fisik ${p.stokFisik})`)
      const jumlah = await tx.detailOpname.count({ where: { opnameId: o.id } })
      const kunci = { opnameId_sumber_barisId: { opnameId: o.id, sumber: p.sumber, barisId: p.barisId } }
      const data = { kodeProduk: baris.kode, nama: baris.nama.slice(0, 200), stokSistem: baris.stok, stokFisik: p.stokFisik, selisih, alasanSelisih: selisih ? alasan : '', diisi: new Date() }
      if (jumlah >= MAKS_BARIS && !(await tx.detailOpname.findUnique({ where: kunci, select: { id: true } }))) throw new GalatKasir(`Paling banyak ${MAKS_BARIS} baris per opname`)
      await tx.detailOpname.upsert({ where: kunci, create: { opnameId: o.id, sumber: p.sumber, barisId: p.barisId, ...data }, update: data })
      return { nama: baris.nama, stokSistem: baris.stok, selisih }
    })
    .catch(galat)
}

export async function hapusBarisOpname(sesi: SesiKasir, p: { opnameId: number; detailId: number }) {
  return db.$transaction(async (tx) => {
    const o = await kunciOpnameTx(tx, p.opnameId)
    bolehUbah(sesi, o)
    const n = await tx.detailOpname.deleteMany({ where: { id: p.detailId, opnameId: o.id } })
    if (!n.count) throw new GalatKasir('Baris tidak ditemukan')
  })
}

// Draft ke review (admin cabang itu atau owner), atau review kembali ke draft (owner).
export async function ubahStatusOpname(sesi: SesiKasir, p: { id: number; ke: 'review' | 'draft' }) {
  return db.$transaction(async (tx) => {
    const o = await kunciOpnameTx(tx, p.id)
    if (!bolehCabang(sesi, o.cabangId)) throw new GalatKasir('Opname ini milik cabang lain')
    if (o.status === 'final') throw new GalatKasir('Opname ini sudah final')
    if (p.ke === 'review') {
      if (o.status !== 'draft') throw new GalatKasir('Opname ini sudah dikirim ke owner')
      if (!(await tx.detailOpname.count({ where: { opnameId: o.id } }))) throw new GalatKasir('Isi minimal satu baris sebelum dikirim')
      await tx.stokOpname.update({ where: { id: o.id }, data: { status: 'review', dikirim: new Date() } })
    } else {
      if (sesi.role !== 'OWNER') throw new GalatKasir('Hanya owner yang bisa mengembalikan opname ke draft')
      if (o.status !== 'review') throw new GalatKasir('Opname ini masih draft')
      await tx.stokOpname.update({ where: { id: o.id }, data: { status: 'draft' } })
    }
    return o
  })
}

export async function hapusOpname(sesi: SesiKasir, id: number) {
  return db.$transaction(async (tx) => {
    const o = await kunciOpnameTx(tx, id)
    if (!bolehCabang(sesi, o.cabangId)) throw new GalatKasir('Opname ini milik cabang lain')
    if (o.status !== 'draft') throw new GalatKasir('Hanya opname draft yang bisa dihapus')
    await tx.stokOpname.delete({ where: { id } })
    return o
  })
}

export type HasilFinal = { id: number; cabangId: number; baris: number; berubah: number }

// Owner memfinalkan opname (dari draft atau review). Selisih tiap baris diterapkan ke stok sekarang, bukan menimpa
// angkanya, supaya penjualan sesudah baris diisi tetap terhitung. Kalau hasil satu baris akan negatif, seluruh
// finalisasi ditolak dan baris itu perlu dihitung ulang. Opname yang sudah final tidak bisa difinalkan ulang.
export async function finalkanOpname(sesi: SesiKasir, id: number): Promise<HasilFinal> {
  if (sesi.role !== 'OWNER') throw new GalatKasir('Hanya owner yang bisa memfinalkan opname')
  let peringatan = false
  const hasil = await db
    .$transaction(
      async (tx) => {
        const o = await kunciOpnameTx(tx, id)
        if (o.status === 'final') throw new GalatKasir('Opname ini sudah final')
        const c = await kunciCabangTx(tx, o.cabangId)
        if (c.mode !== 'kasir') throw new GalatKasir(PESAN_OPNAME_SHEET)
        const detail = (await tx.detailOpname.findMany({ where: { opnameId: o.id } })).toSorted((a, b) => (a.sumber === b.sumber ? a.barisId - b.barisId : a.sumber === 'ban' ? -1 : 1))
        if (!detail.length) throw new GalatKasir('Opname ini belum punya baris')

        // Putaran pertama: kunci semua baris dan periksa hasilnya, supaya semua baris bermasalah disebut sekaligus.
        const rencana = []
        const negatif: string[] = []
        for (const d of detail) {
          const baris = await kunciBarisTx(tx, d.sumber as SumberStok, d.barisId)
          if (baris.cabangId !== o.cabangId) throw new GalatKasir(`${baris.nama} sudah bukan stok cabang ini`)
          const h = hasilOpname(baris.stok, d.selisih)
          if (h.negatif) negatif.push(`${baris.nama} (stok sekarang ${baris.stok}, selisih ${d.selisih})`)
          rencana.push({ d, baris, ...h })
        }
        if (negatif.length)
          throw new GalatKasir(`Stok akan menjadi minus karena ada penjualan sesudah baris diisi: ${negatif.join('; ')}. Hitung ulang baris itu lalu simpan lagi.`)

        // Putaran kedua: terapkan selisih.
        const refId = `opname:${o.id}`
        const pengguna = String(sesi.uid)
        let berubah = 0
        for (const r of rencana) {
          const hasilStok: HasilUbahStok[] = []
          if (r.d.selisih < 0) hasilStok.push(...(await kurangiFifoTx(tx, r.baris, -r.d.selisih, { tipe: 'opname', refId, pengguna })).hasil)
          if (r.d.selisih > 0) {
            const harga = await hargaLamaTx(tx, r.baris)
            const batch = await buatBatchTx(tx, r.baris, { jumlah: r.d.selisih, harga, jenis: 'opname' })
            await tx.riwayatHarga.create({ data: { sumber: r.baris.sumber, kodeProduk: r.baris.kode, cabangId: o.cabangId, batchId: batch.id, hargaLama: null, harga, pengguna } })
            hasilStok.push(await ubahStokTx(tx, { target: r.baris.target, delta: r.d.selisih, tipe: 'opname', refId, batchId: batch.id, pengguna, jalurKasir: true }))
          }
          if (r.d.selisih) {
            berubah++
            await samakanHargaTx(tx, r.baris.sumber, r.baris.barisId)
          }
          if (hasilStok.some((h) => h.peringatan !== 'tetap')) peringatan = true
          await tx.detailOpname.update({ where: { id: r.d.id }, data: { stokSaatFinal: r.baris.stok, stokAkhir: r.akhir } })
        }
        await tx.stokOpname.update({ where: { id: o.id }, data: { status: 'final', finalisatorId: sesi.uid, difinalkan: new Date() } })
        return { id: o.id, cabangId: o.cabangId, baris: detail.length, berubah }
      },
      { timeout: 120_000, maxWait: 10_000 },
    )
    .catch(galat)
  siarkan({ jenis: 'stok', cabangId: hasil.cabangId }, ...(peringatan ? [{ jenis: 'peringatan' as const, cabangId: hasil.cabangId }] : []))
  await catatAktivitas({ pengguna: String(sesi.uid), aksi: 'finalkan_opname', entitas: 'stok_opname', data: { ...hasil } })
  return hasil
}
