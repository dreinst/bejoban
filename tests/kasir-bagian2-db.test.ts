// Tes kasir bagian 2 yang menyentuh database: barang masuk, pengajuan harga restock, opname, balapan dengan
// penjualan, dashboard, rekap bulanan, ekspor CSV, dan invarian sesudah urutan acak. Basis data PostgreSQL
// sementara (tests/db-uji.ts). Semua data di sini karangan.
import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { siapkanDbUji } from './db-uji'

let dbUji: Awaited<ReturnType<typeof siapkanDbUji>> | undefined

type Mod = {
  db: typeof import('../src/lib/db').db
  stok: typeof import('../src/lib/kasir/stok')
  trx: typeof import('../src/lib/kasir/transaksi')
  masuk: typeof import('../src/lib/kasir/masuk')
  opname: typeof import('../src/lib/kasir/opname')
  analitik: typeof import('../src/lib/kasir/analitik')
  logika: typeof import('../src/lib/kasir/logika')
}
let m: Mod

type Sesi = import('../src/lib/kasir/transaksi').SesiKasir
let A = 0 // mode kasir
let B = 0 // mode kasir
let C = 0 // mode sheet
let D = 0 // mode kasir, khusus angka dashboard dan rekap
let owner: Sesi
let adminA: Sesi
let adminB: Sesi
let banA = 0 // A, stok 20, harga efektif 100.000
let banKosong = 0 // A, stok 0, harga kosong, belum punya batch
let listingA = 0 // A, stok 10, harga 75.000
let banB = 0 // B, stok 7, harga 115.000
let banB2 = 0 // B, stok 4, harga 90.000
let banC = 0 // C (mode sheet)
let banD = 0 // D, stok 50, harga 10.000
let banD2 = 0 // D, stok 1, harga 20.000
let jasa = 0

const kunci = () => randomUUID()
const hariIni = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)

before(async () => {
  dbUji = await siapkanDbUji('kasir2')
  const [{ db }, stok, trx, masuk, opname, analitik, logika] = await Promise.all([
    import('../src/lib/db'),
    import('../src/lib/kasir/stok'),
    import('../src/lib/kasir/transaksi'),
    import('../src/lib/kasir/masuk'),
    import('../src/lib/kasir/opname'),
    import('../src/lib/kasir/analitik'),
    import('../src/lib/kasir/logika'),
  ])
  m = { db, stok, trx, masuk, opname, analitik, logika }
  A = (await db.branch.create({ data: { slug: 'contoh-a', name: 'Cabang Contoh A' } })).id
  B = (await db.branch.create({ data: { slug: 'contoh-b', name: 'Cabang Contoh B' } })).id
  C = (await db.branch.create({ data: { slug: 'contoh-c', name: 'Cabang Contoh C' } })).id
  D = (await db.branch.create({ data: { slug: 'contoh-d', name: 'Cabang Contoh D' } })).id
  const u = async (username: string, role: 'OWNER' | 'BRANCH_ADMIN', branchId: number | null) => {
    const x = await db.user.create({ data: { username, passwordHash: '-', role, branchId } })
    return { uid: x.id, role, branchId, name: username }
  }
  owner = await u('owner-uji', 'OWNER', null)
  adminA = await u('admin-a', 'BRANCH_ADMIN', A)
  adminB = await u('admin-b', 'BRANCH_ADMIN', B)
  const ban = (cabangId: number, sizeNorm: string, stock: number, price: number | null, discount = 0, merek = 'Merek Contoh') =>
    db.stockTire.create({ data: { cabangId, ring: 15, sizeRaw: sizeNorm, sizeNorm, brand: merek, price, discount, stock, kode: `${sizeNorm}|${merek.toLowerCase()}`, groupName: 'R15' } })
  banA = (await ban(A, '185/65R15', 20, 110_000, 10_000)).id
  banKosong = (await ban(A, '205/65R15', 0, null)).id
  banB = (await ban(B, '185/65R15', 7, 115_000)).id
  banB2 = (await ban(B, '195/60R15', 4, 90_000)).id
  banC = (await ban(C, '185/65R15', 3, 100_000)).id
  banD = (await ban(D, '175/65R14', 50, 10_000)).id
  banD2 = (await ban(D, '165/65R13', 1, 20_000)).id
  const p = await db.product.create({ data: { slug: 'oli-contoh', name: 'Oli Contoh 1L', kode: 'OLI-CONTOH' } })
  listingA = (await db.listing.create({ data: { productId: p.id, branchId: A, price: 75_000, stock: 10 } })).id
  jasa = (await db.servicePrice.create({ data: { groupName: 'Balancing', name: 'Balancing', price: 25_000, unit: 'per roda' } })).id
  for (const [id, kode] of [[A, 'CTA'], [B, 'CTB'], [D, 'CTD']] as const) await stok.aktifkanKasir({ cabangId: id, kodeNota: kode, pengguna: String(owner.uid) })
})

after(async () => {
  await m?.db.$disconnect()
  await dbUji?.hapus()
})

type BarisMasuk = { sumber: 'ban' | 'produk'; id: number; jumlah: number; hargaBeli?: number | null; hargaJual?: number | null }
const masukInput = (cabangId: number, baris: BarisMasuk[], lain: Record<string, unknown> = {}) =>
  m.masuk.bacaInputBarangMasuk({ cabangId, pemasok: 'Distributor Contoh', jenisPemasok: 'distributor', tanggalPesan: '', tanggalTerima: hariIni(), catatan: '', kunci: kunci(), baris, ...lain })
