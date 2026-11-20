// Stok bermode kasir: batch FIFO per baris stok, pengaktifan kasir per cabang, koreksi owner, harga batch,
// batas minimum, dan pemeriksa invarian. Semua perubahan stok tetap lewat ubahStokTx (buku_stok) dengan jalurKasir.
//
// Urutan kunci di semua jalur (supaya dua transaksi tidak saling tunggu):
// 1. kunciSusunanStok (advisory), hanya untuk proses yang mengubah susunan baris atau mode cabang;
// 2. baris cabang (Branch) FOR SHARE, atau FOR UPDATE saat mode diubah;
// 3. baris stok (StockTire lalu Listing, urut id) FOR UPDATE;
// 4. baris batch_stok FOR UPDATE.
import { db } from '../db'
import { kunciSusunanStok, cekPeringatanTx, ubahStokTx, type HasilUbahStok, type TargetStok, type Tx } from '../stok/ubah'
import { cekInvarian, GalatKasir, hargaTerdepan, KODE_NOTA, pecahFifo, type Batch, type Potongan } from './logika'

export type SumberStok = 'ban' | 'produk'

export type BarisTerkunci = {
  sumber: SumberStok
  barisId: number
  cabangId: number | null
  stok: number
  harga: number // harga jual efektif baris sekarang (ban: harga dikurangi potongan, kosong dianggap 0)
  kode: string
  nama: string
  batas: number | null
  aktif: boolean
  target: TargetStok
}

export type BatchTerkunci = Batch & { jumlahAwal: number }

/* ---------- Kunci ---------- */

// Kunci baris cabang. share: transaksi biasa (jual, void, koreksi). update: mengubah mode cabang.
export async function kunciCabangTx(tx: Tx, cabangId: number, cara: 'share' | 'update' = 'share') {
  const rows =
    cara === 'update'
      ? await tx.$queryRaw<{ id: number; name: string; mode: string; kodeNota: string | null }[]>`
          SELECT "id", "name", "mode_stok" AS "mode", "kode_nota" AS "kodeNota" FROM "Branch" WHERE "id" = ${cabangId} FOR UPDATE`
      : await tx.$queryRaw<{ id: number; name: string; mode: string; kodeNota: string | null }[]>`
          SELECT "id", "name", "mode_stok" AS "mode", "kode_nota" AS "kodeNota" FROM "Branch" WHERE "id" = ${cabangId} FOR SHARE`
  if (!rows[0]) throw new GalatKasir('Cabang tidak ditemukan')
  return rows[0]
}

export async function kunciBarisTx(tx: Tx, sumber: SumberStok, barisId: number): Promise<BarisTerkunci> {
  if (sumber === 'ban') {
    const [r] = await tx.$queryRaw<{ id: number; stock: number; kode: string | null; cabangId: number | null; price: number | null; discount: number; batas: number | null; sizeRaw: string; brand: string; aktif: boolean }[]>`
      SELECT "id", "stock", "kode", "cabang_id" AS "cabangId", "price", "discount", "batas_minimum" AS "batas", "sizeRaw", "brand", "aktif"
      FROM "StockTire" WHERE "id" = ${barisId} FOR UPDATE`
    if (!r) throw new GalatKasir('Baris stok ban tidak ditemukan')
    return {
      sumber,
      barisId: r.id,
      cabangId: r.cabangId,
      stok: r.stock,
      harga: r.price === null ? 0 : Math.max(0, r.price - r.discount),
      kode: r.kode ?? '',
      nama: `${r.sizeRaw} ${r.brand}`.trim(),
      batas: r.batas,
      aktif: r.aktif,
      target: { jenis: 'stok_ban', id: r.id },
    }
  }
  const [r] = await tx.$queryRaw<{ id: number; stock: number; price: number; branchId: number; productId: number; batas: number | null; name: string; kode: string | null; slug: string }[]>`
    SELECT l."id", l."stock", l."price", l."branchId", l."productId", l."batas_minimum" AS "batas", p."name", p."kode", p."slug"
    FROM "Listing" l JOIN "Product" p ON p."id" = l."productId" WHERE l."id" = ${barisId} FOR UPDATE OF l`
  if (!r) throw new GalatKasir('Produk ini belum terdaftar di cabang tersebut')
  return {
    sumber,
    barisId: r.id,
    cabangId: r.branchId,
    stok: r.stock,
    harga: r.price,
    kode: r.kode || r.slug,
    nama: r.name,
    batas: r.batas,
    aktif: true,
    target: { jenis: 'listing', productId: r.productId, branchId: r.branchId },
  }
}

