// Tes perbaikan audit kasir (K1 sampai K6, K11, dan keputusan opname serta harga 0). Basis data PostgreSQL sementara
// (tests/db-uji.ts). Semua data di sini karangan.
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
  logika: typeof import('../src/lib/kasir/logika')
  ubah: typeof import('../src/lib/stok/ubah')
}
let m: Mod

type Sesi = import('../src/lib/kasir/transaksi').SesiKasir
type InputJual = import('../src/lib/kasir/transaksi').InputJual
let A = 0 // mode kasir
let C = 0 // mode sheet
let owner: Sesi
let adminA: Sesi
let adminA2: Sesi
let banA = 0 // A, stok 20, harga 100.000
let banFifo = 0 // A, dua batch: 1 x 100.000 lalu 1 x 120.000
let banNol = 0 // A, stok 4, harga kosong
let pAktif = 0
let lAktif = 0 // A, stok 10, harga 50.000
let lContoh = 0 // produk contoh, A, stok 10
let lNonaktif = 0 // produk nonaktif, A, stok 5
let pNanti = 0
let lNanti = 0 // produk aktif saat kasir diaktifkan, dinonaktifkan sesudahnya
let pSheet = 0 // produk yang hanya ada di cabang mode sheet

before(async () => {
  dbUji = await siapkanDbUji('kasiraudit')
  const [{ db }, stok, trx, masuk, opname, logika, ubah] = await Promise.all([
    import('../src/lib/db'),
    import('../src/lib/kasir/stok'),
    import('../src/lib/kasir/transaksi'),
    import('../src/lib/kasir/masuk'),
    import('../src/lib/kasir/opname'),
    import('../src/lib/kasir/logika'),
    import('../src/lib/stok/ubah'),
  ])
  m = { db, stok, trx, masuk, opname, logika, ubah }
  A = (await db.branch.create({ data: { slug: 'contoh-a', name: 'Cabang Contoh A' } })).id
  C = (await db.branch.create({ data: { slug: 'contoh-c', name: 'Cabang Contoh C' } })).id
  const u = async (username: string, role: 'OWNER' | 'BRANCH_ADMIN', branchId: number | null) => {
    const x = await db.user.create({ data: { username, passwordHash: '-', role, branchId } })
    return { uid: x.id, role, branchId, name: username }
  }
  owner = await u('owner-uji', 'OWNER', null)
  adminA = await u('admin-a', 'BRANCH_ADMIN', A)
  adminA2 = await u('admin-a-2', 'BRANCH_ADMIN', A)
  const ban = (sizeNorm: string, stock: number, price: number | null) =>
    db.stockTire.create({ data: { cabangId: A, ring: 15, sizeRaw: sizeNorm, sizeNorm, brand: 'Merek Contoh', price, stock, kode: `${sizeNorm}|merek contoh`, groupName: 'R15' } })
  banA = (await ban('185/65R15', 20, 100_000)).id
  banFifo = (await ban('195/60R15', 0, 100_000)).id
  banNol = (await ban('205/65R15', 4, null)).id
  const produk = async (slug: string, stock: number, lain: { active?: boolean; isSample?: boolean } = {}) => {
    const p = await db.product.create({ data: { slug, name: `Produk ${slug}`, kode: slug.toUpperCase(), ...lain } })
    return { p: p.id, l: (await db.listing.create({ data: { productId: p.id, branchId: A, price: 50_000, stock } })).id }
  }
  ;({ p: pAktif, l: lAktif } = await produk('oli-aktif', 10))
  lContoh = (await produk('oli-contoh', 10, { isSample: true, active: false })).l
  lNonaktif = (await produk('oli-nonaktif', 5, { active: false })).l
  ;({ p: pNanti, l: lNanti } = await produk('oli-nanti', 3))
  pSheet = (await db.product.create({ data: { slug: 'oli-sheet', name: 'Produk sheet', kode: 'OLI-SHEET' } })).id
  await db.listing.create({ data: { productId: pSheet, branchId: C, price: 40_000, stock: 2 } })
})

after(async () => {
  await m?.db.$disconnect()
  await dbUji?.hapus()
})