const jualInput = (cabangId: number, baris: { sumber: 'ban' | 'produk' | 'jasa'; id: number; jumlah: number }[], lain: Partial<import('../src/lib/kasir/transaksi').InputJual> = {}) =>
  m.trx.bacaInputJual({ cabangId, channel: 'toko', metode: 'qris', diskon: 0, alasanDiskon: '', dibayar: null, kunci: kunci(), baris, ...lain })
const stokBan = async (id: number) => (await m.db.stockTire.findUniqueOrThrow({ where: { id } })).stock
const invarianBersih = async () => assert.deepEqual((await m.stok.periksaInvarian()).masalah, [])
const negatifTidakAda = async () => {
  assert.equal(await m.db.batchStok.count({ where: { sisa: { lt: 0 } } }), 0)
  assert.equal(await m.db.stockTire.count({ where: { stock: { lt: 0 } } }), 0)
  assert.equal(await m.db.listing.count({ where: { stock: { lt: 0 } } }), 0)
}

test('logika: nomor penerimaan, minggu dan bulan WIB, lead time, hasil opname, sel CSV', () => {
  const L = m.logika
  assert.equal(L.formatNomorPenerimaan('BTU', '261120', 7), 'BM-BTU-261120-007')
  assert.equal(L.formatNomorPenerimaan('BM', '261120', 1234), 'BM-BM-261120-1234')
  assert.notEqual(L.formatNomorPenerimaan('BTU', '261120', 1), L.formatNomor('BTU', '261120', 1))
  assert.equal(L.awalMingguWib(new Date('2026-11-15T16:59:59Z')), '2026-11-09') // Minggu 23.59 WIB
  assert.equal(L.awalMingguWib(new Date('2026-11-15T17:00:00Z')), '2026-11-16') // Senin 00.00 WIB
  assert.deepEqual(L.rentangBulanWib('2026-11'), { mulai: new Date('2026-10-31T17:00:00Z'), akhir: new Date('2026-11-30T17:00:00Z') })
  assert.equal(L.rentangBulanWib('2026-13'), null)
  assert.equal(L.leadTimeHari(L.tanggalKeWaktu('2026-10-28'), L.tanggalKeWaktu('2026-11-02')!), 5)
  assert.equal(L.leadTimeHari(null, new Date()), null)
  assert.deepEqual(L.hasilOpname(5, -2), { akhir: 3, negatif: false })
  assert.deepEqual(L.hasilOpname(1, -2), { akhir: -1, negatif: true })
  assert.equal(L.selCsv('=1+1'), "'=1+1")
  assert.equal(L.selCsv('+62812'), "'+62812")
  assert.equal(L.selCsv('-abc'), "'-abc")
  assert.equal(L.selCsv('@SUM(A1)'), "'@SUM(A1)")
  assert.equal(L.selCsv('\tx'), "'\tx")
  assert.equal(L.selCsv(-5), '-5')
  assert.equal(L.selCsv('a,"b"'), '"a,""b"""')
  assert.equal(L.selCsv(null), '')
  assert.equal(L.keCsv(['a', 'b'], [[1, '=x']]), "a,b\r\n1,'=x\r\n")
})

test('barang masuk oleh owner: batch masuk, stok baris, buku_stok, dan peringatan ditutup dalam satu transaksi', async () => {
  await m.stok.aturBatasMinimum({ sumber: 'ban', barisId: banA, batas: 25 })
  assert.equal(await m.db.peringatanStok.count({ where: { barisId: banA, status: 'aktif' } }), 1)
  const h = await m.masuk.catatBarangMasuk(
    owner,
    masukInput(A, [{ sumber: 'ban', id: banA, jumlah: 10, hargaBeli: 80_000 }, { sumber: 'produk', id: listingA, jumlah: 5, hargaJual: 80_000 }], { tanggalPesan: '2026-11-10', jenisPemasok: 'rekanan' }),
  )
  assert.match(h.nomor, /^BM-CTA-\d{6}-001$/)
  assert.equal(h.diajukan, 0)
  assert.equal(await stokBan(banA), 30)
  const batch = await m.db.batchStok.findFirstOrThrow({ where: { sumber: 'ban', barisId: banA, jenis: 'masuk' } })
  assert.deepEqual([batch.jumlahAwal, batch.sisa, batch.hargaJual, batch.hargaBeli], [10, 10, 100_000, 80_000])
  const detail = await m.db.detailBarangMasuk.findFirstOrThrow({ where: { barangMasukId: h.id, sumber: 'ban' } })
  assert.equal(batch.detailBarangMasukId, detail.id)
  assert.equal(detail.batchId, batch.id)
  const buku = await m.db.bukuStok.findMany({ where: { refId: `masuk:${h.id}` }, orderBy: { id: 'asc' } })
  assert.deepEqual(buku.map((b) => [b.tipe, b.perubahan, b.saldoAkhir]), [['masuk', 10, 30], ['masuk', 5, 15]])
  assert.equal(await m.db.peringatanStok.count({ where: { barisId: banA, status: 'aktif' } }), 0)
  // Owner langsung memakai harganya untuk batch baru. Batch lama tetap 75.000 dan masih terdepan.
  const bl = await m.db.batchStok.findFirstOrThrow({ where: { sumber: 'produk', barisId: listingA, jenis: 'masuk' } })
  assert.equal(bl.hargaJual, 80_000)
  assert.equal((await m.db.listing.findUniqueOrThrow({ where: { id: listingA } })).price, 75_000)
  const rh = await m.db.riwayatHarga.findFirstOrThrow({ where: { batchId: bl.id } })
  assert.deepEqual([rh.hargaLama, rh.harga], [75_000, 80_000])
  assert.equal(await m.db.pengajuanHarga.count({ where: { tipe: 'restock' } }), 0)
  const k = await m.db.barangMasuk.findUniqueOrThrow({ where: { id: h.id } })
  assert.equal(m.logika.leadTimeHari(k.tanggalPesan, k.tanggalTerima), m.logika.leadTimeHari(m.logika.tanggalKeWaktu('2026-11-10'), m.logika.tanggalKeWaktu(hariIni())!))
  assert.equal(await m.db.logAktivitas.count({ where: { aksi: 'barang_masuk' } }), 1)
  await invarianBersih()
})