// Batch bersisa satu baris, urut FIFO, dikunci.
export async function batchTx(tx: Tx, sumber: SumberStok, barisId: number): Promise<BatchTerkunci[]> {
  const rows = await tx.$queryRaw<{ id: number; sisa: number; hargaJual: number; tanggalMasuk: Date; jumlahAwal: number }[]>`
    SELECT "id", "sisa", "harga_jual" AS "hargaJual", "tanggal_masuk" AS "tanggalMasuk", "jumlah_awal" AS "jumlahAwal"
    FROM "batch_stok" WHERE "sumber" = ${sumber} AND "baris_id" = ${barisId} AND "sisa" > 0
    ORDER BY "tanggal_masuk", "id" FOR UPDATE`
  return rows
}

/* ---------- Harga baris ---------- */

// Harga baris disamakan dengan harga batch terdepan supaya chatbot dan halaman admin tetap benar.
// Ban: harga = harga batch, potongan 0 (harga batch kosong menjadi harga kosong). Produk situs: harga listing.
export async function samakanHargaTx(tx: Tx, sumber: SumberStok, barisId: number) {
  const depan = hargaTerdepan(await batchTx(tx, sumber, barisId))
  if (depan === null) return null
  if (sumber === 'ban') {
    await tx.stockTire.update({ where: { id: barisId }, data: depan > 0 ? { price: depan, discount: 0, priceIssue: '' } : { price: null, discount: 0 } })
  } else {
    await tx.listing.update({ where: { id: barisId }, data: { price: depan } })
  }
  return depan
}

/* ---------- Ubah sisa batch (selalu bersama buku_stok) ---------- */

export type Catatan = { tipe: 'jual' | 'void' | 'koreksi' | 'opname'; refId: string; pengguna: string | null }

// Kurangi stok baris menurut FIFO. Satu baris buku_stok per batch yang terpakai.
export async function kurangiFifoTx(tx: Tx, baris: BarisTerkunci, jumlah: number, c: Catatan) {
  const potongan = pecahFifo(await batchTx(tx, baris.sumber, baris.barisId), jumlah)
  const hasil: HasilUbahStok[] = []
  for (const p of potongan) {
    const n = await tx.$executeRaw`UPDATE "batch_stok" SET "sisa" = "sisa" - ${p.jumlah} WHERE "id" = ${p.batchId} AND "sisa" >= ${p.jumlah}`
    if (n !== 1) throw new GalatKasir('Sisa batch berubah saat diproses. Coba lagi.')
    hasil.push(await ubahStokTx(tx, { target: baris.target, delta: -p.jumlah, tipe: c.tipe, refId: c.refId, batchId: p.batchId, pengguna: c.pengguna, jalurKasir: true }))
  }
  return { potongan, hasil }
}

// Kembalikan jumlah ke batch yang sama (void).
export async function kembalikanKeBatchTx(tx: Tx, baris: BarisTerkunci, batchId: number, jumlah: number, c: Catatan) {
  const h = await ubahStokTx(tx, { target: baris.target, delta: jumlah, tipe: c.tipe, refId: c.refId, batchId, pengguna: c.pengguna, jalurKasir: true })
  const n = await tx.$executeRaw`UPDATE "batch_stok" SET "sisa" = "sisa" + ${jumlah} WHERE "id" = ${batchId} AND "sisa" + ${jumlah} <= "jumlah_awal"`
  if (n !== 1) throw new GalatKasir('Batch asal tidak bisa menerima pengembalian')
  return h
}

// Batch baru (batch awal saat pengaktifan, koreksi tambah, barang masuk, opname tambah). Buku stok dicatat pemanggil.
export async function buatBatchTx(
  tx: Tx,
  baris: BarisTerkunci,
  p: { jumlah: number; harga: number; jenis: 'awal' | 'koreksi' | 'masuk' | 'opname'; tanggal?: Date; hargaBeli?: number | null; detailBarangMasukId?: number },
) {
  return tx.batchStok.create({
    data: {
      sumber: baris.sumber,
      kodeProduk: baris.kode,
      barisId: baris.barisId,
      cabangId: baris.cabangId!,
      jenis: p.jenis,
      hargaJual: p.harga,
      hargaBeli: p.hargaBeli ?? null,
      detailBarangMasukId: p.detailBarangMasukId ?? null,
      jumlahAwal: p.jumlah,
      sisa: p.jumlah,
      ...(p.tanggal && { tanggalMasuk: p.tanggal }),
    },
  })
}