const kunci = () => randomUUID()
const jualInput = (baris: InputJual['baris'], lain: Partial<InputJual> = {}): InputJual => ({
  cabangId: A,
  channel: 'toko',
  metode: 'qris',
  diskon: 0,
  alasanDiskon: '',
  dibayar: null,
  kunci: kunci(),
  totalDilihat: null,
  baris,
  ...lain,
})
const hariIni = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
const masukInput = (baris: { sumber: 'ban' | 'produk'; id: number; jumlah: number; hargaJual?: number }[], lain: Record<string, unknown> = {}) =>
  m.masuk.bacaInputBarangMasuk({ cabangId: A, pemasok: 'Distributor Contoh', jenisPemasok: 'distributor', tanggalPesan: '', tanggalTerima: hariIni(), catatan: '', kunci: kunci(), baris, ...lain })
const stok = async (sumber: 'ban' | 'produk', id: number) =>
  sumber === 'ban' ? (await m.db.stockTire.findUniqueOrThrow({ where: { id } })).stock : (await m.db.listing.findUniqueOrThrow({ where: { id } })).stock
const sisaBatch = async (sumber: string, barisId: number) => (await m.db.batchStok.findMany({ where: { sumber, barisId }, orderBy: { id: 'asc' } })).map((b) => b.sisa)
// Listing yang dimuat katalog kasir (src/lib/kasir/katalog.ts memakai saringan PRODUK_KASIR yang sama). katalog.ts
// sendiri tidak bisa diimpor tes karena memakai server-only.
const listingKatalog = async () => (await m.db.listing.findMany({ where: { branchId: A, product: m.stok.PRODUK_KASIR }, select: { id: true } })).map((l) => l.id)
const invarianBersih = async () => assert.deepEqual((await m.stok.periksaInvarian()).masalah, [])

test('K2: pengaktifan melewati produk contoh dan produk nonaktif, katalog tidak menampilkannya', async () => {
  const calon = await m.stok.hitungCalonAktivasi(A)
  assert.deepEqual([calon.produk, calon.produkStok], [2, 2]) // oli-aktif dan oli-nanti saja
  const h = await m.stok.aktifkanKasir({ cabangId: A, kodeNota: 'CTA', pengguna: String(owner.uid) })
  assert.equal(h.batch, 4) // banA, banNol, oli-aktif, oli-nanti
  assert.deepEqual(await sisaBatch('produk', lContoh), [])
  assert.deepEqual(await sisaBatch('produk', lNonaktif), [])
  assert.equal(await stok('produk', lContoh), 10) // stoknya tidak diubah, hanya di luar kasir
  assert.deepEqual((await listingKatalog()).toSorted(), [lAktif, lNanti].toSorted())
  await invarianBersih()
  // Dua batch untuk FIFO: 1 x 100.000 lalu 1 x 120.000.
  await m.stok.koreksiStok({ sumber: 'ban', barisId: banFifo, setKe: 1, alasan: 'uji fifo', harga: 100_000, pengguna: String(owner.uid) })
  await m.stok.koreksiStok({ sumber: 'ban', barisId: banFifo, setKe: 2, alasan: 'uji fifo', harga: 120_000, pengguna: String(owner.uid) })
  assert.deepEqual(await sisaBatch('ban', banFifo), [1, 1])
})

test('K2: produk contoh dan nonaktif ditolak di penjualan, barang masuk, opname, dan koreksi', async () => {
  for (const id of [lContoh, lNonaktif]) {
    await assert.rejects(m.trx.jual(adminA, jualInput([{ sumber: 'produk', id, jumlah: 1 }])), /produk contoh atau sedang nonaktif/)
    await assert.rejects(m.masuk.catatBarangMasuk(owner, masukInput([{ sumber: 'produk', id, jumlah: 1, hargaJual: 60_000 }])), /produk contoh atau sedang nonaktif/)
    await assert.rejects(m.stok.koreksiStok({ sumber: 'produk', barisId: id, setKe: 3, alasan: 'uji', harga: 60_000, pengguna: null }), /produk contoh atau sedang nonaktif/)
  }
  const o = await m.opname.mulaiOpname(adminA, { cabangId: A })
  await assert.rejects(m.opname.isiBarisOpname(adminA, { opnameId: o.id, sumber: 'produk', barisId: lContoh, stokFisik: 10, alasan: '' }), /produk contoh/)
  await m.opname.hapusOpname(adminA, o.id)
  assert.equal(await m.db.transaksi.count(), 0)
  assert.equal(await stok('produk', lContoh), 10)
  await invarianBersih()
})

