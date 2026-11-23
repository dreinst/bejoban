// Barang masuk (UC-05) dan pengajuan harga restock (UC-06a). Aturan: docs/KASIR.md, bagian barang masuk.
// Urutan kunci sama dengan src/lib/kasir/stok.ts: kunci idempotency (advisory), baris cabang FOR SHARE,
// baris stok urut (ban lalu produk, id), baris batch.
import { createHash } from 'node:crypto'
import { Prisma } from '@/generated/prisma/client'
import { db } from '../db'
import { catatAktivitas } from '../stok/aktivitas'
import { GalatStok } from '../stok/logika'
import { ubahStokTx, type HasilUbahStok, type Tx } from '../stok/ubah'
import { formatNomorPenerimaan, GalatKasir, GalatKunciDipakai, isJenisPemasok, isoWib, tanggalKeWaktu, tanggalWib, type JenisPemasok } from './logika'
import { buatBatchTx, hargaLamaTx, kunciBarisTx, kunciCabangTx, pesanTidakDipakai, samakanHargaTx, type BarisTerkunci, type SumberStok } from './stok'
import { siarkan, type Siaran } from './siaran'
import { bolehCabang, type SesiKasir } from './transaksi'

export const PESAN_MASUK_SHEET = 'Cabang ini belum memakai kasir. Stoknya masih diisi dari sheet, jadi barang masuk dicatat di sheet.'

export type BarisBarangMasuk = { sumber: SumberStok; id: number; jumlah: number; hargaBeli: number | null; hargaJual: number | null }

export type InputBarangMasuk = {
  cabangId: number
  pemasok: string
  jenisPemasok: JenisPemasok
  tanggalPesan: string // YYYY-MM-DD WIB, boleh kosong
  tanggalTerima: string // YYYY-MM-DD WIB
  catatan: string
  kunci: string
  baris: BarisBarangMasuk[]
}

const KUNCI_IDEMPOTENCY_MASUK = 4207003
const MAKS_BARIS = 60
const MAKS_HARGA = 1_000_000_000

// Baca dan rapikan masukan formulir barang masuk. Harga dihitung ulang di server.
export function bacaInputBarangMasuk(raw: unknown, sekarang = new Date()): InputBarangMasuk {
  const o = (raw ?? {}) as Record<string, unknown>
  const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : typeof v === 'string' && /^\d{1,12}$/.test(v) ? Number(v) : NaN)
  const opsional = (v: unknown) => (v === undefined || v === null || v === '' ? null : int(v))
  const teks = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '')
  const cabangId = int(o.cabangId)
  if (!Number.isInteger(cabangId)) throw new GalatKasir('Cabang tidak valid')
  const pemasok = teks(o.pemasok, 100)
  if (pemasok.length < 2) throw new GalatKasir('Isi nama pemasok')
  if (!isJenisPemasok(o.jenisPemasok)) throw new GalatKasir('Pilih jenis pemasok: distributor atau toko rekanan')
  const kunci = typeof o.kunci === 'string' ? o.kunci : ''
  if (!/^[A-Za-z0-9-]{16,64}$/.test(kunci)) throw new GalatKasir('Kunci kiriman tidak valid. Muat ulang halaman.')
  const hariIni = isoWib(sekarang)
  const tanggalTerima = teks(o.tanggalTerima, 10)
  if (!tanggalKeWaktu(tanggalTerima)) throw new GalatKasir('Isi tanggal terima')
  if (tanggalTerima > hariIni) throw new GalatKasir('Tanggal terima tidak boleh sesudah hari ini')
  const tanggalPesan = teks(o.tanggalPesan, 10)
  if (tanggalPesan && !tanggalKeWaktu(tanggalPesan)) throw new GalatKasir('Tanggal pesan tidak valid')
  if (tanggalPesan && tanggalPesan > tanggalTerima) throw new GalatKasir('Tanggal pesan tidak boleh sesudah tanggal terima')
  if (!Array.isArray(o.baris) || !o.baris.length) throw new GalatKasir('Tambahkan minimal satu barang')
  if (o.baris.length > MAKS_BARIS) throw new GalatKasir(`Paling banyak ${MAKS_BARIS} barang per penerimaan`)
  const baris: BarisBarangMasuk[] = []
  const ada = new Set<string>()
  for (const b of o.baris as Record<string, unknown>[]) {
    const id = int(b?.id)
    const jumlah = int(b?.jumlah)
    if ((b?.sumber !== 'ban' && b?.sumber !== 'produk') || !Number.isInteger(id)) throw new GalatKasir('Barang tidak dikenali')
    if (!Number.isInteger(jumlah) || jumlah < 1 || jumlah > 9999) throw new GalatKasir('Jumlah tiap barang 1 sampai 9999')
    const hargaBeli = opsional(b.hargaBeli)
    const hargaJual = opsional(b.hargaJual)
    for (const h of [hargaBeli, hargaJual]) if (h !== null && (!Number.isInteger(h) || h < 0 || h > MAKS_HARGA)) throw new GalatKasir('Harga harus rupiah bulat')
    const k = `${b.sumber}:${id}`
    if (ada.has(k)) throw new GalatKasir('Ada barang yang tertulis dua kali. Gabungkan jumlahnya di satu baris.')
    ada.add(k)
    baris.push({ sumber: b.sumber, id, jumlah, hargaBeli, hargaJual })
  }
  return { cabangId, pemasok, jenisPemasok: o.jenisPemasok, tanggalPesan, tanggalTerima, catatan: teks(o.catatan, 300), kunci, baris }
}