// Harga yang dipakai batch baru kalau tidak ada harga lain: harga batch terdepan, atau harga jual efektif baris
// kalau baris belum punya batch bersisa (kosong dianggap 0, dan barang berharga 0 tidak bisa dijual kasir).
export async function hargaLamaTx(tx: Tx, baris: BarisTerkunci) {
  return hargaTerdepan(await batchTx(tx, baris.sumber, baris.barisId)) ?? baris.harga
}

/* ---------- Pengaktifan kasir ---------- */

// Batch awal untuk satu baris: jumlah = stok sekarang, harga = harga jual efektif sekarang. Stok tidak berubah,
// jadi tidak ada baris buku_stok. Dipakai pengaktifan kasir dan penetapan baris tanpa cabang ke cabang mode kasir.
export async function buatBatchAwalTx(tx: Tx, baris: BarisTerkunci, pengguna: string | null, waktu: Date) {
  if (baris.stok < 0) throw new GalatKasir(`${baris.nama}: stok negatif (${baris.stok}). Betulkan dulu sebelum mengaktifkan kasir.`)
  if (baris.stok === 0) return null
  const b = await buatBatchTx(tx, baris, { jumlah: baris.stok, harga: baris.harga, jenis: 'awal', tanggal: waktu })
  await tx.riwayatHarga.create({ data: { sumber: baris.sumber, kodeProduk: baris.kode, cabangId: baris.cabangId!, batchId: b.id, hargaLama: null, harga: baris.harga, pengguna, berlakuMulai: waktu } })
  await samakanHargaTx(tx, baris.sumber, baris.barisId)
  return b
}

export async function hitungCalonAktivasi(cabangId: number) {
  const [ban, banStok, produk, produkStok, tanpaCabang, hargaNol] = await Promise.all([
    db.stockTire.count({ where: { cabangId } }),
    db.stockTire.count({ where: { cabangId, stock: { gt: 0 } } }),
    db.listing.count({ where: { branchId: cabangId } }),
    db.listing.count({ where: { branchId: cabangId, stock: { gt: 0 } } }),
    db.stockTire.count({ where: { cabangId: null, aktif: true } }),
    db.stockTire.count({ where: { cabangId, stock: { gt: 0 }, OR: [{ price: null }, { price: 0 }] } }),
  ])
  return { ban, banStok, produk, produkStok, tanpaCabang, hargaNol }
}

// Owner mengaktifkan kasir untuk satu cabang. Tiap baris berstok di atas 0 mendapat batch awal.
export async function aktifkanKasir(p: { cabangId: number; kodeNota: string; pengguna: string | null }) {
  const kodeNota = p.kodeNota.trim().toUpperCase()
  if (!KODE_NOTA.test(kodeNota)) throw new GalatKasir('Kode nota harus 2 sampai 5 huruf, mis. BTU')
  const waktu = new Date()
  return db.$transaction(
    async (tx) => {
      await kunciSusunanStok(tx)
      const b = await kunciCabangTx(tx, p.cabangId, 'update')
      if (b.mode === 'kasir') throw new GalatKasir('Kasir sudah aktif di cabang ini')
      const bentrok = await tx.branch.findFirst({ where: { kodeNota, NOT: { id: p.cabangId } }, select: { name: true } })
      if (bentrok) throw new GalatKasir(`Kode nota ${kodeNota} sudah dipakai ${bentrok.name}`)
      let batch = 0
      const ban = await tx.$queryRaw<{ id: number }[]>`SELECT "id" FROM "StockTire" WHERE "cabang_id" = ${p.cabangId} ORDER BY "id" FOR UPDATE`
      for (const { id } of ban) if (await buatBatchAwalTx(tx, await kunciBarisTx(tx, 'ban', id), p.pengguna, waktu)) batch++
      const produk = await tx.$queryRaw<{ id: number }[]>`SELECT "id" FROM "Listing" WHERE "branchId" = ${p.cabangId} ORDER BY "id" FOR UPDATE`
      for (const { id } of produk) if (await buatBatchAwalTx(tx, await kunciBarisTx(tx, 'produk', id), p.pengguna, waktu)) batch++
      await tx.branch.update({ where: { id: p.cabangId }, data: { modeStok: 'kasir', kodeNota, kasirAktifSejak: waktu } })
      return { cabang: b.name, kodeNota, batch, ban: ban.length, produk: produk.length }
    },
    { timeout: 120_000, maxWait: 10_000 },
  )
}