test('K2: produk yang dinonaktifkan sesudah punya batch tidak bisa dijual, tetapi nota lamanya tetap bisa di-void', async () => {
  const h = await m.trx.jual(adminA, jualInput([{ sumber: 'produk', id: lNanti, jumlah: 1 }]))
  await m.db.product.update({ where: { id: pNanti }, data: { active: false } })
  assert.deepEqual(await listingKatalog(), [lAktif])
  await assert.rejects(m.trx.jual(adminA, jualInput([{ sumber: 'produk', id: lNanti, jumlah: 1 }])), /nonaktif/)
  await m.trx.voidTransaksi(owner, { transaksiId: h.id, alasan: 'barang dikembalikan' })
  assert.deepEqual(await sisaBatch('produk', lNanti), [3])
  // Sisa stoknya masih boleh dinolkan owner lewat koreksi, karena barisnya sudah punya batch.
  await m.stok.koreksiStok({ sumber: 'produk', barisId: lNanti, setKe: 0, alasan: 'berhenti dijual', pengguna: String(owner.uid) })
  await invarianBersih()
})

test('K1: kunci sama dengan isi berbeda ditolak dan menunjuk nota yang tersimpan, isi sama dikembalikan', async () => {
  const k = kunci()
  const pertama = await m.trx.jual(adminA, jualInput([{ sumber: 'ban', id: banA, jumlah: 1 }], { kunci: k }))
  const stokSesudah = await stok('ban', banA)
  const ulang = await m.trx.jual(adminA, jualInput([{ sumber: 'ban', id: banA, jumlah: 1 }], { kunci: k }))
  assert.deepEqual([ulang.id, ulang.ulang], [pertama.id, true])
  for (const beda of [
    jualInput([{ sumber: 'ban', id: banA, jumlah: 3 }], { kunci: k }),
    jualInput([{ sumber: 'ban', id: banA, jumlah: 1 }, { sumber: 'produk', id: lAktif, jumlah: 1 }], { kunci: k }),
    jualInput([{ sumber: 'ban', id: banA, jumlah: 1 }], { kunci: k, metode: 'debit' }),
  ]) {
    await assert.rejects(m.trx.jual(adminA, beda), (e: unknown) => {
      assert.ok(e instanceof m.logika.GalatKunciDipakai)
      assert.deepEqual(e.ref, { id: pertama.id, nomor: pertama.nomor })
      assert.match(e.message, new RegExp(`tersimpan sebagai nota ${pertama.nomor}`))
      return true
    })
  }
  assert.equal(await stok('ban', banA), stokSesudah)
  assert.equal(await m.db.transaksi.count({ where: { idempotencyKey: k } }), 1)
  const t = await m.db.transaksi.findUniqueOrThrow({ where: { id: pertama.id } })
  assert.match(t.sidikIsi ?? '', /^[0-9a-f]{64}$/)
})