test('masukan barang masuk diperiksa: pemasok, tanggal, jumlah, dan barang ganda', () => {
  assert.throws(() => masukInput(A, [{ sumber: 'ban', id: banA, jumlah: 1 }], { pemasok: '' }), /pemasok/)
  assert.throws(() => masukInput(A, [{ sumber: 'ban', id: banA, jumlah: 1 }], { jenisPemasok: 'lain' }), /jenis pemasok/)
  assert.throws(() => masukInput(A, [{ sumber: 'ban', id: banA, jumlah: 1 }], { tanggalTerima: '2999-01-01' }), /sesudah hari ini/)
  assert.throws(() => masukInput(A, [{ sumber: 'ban', id: banA, jumlah: 1 }], { tanggalPesan: '2999-01-01' }), /sesudah tanggal terima/)
  assert.throws(() => masukInput(A, [{ sumber: 'ban', id: banA, jumlah: 0 }]), /Jumlah/)
  assert.throws(() => masukInput(A, [{ sumber: 'ban', id: banA, jumlah: 1 }, { sumber: 'ban', id: banA, jumlah: 2 }]), /dua kali/)
  assert.throws(() => masukInput(A, []), /minimal satu/)
})

test('usulan harga admin: pengajuan restock, batch memakai harga lama sampai disetujui, ditolak tidak mengubah apa pun', async () => {
  // Barang tanpa batch dan tanpa harga: harga lamanya 0, jadi usulan wajib diisi dan barang belum bisa dijual.
  await assert.rejects(m.masuk.catatBarangMasuk(adminA, masukInput(A, [{ sumber: 'ban', id: banKosong, jumlah: 4 }])), /belum punya harga jual/)
  const h1 = await m.masuk.catatBarangMasuk(adminA, masukInput(A, [{ sumber: 'ban', id: banKosong, jumlah: 4, hargaJual: 200_000 }]))
  assert.equal(h1.diajukan, 1)
  const p1 = await m.db.pengajuanHarga.findFirstOrThrow({ where: { tipe: 'restock', sumber: 'ban', kodeProduk: '205/65R15|merek contoh' } })
  assert.deepEqual([p1.status, p1.hargaLama, p1.hargaBaru, p1.pengajuId, p1.cabangId], ['menunggu', 0, 200_000, adminA.uid, A])
  const b1 = await m.db.batchStok.findUniqueOrThrow({ where: { id: p1.batchId! } })
  assert.equal(b1.hargaJual, 0)
  assert.equal((await m.db.stockTire.findUniqueOrThrow({ where: { id: banKosong } })).price, null)
  await assert.rejects(m.trx.jual(adminA, jualInput(A, [{ sumber: 'ban', id: banKosong, jumlah: 1 }])), /harga belum diatur/)

  // banA: dua usulan untuk dua batch baru yang belum terdepan.
  const h2 = await m.masuk.catatBarangMasuk(adminA, masukInput(A, [{ sumber: 'ban', id: banA, jumlah: 5, hargaJual: 120_000 }]))
  const h3 = await m.masuk.catatBarangMasuk(adminA, masukInput(A, [{ sumber: 'ban', id: banA, jumlah: 3, hargaJual: 130_000 }]))
  const [p2, p3] = await Promise.all([h2, h3].map((h) => m.db.detailBarangMasuk.findFirstOrThrow({ where: { barangMasukId: h.id } }).then((d) => m.db.pengajuanHarga.findUniqueOrThrow({ where: { id: d.pengajuanHargaId! } }))))
  assert.deepEqual([p2.hargaLama, p2.hargaBaru, p3.hargaBaru], [100_000, 120_000, 130_000])
  assert.deepEqual((await m.db.batchStok.findMany({ where: { id: { in: [p2.batchId!, p3.batchId!] } }, orderBy: { id: 'asc' } })).map((b) => b.hargaJual), [100_000, 100_000])

  // Hanya owner, dan jalur keputusan diskon tidak bisa dipakai untuk restock.
  await assert.rejects(m.masuk.putuskanRestock(adminA, { id: p1.id, keputusan: 'disetujui' }), /Hanya owner/)
  await assert.rejects(m.trx.putuskanPengajuan(owner, { id: p1.id, keputusan: 'disetujui' }), /tidak ditemukan/)

  // Disetujui: batch berubah, riwayat dan log tercatat, harga baris mengikuti batch terdepan.
  await m.masuk.putuskanRestock(owner, { id: p1.id, keputusan: 'disetujui' })
  assert.equal((await m.db.batchStok.findUniqueOrThrow({ where: { id: p1.batchId! } })).hargaJual, 200_000)
  assert.equal((await m.db.stockTire.findUniqueOrThrow({ where: { id: banKosong } })).price, 200_000)
  const rh = await m.db.riwayatHarga.findFirstOrThrow({ where: { batchId: p1.batchId!, hargaLama: 0 }, orderBy: { id: 'desc' } })
  assert.equal(rh.harga, 200_000)
  assert.equal(await m.db.logAktivitas.count({ where: { aksi: 'restock_disetujui' } }), 1)
  const t = await m.trx.jual(adminA, jualInput(A, [{ sumber: 'ban', id: banKosong, jumlah: 1 }]))
  assert.equal((await m.db.detailTransaksi.findFirstOrThrow({ where: { transaksiId: t.id } })).hargaSatuan, 200_000)

  // p2 disetujui (batch bukan terdepan, harga baris tetap), p3 ditolak.
  await m.masuk.putuskanRestock(owner, { id: p2.id, keputusan: 'disetujui' })
  await m.masuk.putuskanRestock(owner, { id: p3.id, keputusan: 'ditolak' })
  assert.equal((await m.db.stockTire.findUniqueOrThrow({ where: { id: banA } })).price, 100_000)
  assert.equal((await m.db.batchStok.findUniqueOrThrow({ where: { id: p3.batchId! } })).hargaJual, 100_000)
  assert.equal((await m.db.pengajuanHarga.findUniqueOrThrow({ where: { id: p3.id } })).status, 'ditolak')
  // Keputusan tidak bisa diulang, termasuk dua keputusan bersamaan.
  await assert.rejects(m.masuk.putuskanRestock(owner, { id: p3.id, keputusan: 'disetujui' }), /sudah diputuskan/)
  await assert.rejects(m.masuk.putuskanRestock(owner, { id: p1.id, keputusan: 'ditolak' }), /sudah diputuskan/)

  // Jual sampai batch p2: 30 unit lama (batch awal dan masuk owner) dengan 100.000, unit ke-31 dengan 120.000.
  assert.equal(await stokBan(banA), 38)
  const t2 = await m.trx.jual(owner, jualInput(A, [{ sumber: 'ban', id: banA, jumlah: 31 }]))
  const det = await m.db.detailTransaksi.findMany({ where: { transaksiId: t2.id }, orderBy: { id: 'asc' } })
  assert.deepEqual(det.map((d) => [d.jumlah, d.hargaSatuan]), [[20, 100_000], [10, 100_000], [1, 120_000]])
  assert.equal((await m.db.stockTire.findUniqueOrThrow({ where: { id: banA } })).price, 120_000)
  await invarianBersih()
})