/* ---------- Koreksi, harga batch, batas minimum (owner) ---------- */

// Setel stok baris ke angka baru. Pengurangan memakai urutan FIFO. Penambahan membentuk batch jenis koreksi
// dengan harga yang diisi owner (bawaan: harga batch terdepan, atau harga baris kalau tidak ada batch).
// Barang datang dicatat lewat barang masuk (src/lib/kasir/masuk.ts), bukan lewat koreksi.
export async function koreksiStok(p: { sumber: SumberStok; barisId: number; setKe: number; alasan: string; harga?: number | null; pengguna: string | null }) {
  if (!Number.isInteger(p.setKe) || p.setKe < 0) throw new GalatKasir('Stok baru harus bilangan bulat 0 atau lebih')
  if (p.alasan.trim().length < 3) throw new GalatKasir('Tulis alasan koreksi')
  return db.$transaction(async (tx) => {
    const cabangId = await cabangBarisTx(tx, p.sumber, p.barisId)
    const b = await kunciCabangTx(tx, cabangId)
    if (b.mode !== 'kasir') throw new GalatKasir('Koreksi lewat kasir hanya untuk cabang bermode kasir')
    const baris = await kunciBarisTx(tx, p.sumber, p.barisId)
    const refId = `koreksi:${p.sumber}:${p.barisId}:${Date.now()}`
    const c = { tipe: 'koreksi' as const, refId, pengguna: p.pengguna }
    const selisih = p.setKe - baris.stok
    let hasil: HasilUbahStok[] = []
    if (selisih < 0) hasil = (await kurangiFifoTx(tx, baris, -selisih, c)).hasil
    if (selisih > 0) {
      const harga = p.harga ?? (await hargaLamaTx(tx, baris))
      if (!Number.isInteger(harga) || harga < 0) throw new GalatKasir('Harga batch harus rupiah bulat')
      const batch = await buatBatchTx(tx, baris, { jumlah: selisih, harga, jenis: 'koreksi' })
      await tx.riwayatHarga.create({ data: { sumber: p.sumber, kodeProduk: baris.kode, cabangId: baris.cabangId!, batchId: batch.id, hargaLama: null, harga, pengguna: p.pengguna } })
      hasil = [await ubahStokTx(tx, { target: baris.target, delta: selisih, tipe: 'koreksi', refId, batchId: batch.id, pengguna: p.pengguna, jalurKasir: true })]
    }
    await samakanHargaTx(tx, p.sumber, p.barisId)
    return { cabangId: baris.cabangId!, nama: baris.nama, dari: baris.stok, ke: p.setKe, peringatanBaru: hasil.some((h) => h.peringatan === 'buat') }
  })
}

async function cabangBarisTx(tx: Tx, sumber: SumberStok, barisId: number) {
  const id =
    sumber === 'ban'
      ? (await tx.stockTire.findUnique({ where: { id: barisId }, select: { cabangId: true } }))?.cabangId
      : (await tx.listing.findUnique({ where: { id: barisId }, select: { branchId: true } }))?.branchId
  if (id === undefined) throw new GalatKasir('Baris stok tidak ditemukan')
  if (id === null) throw new GalatKasir('Baris tanpa cabang tidak bisa dipakai kasir')
  return id
}