test('K1: cek status kunci, lalu kiriman lama yang datang sesudah kuncinya ditutup ditolak', async () => {
  // Tersimpan: cocok kalau isinya sama, tidak cocok kalau berbeda.
  const k = kunci()
  const isi = jualInput([{ sumber: 'ban', id: banA, jumlah: 1 }], { kunci: k })
  const h = await m.trx.jual(adminA, isi)
  assert.deepEqual(await m.trx.cekKunciJual(adminA, isi), { status: 'tersimpan', id: h.id, nomor: h.nomor, cocok: true })
  assert.deepEqual(await m.trx.cekKunciJual(adminA, { ...isi, baris: [{ sumber: 'ban', id: banA, jumlah: 2 }] }), { status: 'tersimpan', id: h.id, nomor: h.nomor, cocok: false })

  // Belum tersimpan: kunci ditutup. Kiriman pertama yang baru sampai sesudahnya ditolak, jadi kunci baru tidak membuat nota ganda.
  const k2 = kunci()
  const isi2 = jualInput([{ sumber: 'ban', id: banA, jumlah: 1 }], { kunci: k2 })
  const stokAwal = await stok('ban', banA)
  assert.deepEqual(await m.trx.cekKunciJual(adminA, isi2), { status: 'belum' })
  assert.deepEqual(await m.trx.cekKunciJual(adminA, isi2), { status: 'belum' })
  await assert.rejects(m.trx.jual(adminA, isi2), /Cek status/)
  assert.equal(await m.db.transaksi.count({ where: { idempotencyKey: k2 } }), 0)
  assert.equal(await stok('ban', banA), stokAwal)
  const baru = await m.trx.jual(adminA, { ...isi2, kunci: kunci() })
  assert.equal(await stok('ban', banA), stokAwal - 1)
  assert.ok(baru.id > h.id)

  // Kiriman dan cek status bersamaan: hasilnya selalu satu dari dua, tidak pernah nota yang tidak terlihat.
  const k3 = kunci()
  const isi3 = jualInput([{ sumber: 'ban', id: banA, jumlah: 1 }], { kunci: k3 })
  const [j, c] = await Promise.allSettled([m.trx.jual(adminA, isi3), m.trx.cekKunciJual(adminA, isi3)])
  const ada = await m.db.transaksi.count({ where: { idempotencyKey: k3 } })
  assert.equal(c.status, 'fulfilled')
  if (c.status === 'fulfilled' && c.value.status === 'belum') assert.deepEqual([j.status, ada], ['rejected', 0])
  else assert.deepEqual([j.status, ada], ['fulfilled', 1])

  // Admin cabang lain tidak bisa mengecek kunci cabang ini.
  const adminLain = { ...adminA, uid: adminA.uid + 1000, branchId: C }
  await assert.rejects(m.trx.cekKunciJual(adminLain, isi), /cabang sendiri/)
  await invarianBersih()
})

test('K1: aturan sidik isi yang sama berlaku untuk barang masuk', async () => {
  const k = kunci()
  const isi = masukInput([{ sumber: 'ban', id: banA, jumlah: 2 }], { kunci: k })
  const h = await m.masuk.catatBarangMasuk(owner, isi)
  const ulang = await m.masuk.catatBarangMasuk(owner, isi)
  assert.deepEqual([ulang.id, ulang.ulang], [h.id, true])
  const stokSesudah = await stok('ban', banA)
  await assert.rejects(m.masuk.catatBarangMasuk(owner, masukInput([{ sumber: 'ban', id: banA, jumlah: 5 }], { kunci: k })), (e: unknown) => {
    assert.ok(e instanceof m.logika.GalatKunciDipakai)
    assert.deepEqual(e.ref, { id: h.id, nomor: h.nomor })
    return true
  })
  assert.equal(await stok('ban', banA), stokSesudah)
  assert.equal(await m.db.barangMasuk.count({ where: { idempotencyKey: k } }), 1)
})