// Sidik isi penerimaan, aturannya sama dengan transaksi kasir (sidikJual): kunci yang sama dengan isi berbeda ditolak.
export function sidikMasuk(input: InputBarangMasuk) {
  const baris = input.baris.map((b) => `${b.sumber}:${b.id}:${b.jumlah}:${b.hargaBeli ?? ''}:${b.hargaJual ?? ''}`).toSorted()
  const isi = [input.cabangId, input.pemasok, input.jenisPemasok, input.tanggalPesan, input.tanggalTerima, input.catatan, ...baris]
  return createHash('sha256').update(JSON.stringify(isi)).digest('hex')
}

const pesanKunciMasuk = (nomor: string) =>
  `Kiriman tadi sudah tersimpan sebagai penerimaan ${nomor}, dan isinya berbeda dari formulir sekarang. Formulir ini belum disimpan. Buka ${nomor} untuk memeriksa, lalu catat kekurangannya sebagai penerimaan baru.`

async function nomorPenerimaanTx(tx: Tx, cabangId: number, tanggal: string) {
  const [r] = await tx.$queryRaw<{ nomor: number }[]>`
    INSERT INTO "penghitung_penerimaan" ("cabang_id", "tanggal", "nomor") VALUES (${cabangId}, ${tanggal}, 1)
    ON CONFLICT ("cabang_id", "tanggal") DO UPDATE SET "nomor" = "penghitung_penerimaan"."nomor" + 1
    RETURNING "nomor"`
  return r.nomor
}

export type HasilBarangMasuk = { id: number; nomor: string; ulang: boolean; diajukan: number }