test('kiriman ganda barang masuk dengan kunci yang sama hanya menghasilkan satu penerimaan', async () => {
  const awal = await stokBan(banA)
  const x = masukInput(A, [{ sumber: 'ban', id: banA, jumlah: 2 }])
  const [h1, h2] = await Promise.all([m.masuk.catatBarangMasuk(owner, x), m.masuk.catatBarangMasuk(owner, x)])
  assert.equal(h1.id, h2.id)
  assert.equal([h1.ulang, h2.ulang].filter(Boolean).length, 1)
  assert.equal(await m.db.barangMasuk.count({ where: { idempotencyKey: x.kunci } }), 1)
  assert.equal(await stokBan(banA), awal + 2)
  const h3 = await m.masuk.catatBarangMasuk(owner, x)
  assert.deepEqual([h3.id, h3.ulang], [h1.id, true])
  await assert.rejects(m.masuk.catatBarangMasuk(owner, { ...x, cabangId: B }), /sudah dipakai/)
  await invarianBersih()
})

test('admin tidak bisa mencatat barang masuk atau opname untuk cabang lain, dan tidak bisa memfinalkan opname', async () => {
  await assert.rejects(m.masuk.catatBarangMasuk(adminB, masukInput(A, [{ sumber: 'ban', id: banA, jumlah: 1 }])), /cabang sendiri/)
  // Formulir diubah: cabang sendiri, tetapi barangnya milik cabang lain.
  await assert.rejects(m.masuk.catatBarangMasuk(adminB, masukInput(B, [{ sumber: 'ban', id: banA, jumlah: 1 }])), /bukan stok cabang ini/)
  await assert.rejects(m.opname.mulaiOpname(adminB, { cabangId: A }), /cabang sendiri/)
  const o = await m.opname.mulaiOpname(adminA, { cabangId: A })
  await assert.rejects(m.opname.isiBarisOpname(adminB, { opnameId: o.id, sumber: 'ban', barisId: banA, stokFisik: 1, alasan: 'uji' }), /cabang lain/)
  await assert.rejects(m.opname.isiBarisOpname(adminA, { opnameId: o.id, sumber: 'ban', barisId: banB, stokFisik: 1, alasan: 'uji' }), /bukan stok cabang ini/)
  await m.opname.isiBarisOpname(adminA, { opnameId: o.id, sumber: 'ban', barisId: banA, stokFisik: await stokBan(banA), alasan: '' })
  await assert.rejects(m.opname.ubahStatusOpname(adminB, { id: o.id, ke: 'review' }), /cabang lain/)
  await assert.rejects(m.opname.finalkanOpname(adminA, o.id), /Hanya owner/)
  await m.opname.ubahStatusOpname(adminA, { id: o.id, ke: 'review' })
  // Sedang ditinjau: admin tidak bisa mengubah baris dan tidak bisa mengembalikan ke draft.
  await assert.rejects(m.opname.isiBarisOpname(adminA, { opnameId: o.id, sumber: 'ban', barisId: banA, stokFisik: 1, alasan: 'uji' }), /ditinjau owner/)
  await assert.rejects(m.opname.ubahStatusOpname(adminA, { id: o.id, ke: 'draft' }), /Hanya owner/)
  await m.opname.ubahStatusOpname(owner, { id: o.id, ke: 'draft' })
  await m.opname.hapusOpname(adminA, o.id)
  assert.equal(await m.db.stokOpname.count({ where: { id: o.id } }), 0)
})