test('K3: total yang dilihat kasir berbeda dari hitungan server ditolak tanpa mengubah stok', async () => {
  const stokAwal = await stok('ban', banA)
  const transaksiAwal = await m.db.transaksi.count()
  const nomorAwal = await m.db.penghitungNota.aggregate({ _sum: { nomor: true } })
  // Owner menaikkan harga batch sesudah kasir membuka dialog dengan total 100.000.
  const b = await m.db.batchStok.findFirstOrThrow({ where: { sumber: 'ban', barisId: banA, sisa: { gt: 0 } }, orderBy: [{ tanggalMasuk: 'asc' }, { id: 'asc' }] })
  await m.stok.ubahHargaBatch({ batchId: b.id, harga: 105_000, pengguna: String(owner.uid) })
  const isi = jualInput([{ sumber: 'ban', id: banA, jumlah: 1 }], { metode: 'tunai', dibayar: 100_000, totalDilihat: 100_000 })
  await assert.rejects(m.trx.jual(adminA, isi), (e: unknown) => {
    assert.ok(e instanceof m.trx.GalatTotalBerubah)
    assert.deepEqual([e.totalLama, e.totalBaru], [100_000, 105_000])
    assert.match(e.message, /Rp 100\.000 menjadi Rp 105\.000/)
    return true
  })
  assert.equal(await stok('ban', banA), stokAwal)
  assert.equal(await m.db.transaksi.count(), transaksiAwal)
  assert.deepEqual(await m.db.penghitungNota.aggregate({ _sum: { nomor: true } }), nomorAwal)
  // Diskon ikut dihitung: total yang dilihat = subtotal - diskon.
  await assert.rejects(m.trx.jual(owner, jualInput([{ sumber: 'ban', id: banA, jumlah: 1 }], { diskon: 5_000, alasanDiskon: 'uji', totalDilihat: 105_000 })), /menjadi Rp 100\.000/)
  // Sesudah kasir mengonfirmasi total baru, transaksi tersimpan.
  const h = await m.trx.jual(adminA, { ...isi, kunci: kunci(), dibayar: 105_000, totalDilihat: 105_000 })
  assert.equal((await m.db.transaksi.findUniqueOrThrow({ where: { id: h.id } })).total, 105_000)
  await m.stok.ubahHargaBatch({ batchId: b.id, harga: 100_000, pengguna: String(owner.uid) })
})

test('K3: batch terdepan habis oleh kasir lain, total berikutnya memakai batch kedua dan ditolak', async () => {
  // Dua kasir sama-sama melihat 1 x 100.000. Kasir pertama menghabiskan batch terdepan.
  const lihat = jualInput([{ sumber: 'ban', id: banFifo, jumlah: 1 }], { totalDilihat: 100_000 })
  await m.trx.jual(adminA, lihat)
  await assert.rejects(m.trx.jual(adminA2, { ...lihat, kunci: kunci() }), /menjadi Rp 120\.000/)
  assert.deepEqual(await sisaBatch('ban', banFifo), [0, 1])
  await invarianBersih()
})

test('K11: uang diterima di atas batas kolom ditolak dengan pesan yang menyebut sebabnya', () => {
  const dasar = { cabangId: A, channel: 'toko', metode: 'tunai', diskon: 0, alasanDiskon: '', kunci: kunci(), totalDilihat: 100_000, baris: [{ sumber: 'ban', id: banA, jumlah: 1 }] }
  assert.throws(() => m.trx.bacaInputJual({ ...dasar, dibayar: '10000000000' }), /batas kolom penyimpanan/)
  assert.throws(() => m.trx.bacaInputJual({ ...dasar, dibayar: m.logika.MAKS_UANG + 1 }), /batas kolom penyimpanan/)
  assert.equal(m.trx.bacaInputJual({ ...dasar, dibayar: m.logika.MAKS_UANG }).dibayar, m.logika.MAKS_UANG)
  assert.throws(() => m.trx.bacaInputJual({ ...dasar, dibayar: 100_000, totalDilihat: undefined }), /Total di layar/)
})

test('K4: pembaca isian angka owner menolak minus, pecahan, dan teks campuran', () => {
  const baca = m.logika.bacaAngkaIsian
  assert.equal(baca('', 'Stok baru', 100_000), null)
  assert.equal(baca('12', 'Stok baru', 100_000), 12)
  assert.equal(baca('1.250.000', 'Harga', m.logika.MAKS_HARGA), 1_250_000)
  assert.equal(baca('Rp 1.250.000', 'Harga', m.logika.MAKS_HARGA), 1_250_000)
  assert.equal(baca(' 750000 ', 'Harga', m.logika.MAKS_HARGA), 750_000)
  assert.throws(() => baca('-3', 'Stok baru', 100_000), /Stok baru tidak boleh minus/)
  assert.throws(() => baca('Rp -5.000', 'Harga', m.logika.MAKS_HARGA), /minus/)
  for (const x of ['1.250.000,50', '12,5', '12.5', 'abc', '12abc', '1 2', '1.25.000'])
    assert.throws(() => baca(x, 'Harga', m.logika.MAKS_HARGA), /angka bulat tanpa koma/, x)
  assert.throws(() => baca('1.000.000.001', 'Harga', m.logika.MAKS_HARGA), /paling besar 1\.000\.000\.000/)
  assert.throws(() => baca('100001', 'Stok baru', 100_000), /paling besar 100\.000/)
})