// Catat satu penerimaan dalam satu transaksi basis data: kepala, baris, batch jenis masuk per baris, stok naik lewat
// ubahStokTx (buku_stok tipe masuk, peringatan dicek), dan pengajuan harga restock untuk usulan admin.
// Kiriman ulang dengan kunci yang sama mengembalikan penerimaan yang sudah ada.
export async function catatBarangMasuk(sesi: SesiKasir, input: InputBarangMasuk): Promise<HasilBarangMasuk> {
  if (!bolehCabang(sesi, input.cabangId)) throw new GalatKasir('Kamu hanya bisa mencatat barang masuk untuk cabang sendiri')
  const owner = sesi.role === 'OWNER'
  const siaran: Siaran[] = []
  const sidik = sidikMasuk(input)
  try {
    const hasil = await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KUNCI_IDEMPOTENCY_MASUK}, hashtext(${input.kunci}))`
        const lama = await tx.barangMasuk.findUnique({ where: { idempotencyKey: input.kunci }, select: { id: true, nomorPenerimaan: true, cabangId: true, sidikIsi: true } })
        if (lama) {
          if (lama.cabangId !== input.cabangId) throw new GalatKasir('Kunci kiriman sudah dipakai penerimaan lain. Muat ulang halaman.')
          if (lama.sidikIsi !== null && lama.sidikIsi !== sidik) throw new GalatKunciDipakai(pesanKunciMasuk(lama.nomorPenerimaan), { id: lama.id, nomor: lama.nomorPenerimaan })
          return { id: lama.id, nomor: lama.nomorPenerimaan, ulang: true, diajukan: 0 }
        }
        const cabang = await kunciCabangTx(tx, input.cabangId)
        if (cabang.mode !== 'kasir' || !cabang.kodeNota) throw new GalatKasir(PESAN_MASUK_SHEET)

        const urut = input.baris.toSorted((a, b) => (a.sumber === b.sumber ? a.id - b.id : a.sumber === 'ban' ? -1 : 1))
        const terkunci: { b: BarisBarangMasuk; baris: BarisTerkunci; hargaLama: number }[] = []
        for (const b of urut) {
          const baris = await kunciBarisTx(tx, b.sumber, b.id)
          if (baris.cabangId !== input.cabangId) throw new GalatKasir(`${baris.nama} bukan stok cabang ini`)
          if (!baris.aktif) throw new GalatKasir(pesanTidakDipakai(baris))
          const hargaLama = await hargaLamaTx(tx, baris)
          if ((b.hargaJual ?? hargaLama) <= 0) throw new GalatKasir(`${baris.nama} belum punya harga jual. Isi harga jual.`)
          terkunci.push({ b, baris, hargaLama })
        }

        const sekarang = new Date()
        const tanggal = tanggalWib(sekarang)
        const nomor = formatNomorPenerimaan(cabang.kodeNota, tanggal, await nomorPenerimaanTx(tx, input.cabangId, tanggal))
        const kepala = await tx.barangMasuk.create({
          data: {
            nomorPenerimaan: nomor,
            cabangId: input.cabangId,
            pemasok: input.pemasok,
            jenisPemasok: input.jenisPemasok,
            tanggalPesan: input.tanggalPesan ? tanggalKeWaktu(input.tanggalPesan) : null,
            tanggalTerima: tanggalKeWaktu(input.tanggalTerima)!,
            penggunaId: sesi.uid,
            namaPengguna: sesi.name.slice(0, 60),
            catatan: input.catatan,
            idempotencyKey: input.kunci,
            sidikIsi: sidik,
          },
          select: { id: true },
        })

        const refId = `masuk:${kepala.id}`
        const hasilStok: HasilUbahStok[] = []
        let diajukan = 0
        for (const { b, baris, hargaLama } of terkunci) {
          const usulan = b.hargaJual ?? hargaLama
          // Owner langsung memakai harganya. Admin: batch baru memakai harga lama sampai owner menyetujui usulannya.
          const hargaBatch = owner ? usulan : hargaLama
          const ajukan = !owner && usulan !== hargaLama
          const detail = await tx.detailBarangMasuk.create({
            data: { barangMasukId: kepala.id, sumber: baris.sumber, kodeProduk: baris.kode, barisId: baris.barisId, cabangId: input.cabangId, nama: baris.nama.slice(0, 200), jumlah: b.jumlah, hargaBeli: b.hargaBeli, hargaJual: usulan, hargaLama },
            select: { id: true },
          })
          const batch = await buatBatchTx(tx, baris, { jumlah: b.jumlah, harga: hargaBatch, jenis: 'masuk', tanggal: sekarang, hargaBeli: b.hargaBeli, detailBarangMasukId: detail.id })
          await tx.riwayatHarga.create({ data: { sumber: baris.sumber, kodeProduk: baris.kode, cabangId: input.cabangId, batchId: batch.id, hargaLama, harga: hargaBatch, pengguna: String(sesi.uid), berlakuMulai: sekarang } })
          hasilStok.push(await ubahStokTx(tx, { target: baris.target, delta: b.jumlah, tipe: 'masuk', refId, batchId: batch.id, pengguna: String(sesi.uid), jalurKasir: true }))
          let pengajuanHargaId: number | null = null
          if (ajukan) {
            const p = await tx.pengajuanHarga.create({
              data: { tipe: 'restock', cabangId: input.cabangId, sumber: baris.sumber, kodeProduk: baris.kode, pengajuId: sesi.uid, hargaLama, hargaBaru: usulan, alasan: `${nomor}: ${baris.nama}`.slice(0, 200), batchId: batch.id },
              select: { id: true },
            })
            pengajuanHargaId = p.id
            diajukan++
          }
          await tx.detailBarangMasuk.update({ where: { id: detail.id }, data: { batchId: batch.id, pengajuanHargaId } })
          await samakanHargaTx(tx, baris.sumber, baris.barisId)
        }

        siaran.push({ jenis: 'stok', cabangId: input.cabangId })
        if (hasilStok.some((h) => h.peringatan !== 'tetap')) siaran.push({ jenis: 'peringatan', cabangId: input.cabangId })
        if (diajukan) siaran.push({ jenis: 'pengajuan', cabangId: input.cabangId, hanyaOwner: true, pesan: `${diajukan} usulan harga baru dari ${nomor} menunggu tinjauan` })
        return { id: kepala.id, nomor, ulang: false, diajukan }
      },
      { timeout: 30_000, maxWait: 10_000 },
    )
    if (!hasil.ulang) {
      siarkan(...siaran)
      await catatAktivitas({ pengguna: String(sesi.uid), aksi: 'barang_masuk', entitas: 'barang_masuk', data: { id: hasil.id, nomor: hasil.nomor, baris: input.baris.length, diajukan: hasil.diajukan } })
    }
    return hasil
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const ada = await db.barangMasuk.findUnique({ where: { idempotencyKey: input.kunci }, select: { id: true, nomorPenerimaan: true, cabangId: true, sidikIsi: true } })
      if (ada && ada.cabangId === input.cabangId && (ada.sidikIsi === null || ada.sidikIsi === sidik)) return { id: ada.id, nomor: ada.nomorPenerimaan, ulang: true, diajukan: 0 }
      if (ada) throw new GalatKunciDipakai(pesanKunciMasuk(ada.nomorPenerimaan), { id: ada.id, nomor: ada.nomorPenerimaan })
    }
    if (e instanceof GalatStok) throw new GalatKasir(e.message)
    throw e
  }
}

// Owner memutuskan usulan harga restock. Disetujui: harga batch berubah, tercatat di riwayat_harga dan log_aktivitas,
// lalu harga baris disamakan lagi dengan batch terdepan. Ditolak: batch tetap memakai harga lama.
// Baris pengajuan dikunci lebih dulu, jadi keputusan ganda yang datang bersamaan hanya berlaku sekali.
export async function putuskanRestock(sesi: SesiKasir, p: { id: number; keputusan: 'disetujui' | 'ditolak' }) {
  if (sesi.role !== 'OWNER') throw new GalatKasir('Hanya owner yang memutuskan harga')
  const hasil = await db.$transaction(
    async (tx) => {
      const [x] = await tx.$queryRaw<{ id: number; tipe: string; status: string; cabangId: number; batchId: number | null; pengajuId: number; hargaLama: number; hargaBaru: number; alasan: string }[]>`
        SELECT "id", "tipe", "status", "cabang_id" AS "cabangId", "batch_id" AS "batchId", "pengaju_id" AS "pengajuId",
               "harga_lama" AS "hargaLama", "harga_baru" AS "hargaBaru", "alasan"
        FROM "pengajuan_harga" WHERE "id" = ${p.id} FOR UPDATE`
      if (!x || x.tipe !== 'restock') throw new GalatKasir('Pengajuan harga tidak ditemukan')
      if (x.status !== 'menunggu') throw new GalatKasir('Pengajuan ini sudah diputuskan')
      let nama = x.alasan
      let lama = x.hargaLama
      if (p.keputusan === 'disetujui') {
        const awal = x.batchId ? await tx.batchStok.findUnique({ where: { id: x.batchId }, select: { sumber: true, barisId: true, cabangId: true } }) : null
        if (!awal) throw new GalatKasir('Batch pengajuan ini tidak ditemukan')
        await kunciCabangTx(tx, awal.cabangId)
        const baris = await kunciBarisTx(tx, awal.sumber as SumberStok, awal.barisId)
        const [b] = await tx.$queryRaw<{ hargaJual: number }[]>`SELECT "harga_jual" AS "hargaJual" FROM "batch_stok" WHERE "id" = ${x.batchId} FOR UPDATE`
        nama = baris.nama
        lama = b.hargaJual
        if (b.hargaJual !== x.hargaBaru) {
          await tx.batchStok.update({ where: { id: x.batchId! }, data: { hargaJual: x.hargaBaru } })
          await tx.riwayatHarga.create({ data: { sumber: baris.sumber, kodeProduk: baris.kode, cabangId: awal.cabangId, batchId: x.batchId, hargaLama: b.hargaJual, harga: x.hargaBaru, pengguna: String(sesi.uid) } })
          await samakanHargaTx(tx, baris.sumber, baris.barisId)
        }
      }
      await tx.pengajuanHarga.update({ where: { id: x.id }, data: { status: p.keputusan, penyetujuId: sesi.uid, diputuskan: new Date() } })
      return { ...x, nama, lama }
    },
    { timeout: 20_000, maxWait: 10_000 },
  )
  siarkan(
    { jenis: 'keputusan', cabangId: hasil.cabangId, untukPengguna: hasil.pengajuId, pesan: `Harga ${hasil.nama} ${p.keputusan} owner` },
    { jenis: 'pengajuan', cabangId: hasil.cabangId, hanyaOwner: true },
    ...(p.keputusan === 'disetujui' ? [{ jenis: 'stok' as const, cabangId: hasil.cabangId }] : []),
  )
  await catatAktivitas({ pengguna: String(sesi.uid), aksi: `restock_${p.keputusan}`, entitas: 'pengajuan_harga', data: { id: hasil.id, batch: hasil.batchId, lama: hasil.lama, baru: hasil.hargaBaru } })
  return { nama: hasil.nama, hargaBaru: hasil.hargaBaru }
}