test('barang masuk dan opname di cabang mode sheet ditolak', async () => {
  await assert.rejects(m.masuk.catatBarangMasuk(owner, masukInput(C, [{ sumber: 'ban', id: banC, jumlah: 1 }])), /masih diisi dari sheet/)
  await assert.rejects(m.opname.mulaiOpname(owner, { cabangId: C }), /masih diisi dari sheet/)
  assert.equal(await stokBan(banC), 3)
})

test('opname: selisih plus dan minus diterapkan ke stok sekarang sesudah ada penjualan, lalu tidak bisa difinalkan ulang', async () => {
  const o = await m.opname.mulaiOpname(adminB, { cabangId: B })
  await assert.rejects(m.opname.mulaiOpname(owner, { cabangId: B }), /belum final/)
  await assert.rejects(m.opname.isiBarisOpname(adminB, { opnameId: o.id, sumber: 'ban', barisId: banB, stokFisik: 9, alasan: '' }), /alasan selisih/)
  await m.opname.isiBarisOpname(adminB, { opnameId: o.id, sumber: 'ban', barisId: banB, stokFisik: 9, alasan: 'salah hitung kiriman lalu' })
  await m.opname.isiBarisOpname(adminB, { opnameId: o.id, sumber: 'ban', barisId: banB2, stokFisik: 1, alasan: 'tiga rusak' })
  const det = await m.db.detailOpname.findMany({ where: { opnameId: o.id }, orderBy: { id: 'asc' } })
  assert.deepEqual(det.map((d) => [d.stokSistem, d.stokFisik, d.selisih]), [[7, 9, 2], [4, 1, -3]])
  // Penjualan sesudah baris diisi, sebelum final.
  await m.trx.jual(adminB, jualInput(B, [{ sumber: 'ban', id: banB, jumlah: 1 }]))
  await m.opname.ubahStatusOpname(adminB, { id: o.id, ke: 'review' })
  await assert.rejects(m.opname.finalkanOpname(adminB, o.id), /Hanya owner/)
  const h = await m.opname.finalkanOpname(owner, o.id)
  assert.deepEqual([h.baris, h.berubah], [2, 2])
  assert.equal(await stokBan(banB), 8) // 6 sesudah jual, ditambah 2
  assert.equal(await stokBan(banB2), 1)
  const akhir = await m.db.detailOpname.findMany({ where: { opnameId: o.id }, orderBy: { id: 'asc' } })
  assert.deepEqual(akhir.map((d) => [d.stokSaatFinal, d.stokAkhir]), [[6, 8], [4, 1]])
  const buku = await m.db.bukuStok.findMany({ where: { refId: `opname:${o.id}` }, orderBy: { id: 'asc' } })
  assert.deepEqual(buku.map((b) => [b.tipe, b.perubahan, b.saldoAkhir]), [['opname', 2, 8], ['opname', -3, 1]])
  const bOp = await m.db.batchStok.findFirstOrThrow({ where: { sumber: 'ban', barisId: banB, jenis: 'opname' } })
  assert.deepEqual([bOp.jumlahAwal, bOp.hargaJual], [2, 115_000])
  assert.equal((await m.db.stokOpname.findUniqueOrThrow({ where: { id: o.id } })).status, 'final')
  await assert.rejects(m.opname.finalkanOpname(owner, o.id), /sudah final/)
  await assert.rejects(m.opname.isiBarisOpname(owner, { opnameId: o.id, sumber: 'ban', barisId: banB, stokFisik: 1, alasan: 'uji' }), /sudah final/)
  await assert.rejects(m.opname.hapusOpname(owner, o.id), /draft/)
  await invarianBersih()
})

test('opname: hasil yang akan negatif menolak seluruh finalisasi sampai baris itu dihitung ulang', async () => {
  const o = await m.opname.mulaiOpname(adminB, { cabangId: B })
  await m.opname.isiBarisOpname(adminB, { opnameId: o.id, sumber: 'ban', barisId: banB2, stokFisik: 0, alasan: 'hilang' }) // sistem 1, selisih -1
  await m.opname.isiBarisOpname(adminB, { opnameId: o.id, sumber: 'ban', barisId: banB, stokFisik: 10, alasan: 'kiriman belum dicatat' }) // 8 ke 10
  await m.trx.jual(adminB, jualInput(B, [{ sumber: 'ban', id: banB2, jumlah: 1 }])) // stok 0, hasil opname akan -1
  await assert.rejects(m.opname.finalkanOpname(owner, o.id), /minus.*195\/60R15/)
  assert.equal(await stokBan(banB2), 0)
  assert.equal(await stokBan(banB), 8) // baris lain juga tidak berubah
  assert.notEqual((await m.db.stokOpname.findUniqueOrThrow({ where: { id: o.id } })).status, 'final')
  // Dihitung ulang: sistem sekarang 0, fisik 0, selisih 0.
  await m.opname.isiBarisOpname(owner, { opnameId: o.id, sumber: 'ban', barisId: banB2, stokFisik: 0, alasan: '' })
  await m.opname.finalkanOpname(owner, o.id)
  assert.equal(await stokBan(banB2), 0)
  assert.equal(await stokBan(banB), 10)
  await invarianBersih()
})