test('harga batch 0 ditolak di ubah harga batch dan koreksi, dan koreksi punya batas atas harga', async () => {
  const b = await m.db.batchStok.findFirstOrThrow({ where: { sumber: 'ban', barisId: banA, sisa: { gt: 0 } } })
  await assert.rejects(m.stok.ubahHargaBatch({ batchId: b.id, harga: 0, pengguna: null }), /harga jual sebenarnya/)
  const s = await stok('ban', banA)
  await assert.rejects(m.stok.koreksiStok({ sumber: 'ban', barisId: banA, setKe: s + 1, alasan: 'uji', harga: 0, pengguna: null }), /harga jual sebenarnya/)
  await assert.rejects(m.stok.koreksiStok({ sumber: 'ban', barisId: banA, setKe: s + 1, alasan: 'uji', harga: 1_000_000_001, pengguna: null }), /paling besar/)
  // Barang tanpa harga: harga bawaan koreksi adalah 0, jadi harus diisi.
  const n = await stok('ban', banNol)
  await assert.rejects(m.stok.koreksiStok({ sumber: 'ban', barisId: banNol, setKe: n + 1, alasan: 'uji', pengguna: null }), /harga jual sebenarnya/)
  assert.equal(await stok('ban', banA), s)
  assert.equal(await stok('ban', banNol), n)
})

test('opname: admin cabang hanya menghapus draft buatannya sendiri, owner boleh menghapus draft siapa pun', async () => {
  const dariOwner = await m.opname.mulaiOpname(owner, { cabangId: A })
  await assert.rejects(m.opname.hapusOpname(adminA, dariOwner.id), /dibuat orang lain/)
  await m.opname.hapusOpname(owner, dariOwner.id)
  const dariAdmin = await m.opname.mulaiOpname(adminA, { cabangId: A })
  await assert.rejects(m.opname.hapusOpname(adminA2, dariAdmin.id), /dibuat orang lain/)
  await m.opname.hapusOpname(owner, dariAdmin.id)
  assert.equal(await m.db.stokOpname.count(), 0)
})

test('K6: produk dan listing yang punya batch atau nota tidak bisa dihapus, yang belum dipakai kasir tetap bisa', async () => {
  // Stok oli-aktif dinolkan dulu supaya penolakan bukan karena stok.
  await m.stok.koreksiStok({ sumber: 'produk', barisId: lAktif, setKe: 0, alasan: 'uji hapus', pengguna: String(owner.uid) })
  await assert.rejects(m.ubah.hapusProduk({ productId: pAktif }), (e: unknown) => {
    assert.ok(e instanceof m.ubah.GalatDipakaiKasir)
    assert.match(e.message, /sudah dipakai kasir.*Nonaktifkan/)
    return true
  })
  await assert.rejects(m.ubah.hapusListing({ productId: pAktif, branchId: A }), /sudah dipakai kasir/)
  // oli-nanti punya nota (terjual lalu di-void). Batch-nya dihapus langsung dari data uji: nota saja sudah cukup untuk menolak.
  assert.ok(await m.db.detailTransaksi.count({ where: { sumber: 'produk', barisId: lNanti } }))
  await m.db.batchStok.deleteMany({ where: { sumber: 'produk', barisId: lNanti } })
  await assert.rejects(m.ubah.hapusProduk({ productId: pNanti }), /sudah dipakai kasir/)
  assert.equal(await m.db.product.count({ where: { id: { in: [pAktif, pNanti] } } }), 2)
  assert.equal(await m.db.listing.count({ where: { id: lAktif } }), 1)
  // Produk di cabang mode sheet tanpa batch dan nota tetap bisa dihapus seperti biasa.
  assert.equal(await m.ubah.hapusProduk({ productId: pSheet }), true)
})