// Owner mengubah harga jual satu batch yang masih bersisa. Tercatat di riwayat_harga.
export async function ubahHargaBatch(p: { batchId: number; harga: number; pengguna: string | null }) {
  if (!Number.isInteger(p.harga) || p.harga < 0 || p.harga > 1_000_000_000) throw new GalatKasir('Harga harus rupiah bulat')
  return db.$transaction(async (tx) => {
    const awal = await tx.batchStok.findUnique({ where: { id: p.batchId }, select: { sumber: true, barisId: true, cabangId: true } })
    if (!awal) throw new GalatKasir('Batch tidak ditemukan')
    await kunciCabangTx(tx, awal.cabangId)
    const baris = await kunciBarisTx(tx, awal.sumber as SumberStok, awal.barisId)
    const batch = (await batchTx(tx, baris.sumber, baris.barisId)).find((b) => b.id === p.batchId)
    if (!batch) throw new GalatKasir('Batch ini sudah habis, harganya tidak perlu diubah')
    if (batch.hargaJual === p.harga) return { cabangId: awal.cabangId, nama: baris.nama, lama: batch.hargaJual, baru: p.harga, berubah: false }
    await tx.batchStok.update({ where: { id: p.batchId }, data: { hargaJual: p.harga } })
    await tx.riwayatHarga.create({ data: { sumber: baris.sumber, kodeProduk: baris.kode, cabangId: awal.cabangId, batchId: p.batchId, hargaLama: batch.hargaJual, harga: p.harga, pengguna: p.pengguna } })
    await samakanHargaTx(tx, baris.sumber, baris.barisId)
    return { cabangId: awal.cabangId, nama: baris.nama, lama: batch.hargaJual, baru: p.harga, berubah: true }
  })
}

// Owner mengatur batas minimum. null: tanpa peringatan. Peringatan langsung dicek dengan stok sekarang.
export async function aturBatasMinimum(p: { sumber: SumberStok; barisId: number; batas: number | null }) {
  if (p.batas !== null && (!Number.isInteger(p.batas) || p.batas < 0 || p.batas > 100_000)) throw new GalatKasir('Batas minimum harus bilangan bulat 0 atau lebih')
  return db.$transaction(async (tx) => {
    const baris = await kunciBarisTx(tx, p.sumber, p.barisId)
    if (p.sumber === 'ban') await tx.stockTire.update({ where: { id: p.barisId }, data: { batasMinimum: p.batas } })
    else await tx.listing.update({ where: { id: p.barisId }, data: { batasMinimum: p.batas } })
    const k = await cekPeringatanTx(tx, { sumber: p.sumber, barisId: p.barisId, kodeProduk: baris.kode, cabangId: baris.cabangId, stok: baris.stok, batas: p.batas })
    return { cabangId: baris.cabangId, nama: baris.nama, peringatan: k }
  })
}

/* ---------- Pemeriksa invarian ---------- */

// Untuk tiap cabang bermode kasir: stok baris = jumlah sisa batch, dan harga baris = harga batch terdepan.
export async function periksaInvarian(cabangId?: number) {
  const cabang = await db.branch.findMany({ where: { modeStok: 'kasir', ...(cabangId && { id: cabangId }) }, select: { id: true, name: true }, orderBy: { id: 'asc' } })
  const masalah: { cabangId: number; pesan: string }[] = []
  let diperiksa = 0
  for (const c of cabang) {
    const [ban, listing, batch] = await Promise.all([
      db.stockTire.findMany({ where: { cabangId: c.id }, select: { id: true, sizeRaw: true, brand: true, stock: true, price: true, discount: true } }),
      db.listing.findMany({ where: { branchId: c.id }, select: { id: true, stock: true, price: true, product: { select: { name: true } } } }),
      db.batchStok.findMany({ where: { cabangId: c.id }, select: { id: true, sumber: true, barisId: true, sisa: true, hargaJual: true, tanggalMasuk: true, jumlahAwal: true } }),
    ])
    const per = new Map<string, BatchTerkunci[]>()
    for (const b of batch) {
      const k = `${b.sumber}:${b.barisId}`
      per.set(k, [...(per.get(k) ?? []), b])
    }
    for (const r of ban) {
      diperiksa++
      const harga = r.price === null ? 0 : r.price - r.discount
      for (const m of cekInvarian({ label: `${r.sizeRaw} ${r.brand}`, stok: r.stock, harga }, per.get(`ban:${r.id}`) ?? [])) masalah.push({ cabangId: c.id, pesan: m })
      if (r.discount !== 0 && (per.get(`ban:${r.id}`) ?? []).some((b) => b.sisa > 0)) masalah.push({ cabangId: c.id, pesan: `${r.sizeRaw} ${r.brand}: potongan ${r.discount} masih terisi` })
    }
    for (const r of listing) {
      diperiksa++
      for (const m of cekInvarian({ label: r.product.name, stok: r.stock, harga: r.price }, per.get(`produk:${r.id}`) ?? [])) masalah.push({ cabangId: c.id, pesan: m })
    }
  }
  return { cabang: cabang.length, diperiksa, masalah }
}

export type { Potongan }