test('balapan: penjualan dan finalisasi opname, atau penjualan dan barang masuk, pada baris yang sama', async () => {
  // Baris baru di A dengan stok 2 lewat barang masuk.
  const baru = await m.db.stockTire.create({ data: { cabangId: A, ring: 16, sizeRaw: '215/60R16', sizeNorm: '215/60R16', brand: 'Merek Contoh', price: 300_000, stock: 0, kode: '215/60R16|merek contoh', groupName: 'R16' } })
  await m.masuk.catatBarangMasuk(owner, masukInput(A, [{ sumber: 'ban', id: baru.id, jumlah: 2 }]))
  for (let i = 0; i < 4; i++) {
    const stok = await stokBan(baru.id)
    const o = await m.opname.mulaiOpname(adminA, { cabangId: A })
    await m.opname.isiBarisOpname(adminA, { opnameId: o.id, sumber: 'ban', barisId: baru.id, stokFisik: stok - 1, alasan: 'satu hilang' })
    const [jual, fin] = await Promise.allSettled([m.trx.jual(adminA, jualInput(A, [{ sumber: 'ban', id: baru.id, jumlah: 1 }])), m.opname.finalkanOpname(owner, o.id)])
    const sesudah = await stokBan(baru.id)
    const berhasil = [jual, fin].filter((x) => x.status === 'fulfilled').length
    // stok - 1 - 1 tidak pernah di bawah 0 di sini (stok 2 di putaran pertama), jadi keduanya berhasil.
    if (stok >= 2) assert.deepEqual([berhasil, sesudah], [2, stok - 2])
    else assert.ok(sesudah >= 0)
    if (fin.status === 'rejected') await m.opname.hapusOpname(owner, o.id).catch(() => m.opname.ubahStatusOpname(owner, { id: o.id, ke: 'draft' }).then(() => m.opname.hapusOpname(owner, o.id)))
    await m.masuk.catatBarangMasuk(owner, masukInput(A, [{ sumber: 'ban', id: baru.id, jumlah: 2 }]))
  }
  // Unit terakhir: opname -1 dan penjualan 1 bersamaan saat stok 1. Hanya satu yang boleh berhasil.
  const sisa = await stokBan(baru.id)
  if (sisa > 1) await m.trx.jual(owner, jualInput(A, [{ sumber: 'ban', id: baru.id, jumlah: sisa - 1 }]))
  const o = await m.opname.mulaiOpname(adminA, { cabangId: A })
  await m.opname.isiBarisOpname(adminA, { opnameId: o.id, sumber: 'ban', barisId: baru.id, stokFisik: 0, alasan: 'hilang' })
  const hasil = await Promise.allSettled([m.trx.jual(adminA, jualInput(A, [{ sumber: 'ban', id: baru.id, jumlah: 1 }])), m.opname.finalkanOpname(owner, o.id)])
  assert.equal(hasil.filter((x) => x.status === 'fulfilled').length, 1)
  assert.equal(await stokBan(baru.id), 0)
  if (hasil[1].status === 'rejected') await m.opname.hapusOpname(owner, o.id)

  // Penjualan dan barang masuk bersamaan.
  const awal = await stokBan(banA)
  const kirim = []
  for (let i = 0; i < 5; i++) kirim.push(m.trx.jual(adminA, jualInput(A, [{ sumber: 'ban', id: banA, jumlah: 1 }])), m.masuk.catatBarangMasuk(adminA, masukInput(A, [{ sumber: 'ban', id: banA, jumlah: 3 }])))
  const r = await Promise.allSettled(kirim)
  assert.equal(r.filter((x) => x.status === 'rejected').length, 0)
  assert.equal(await stokBan(banA), awal - 5 + 15)
  await negatifTidakAda()
  await invarianBersih()
})

test('dashboard dan rekap bulanan sama dengan hitungan langsung, termasuk dekat tengah malam WIB dan transaksi void', async () => {
  const jual = async (baris: { sumber: 'ban' | 'jasa'; id: number; jumlah: number }[], waktu: string, lain: Partial<import('../src/lib/kasir/transaksi').InputJual> = {}) => {
    const h = await m.trx.jual(owner, jualInput(D, baris, lain))
    await m.db.transaksi.update({ where: { id: h.id }, data: { waktuTransaksi: new Date(waktu) } })
    await m.db.bukuStok.updateMany({ where: { refId: `transaksi:${h.id}` }, data: { waktu: new Date(waktu) } })
    return h
  }
  await jual([{ sumber: 'ban', id: banD, jumlah: 2 }, { sumber: 'jasa', id: jasa, jumlah: 1 }], '2026-11-15T16:59:59Z', { diskon: 4_500, alasanDiskon: 'kenalan' }) // Minggu 15/11 23.59 WIB
  await jual([{ sumber: 'ban', id: banD, jumlah: 1 }], '2026-11-15T17:00:00Z') // Senin 16/11 00.00 WIB
  const t3 = await jual([{ sumber: 'ban', id: banD, jumlah: 3 }], '2026-11-16T05:00:00Z')
  await m.trx.voidTransaksi(owner, { transaksiId: t3.id, alasan: 'salah input' })
  await jual([{ sumber: 'ban', id: banD, jumlah: 4 }], '2026-10-31T17:30:00Z') // 1/11 00.30 WIB
  await jual([{ sumber: 'jasa', id: jasa, jumlah: 2 }], '2026-10-31T16:30:00Z') // 31/10 23.30 WIB
  await jual([{ sumber: 'ban', id: banD2, jumlah: 1 }], '2026-11-17T03:00:00Z', { channel: 'whatsapp' }) // stok banD2 habis
  const bm = await m.masuk.catatBarangMasuk(owner, masukInput(D, [{ sumber: 'ban', id: banD, jumlah: 6, hargaBeli: 7_000 }, { sumber: 'ban', id: banD2, jumlah: 2 }], { tanggalPesan: '2026-10-28', tanggalTerima: '2026-11-02', pemasok: '=HYPERLINK("http://contoh.invalid")' }))
  await m.db.bukuStok.updateMany({ where: { refId: `masuk:${bm.id}` }, data: { waktu: new Date('2026-11-18T02:00:00Z') } })
  await m.stok.koreksiStok({ sumber: 'ban', barisId: banD, setKe: (await stokBan(banD)) - 1, alasan: 'rusak', pengguna: String(owner.uid) })
  await m.db.bukuStok.updateMany({ where: { tipe: 'koreksi', cabangId: D }, data: { waktu: new Date('2026-11-19T02:00:00Z') } })

  const rentang = (dari: string, sampai: string) => m.logika.rentangHariWib(dari, sampai)!
  const hari = await m.analitik.penjualanPerPeriode(rentang('2026-10-31', '2026-11-17'), 'hari', D)
  assert.deepEqual(
    hari.map((x) => [x.periode, x.transaksi, x.kotor, x.diskon, x.bersih]),
    [
      ['2026-10-31', 1, 50_000, 0, 50_000],
      ['2026-11-01', 1, 40_000, 0, 40_000],
      ['2026-11-15', 1, 45_000, 4_500, 40_500],
      ['2026-11-16', 1, 10_000, 0, 10_000],
      ['2026-11-17', 1, 20_000, 0, 20_000],
    ],
  )
  const minggu = await m.analitik.penjualanPerPeriode(rentang('2026-10-26', '2026-11-22'), 'minggu', D)
  assert.deepEqual(minggu.map((x) => [x.periode, x.transaksi, x.bersih]), [['2026-10-26', 2, 90_000], ['2026-11-09', 1, 40_500], ['2026-11-16', 2, 30_000]])
  // Rentang satu hari tepat di batas tengah malam.
  assert.deepEqual((await m.analitik.penjualanPerPeriode(rentang('2026-11-16', '2026-11-16'), 'hari', D)).map((x) => x.bersih), [10_000])
  const sumber = await m.analitik.penjualanPerSumber(rentang('2026-11-01', '2026-11-17'), D)
  assert.deepEqual(sumber.toSorted((a, b) => a.sumber.localeCompare(b.sumber)).map((x) => [x.sumber, x.jumlah, x.bersih]), [['ban', 8, 88_000], ['jasa', 1, 22_500]])
  const laris = await m.analitik.terlaris(rentang('2026-11-01', '2026-11-17'), D)
  assert.deepEqual(laris.map((x) => [x.kodeProduk, x.jumlah, x.bersih]), [['175/65R14|merek contoh', 7, 68_000], [`jasa:${jasa}`, 1, 22_500], ['165/65R13|merek contoh', 1, 20_000]])

  const nov = await m.analitik.rekapBulanan(m.logika.rentangBulanWib('2026-11')!, D)
  assert.deepEqual(
    nov.map((x) => [x.barisId, x.masuk, x.terjual, x.nilaiTerjual, x.penyesuaian, x.stokSekarang]),
    // banD: 50, jual 2, 1, 3 (void, kembali), 4, masuk 6, koreksi -1 = 48. Penjualan 1/11 00.30 WIB masuk November.
    [
      [banD2, 2, 1, 20_000, 0, 2],
      [banD, 6, 7, 68_000, -1, 48],
    ],
  )
  assert.deepEqual(await m.analitik.rekapBulanan(m.logika.rentangBulanWib('2026-10')!, D), [])
})

test('ekspor CSV: kolom dan nilai benar, penanda stok habis dari buku_stok, sel berbahaya diberi awalan', async () => {
  const r = m.logika.rentangHariWib('2026-10-26', '2026-11-22')!
  const baca = async (jenis: import('../src/lib/kasir/analitik').JenisEkspor) => {
    const teks = await m.analitik.isiEkspor(jenis, r)
    const [kepala, ...isi] = teks.trimEnd().split('\r\n')
    assert.equal(kepala, m.analitik.KOLOM_EKSPOR[jenis].join(','))
    const k = kepala.split(',')
    return isi.map((baris) => Object.fromEntries(baris.match(/("(?:[^"]|"")*"|[^,]*)(,|$)/g)!.slice(0, k.length).map((c, i) => [k[i], c.replace(/,$/, '')])))
  }
  const jual = (await baca('penjualan')).filter((x) => x.cabang_id === String(D))
  const w = (minggu: string, kode: string, channel = 'toko') => jual.find((x) => x.minggu_mulai === minggu && x.kode_produk === kode && x.channel === channel)
  assert.deepEqual(
    { ...w('2026-11-09', '175/65R14|merek contoh') },
    { minggu_mulai: '2026-11-09', cabang_id: String(D), cabang: 'Cabang Contoh D', sumber: 'ban', kode_produk: '175/65R14|merek contoh', nama: '175/65R14 Merek Contoh', channel: 'toko', jumlah: '2', transaksi: '1', nilai_harga_asli: '20000', diskon: '2000', nilai_bersih: '18000', harga_asli_rata: '10000', harga_efektif_rata: '9000', sempat_habis: '0' },
  )
  assert.equal(w('2026-11-09', `jasa:${jasa}`)?.sempat_habis, '')
  assert.equal(w('2026-11-16', '175/65R14|merek contoh')?.jumlah, '1') // transaksi void tidak ikut
  assert.equal(w('2026-11-16', '165/65R13|merek contoh', 'whatsapp')?.sempat_habis, '1')

  const habis = (await baca('stok-habis')).filter((x) => x.cabang_id === String(D) && x.kode_produk === '165/65R13|merek contoh')
  assert.deepEqual(habis.map((x) => [x.waktu_wib, x.minggu_mulai, x.kejadian, x.tipe, x.saldo_akhir]), [['2026-11-17 10:00', '2026-11-16', 'habis', 'jual', '0'], ['2026-11-18 09:00', '2026-11-16', 'tersedia', 'masuk', '2']])

  const bm = (await baca('barang-masuk')).filter((x) => x.cabang_id === String(D))
  assert.equal(bm.length, 2)
  assert.deepEqual(
    [bm[0].pemasok, bm[0].jenis_pemasok, bm[0].tanggal_pesan, bm[0].tanggal_terima, bm[0].lead_time_hari, bm[0].jumlah, bm[0].harga_beli, bm[0].harga_jual_usulan, bm[0].harga_batch, bm[0].status_harga],
    [`"'=HYPERLINK(""http://contoh.invalid"")"`, 'distributor', '2026-10-28', '2026-11-02', '5', '6', '7000', '10000', '10000', 'tetap'],
  )
  assert.match(bm[0].nomor_penerimaan, /^BM-CTD-\d{6}-001$/)
  // Rentang lain tidak memuat penerimaan ini.
  assert.equal((await m.analitik.isiEkspor('barang-masuk', m.logika.rentangHariWib('2026-11-03', '2026-11-04')!)).trimEnd().split('\r\n').length, 1)
})

test('invarian tetap benar sesudah urutan acak penjualan, void, barang masuk, opname, keputusan harga, dan koreksi', async () => {
  let benih = 20261122
  const acak = (n: number) => {
    benih = (benih * 1103515245 + 12345) % 2147483648
    // Bit rendah LCG modulo 2^31 berulang dengan periode pendek, jadi yang dipakai bit atasnya.
    return Math.floor(benih / 65536) % n
  }
  const barang: { sumber: 'ban' | 'produk'; id: number }[] = [{ sumber: 'ban', id: banA }, { sumber: 'ban', id: banKosong }, { sumber: 'produk', id: listingA }]
  const terjual: number[] = []
  let ditolak = 0
  const mulaiAcak = new Date()
  for (let i = 0; i < 150; i++) {
    const pilih = acak(8)
    const x = barang[acak(barang.length)]
    try {
      if (pilih <= 1) terjual.push((await m.trx.jual(acak(2) ? adminA : owner, jualInput(A, [{ ...x, jumlah: 1 + acak(4) }]))).id)
      else if (pilih === 2 && terjual.length) await m.trx.voidTransaksi(owner, { transaksiId: terjual.splice(acak(terjual.length), 1)[0], alasan: 'uji acak' })
      else if (pilih === 3) await m.masuk.catatBarangMasuk(acak(2) ? adminA : owner, masukInput(A, [{ ...x, jumlah: 1 + acak(6), hargaJual: acak(2) ? 90_000 + acak(5) * 10_000 : null }]))
      else if (pilih === 4) {
        const p = await m.db.pengajuanHarga.findFirst({ where: { tipe: 'restock', status: 'menunggu' } })
        if (p) await m.masuk.putuskanRestock(owner, { id: p.id, keputusan: acak(2) ? 'disetujui' : 'ditolak' })
      } else if (pilih === 5) {
        const buka = await m.db.stokOpname.findFirst({ where: { cabangId: A, status: { not: 'final' } } })
        const o = buka ?? (await m.opname.mulaiOpname(adminA, { cabangId: A }))
        const stok = x.sumber === 'ban' ? await stokBan(x.id) : (await m.db.listing.findUniqueOrThrow({ where: { id: x.id } })).stock
        await m.opname.isiBarisOpname(owner, { opnameId: o.id, sumber: x.sumber, barisId: x.id, stokFisik: Math.max(0, stok + acak(5) - 2), alasan: 'uji acak' })
      } else if (pilih === 6) {
        const o = await m.db.stokOpname.findFirst({ where: { cabangId: A, status: { not: 'final' } } })
        if (o) await m.opname.finalkanOpname(owner, o.id)
      } else await m.stok.koreksiStok({ sumber: x.sumber, barisId: x.id, setKe: acak(15), alasan: 'uji acak', harga: acak(2) ? 100_000 : null, pengguna: String(owner.uid) })
    } catch (e) {
      if (!(e instanceof m.logika.GalatKasir)) throw e
      ditolak++
    }
  }
  assert.ok(ditolak < 100)
  // Urutan acak benar-benar memuat tiap jenis langkah.
  const sejak = { gte: mulaiAcak }
  assert.ok((await m.db.barangMasuk.count({ where: { cabangId: A, dibuat: sejak } })) > 0)
  assert.ok((await m.db.pengajuanHarga.count({ where: { tipe: 'restock', diputuskan: sejak } })) > 0)
  assert.ok((await m.db.stokOpname.count({ where: { cabangId: A, status: 'final', difinalkan: sejak } })) > 0)
  assert.ok((await m.db.transaksi.count({ where: { cabangId: A, status: 'void', waktuVoid: sejak } })) > 0)
  await negatifTidakAda()
  await invarianBersih()
  // Saldo buku_stok tiap baris sama dengan stok baris.
  for (const x of barang) {
    const stok = x.sumber === 'ban' ? await stokBan(x.id) : (await m.db.listing.findUniqueOrThrow({ where: { id: x.id } })).stock
    const kode = x.sumber === 'ban' ? (await m.db.stockTire.findUniqueOrThrow({ where: { id: x.id } })).kode! : 'OLI-CONTOH'
    const akhir = await m.db.bukuStok.findFirst({ where: { kodeProduk: kode, cabangId: A }, orderBy: { id: 'desc' } })
    if (akhir) assert.equal(akhir.saldoAkhir, stok)
  }
})
