// Tes logika murni kasir (src/lib/kasir/logika.ts). Tanpa database.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  awalHariWib,
  bagiDiskon,
  cekInvarian,
  formatNomor,
  GalatKasir,
  hargaTerdepan,
  hitungNota,
  keputusanPeringatan,
  pecahFifo,
  rentangHariWib,
  syaratVoid,
  tanggalWib,
  type Batch,
} from '../src/lib/kasir/logika'

const tgl = (s: string) => new Date(s)

// Contoh ban A dari papan aturan harga BejoStock: B1 masuk 1 Okt 20 pcs Rp100.000, terjual 18, lalu B2 masuk
// 2 Nov 100 pcs Rp120.000. Penjualan 1 pcs memakai B1, lalu penjualan 3 pcs dipecah: 1 dari B1, 2 dari B2.
test('FIFO contoh ban A: batch tertua dulu, baris dipecah lintas batch', () => {
  const b1: Batch = { id: 1, sisa: 20, hargaJual: 100_000, tanggalMasuk: tgl('2026-10-01T03:00:00Z') }
  assert.deepEqual(pecahFifo([b1], 18), [{ batchId: 1, jumlah: 18, harga: 100_000 }])
  b1.sisa = 2
  const b2: Batch = { id: 2, sisa: 100, hargaJual: 120_000, tanggalMasuk: tgl('2026-11-02T03:00:00Z') }
  // Urutan masukan tidak berpengaruh: B2 ditaruh di depan tetap diambil sesudah B1.
  assert.deepEqual(pecahFifo([b2, b1], 1), [{ batchId: 1, jumlah: 1, harga: 100_000 }])
  b1.sisa = 1
  assert.equal(hargaTerdepan([b2, b1]), 100_000)
  const pecah = pecahFifo([b1, b2], 3)
  assert.deepEqual(pecah, [
    { batchId: 1, jumlah: 1, harga: 100_000 },
    { batchId: 2, jumlah: 2, harga: 120_000 },
  ])
  assert.equal(pecah.reduce((n, p) => n + p.jumlah * p.harga, 0), 100_000 + 2 * 120_000)
  // Sesudah B1 habis, harga terdepan menjadi harga B2.
  assert.equal(hargaTerdepan([{ ...b1, sisa: 0 }, { ...b2, sisa: 98 }]), 120_000)
})

test('FIFO: tanggal sama diurutkan menurut id, batch kosong dilewati, stok kurang ditolak', () => {
  const t = tgl('2026-11-20T01:00:00Z')
  const daftar: Batch[] = [
    { id: 9, sisa: 5, hargaJual: 10, tanggalMasuk: t },
    { id: 3, sisa: 0, hargaJual: 11, tanggalMasuk: t },
    { id: 4, sisa: 1, hargaJual: 12, tanggalMasuk: t },
  ]
  assert.deepEqual(pecahFifo(daftar, 2), [
    { batchId: 4, jumlah: 1, harga: 12 },
    { batchId: 9, jumlah: 1, harga: 10 },
  ])
  assert.throws(() => pecahFifo(daftar, 7), /tersedia 6, diminta 7/)
  assert.throws(() => pecahFifo(daftar, 0), GalatKasir)
  assert.throws(() => pecahFifo(daftar, 1.5), GalatKasir)
  assert.equal(hargaTerdepan([]), null)
})

test('pembagian diskon: proporsional, dibulatkan ke bawah, sisa ke baris terbesar', () => {
  assert.deepEqual(bagiDiskon([100_000, 240_000], 34_000), [10_000, 24_000])
  // 10.000 dibagi tiga baris sama besar: 3.333 tiap baris, sisa 1 ke baris pertama yang terbesar.
  assert.deepEqual(bagiDiskon([50_000, 50_000, 50_000], 10_000), [3_334, 3_333, 3_333])
  const b = bagiDiskon([450_000, 35_000, 1_250_000], 77_777)
  assert.equal(b.reduce((x, y) => x + y, 0), 77_777)
  assert.deepEqual(b, [20_172, 1_568, 56_037])
  assert.deepEqual(bagiDiskon([10, 20], 0), [0, 0])
  assert.deepEqual(bagiDiskon([10, 20], 30), [10, 20])
  assert.throws(() => bagiDiskon([10, 20], 31), /melebihi subtotal/)
  assert.throws(() => bagiDiskon([10], -1), GalatKasir)
  assert.throws(() => bagiDiskon([10], 1.5), GalatKasir)
})

test('hitungan nota: subtotal, diskon, total, kembalian tunai', () => {
  const baris = [
    { jumlah: 2, harga: 450_000 },
    { jumlah: 1, harga: 35_000 },
  ]
  assert.deepEqual(hitungNota(baris, 35_000, 'tunai', 1_000_000), { subtotal: 935_000, diskon: 35_000, total: 900_000, dibayar: 1_000_000, kembalian: 100_000 })
  assert.deepEqual(hitungNota(baris, 0, 'qris', null), { subtotal: 935_000, diskon: 0, total: 935_000, dibayar: null, kembalian: null })
  assert.throws(() => hitungNota(baris, 0, 'tunai', 900_000), /kurang 35\.000/)
  assert.throws(() => hitungNota(baris, 0, 'tunai', null), /uang diterima/)
  assert.throws(() => hitungNota([], 0, 'qris', null), /kosong/)
  assert.throws(() => hitungNota(baris, 935_001, 'qris', null), /melebihi/)
})

test('nomor transaksi KODE-YYMMDD-NNNN dengan tanggal WIB', () => {
  assert.equal(formatNomor('BTU', '261120', 1), 'BTU-261120-0001')
  assert.equal(formatNomor('KRL', '261231', 12345), 'KRL-261231-12345')
  // 19 November 16.59 UTC = 23.59 WIB, masih tanggal 19. 17.00 UTC = 00.00 WIB tanggal 20.
  assert.equal(tanggalWib(tgl('2026-11-19T16:59:59Z')), '261119')
  assert.equal(tanggalWib(tgl('2026-11-19T17:00:00Z')), '261120')
  assert.equal(awalHariWib(tgl('2026-11-20T10:00:00Z')).toISOString(), '2026-11-19T17:00:00.000Z')
  assert.throws(() => formatNomor('btu', '261120', 1), GalatKasir)
  assert.throws(() => formatNomor('BTU', '2611', 1), GalatKasir)
  assert.throws(() => formatNomor('BTU', '261120', 0), GalatKasir)
  const r = rentangHariWib('2026-11-20', '2026-11-21')!
  assert.equal(r.mulai.toISOString(), '2026-11-19T17:00:00.000Z')
  assert.equal(r.akhir.toISOString(), '2026-11-21T17:00:00.000Z')
  assert.equal(rentangHariWib('2026-11-21', '2026-11-20'), null)
  assert.equal(rentangHariWib('20-11-2026', '2026-11-20'), null)
})

test('syarat void: admin hari yang sama (WIB) di cabangnya, owner kapan saja, alasan wajib, tidak bisa diulang', () => {
  const dasar = { peran: 'BRANCH_ADMIN' as const, cabangSesi: 1, cabangTransaksi: 1, status: 'selesai', alasan: 'salah input' }
  // Transaksi 23.50 WIB, void 23.59 WIB hari yang sama: boleh.
  assert.deepEqual(syaratVoid({ ...dasar, waktuTransaksi: tgl('2026-11-20T16:50:00Z'), sekarang: tgl('2026-11-20T16:59:00Z') }), { boleh: true })
  // Transaksi 23.50 WIB, void 00.05 WIB besoknya: admin ditolak walau selisihnya 15 menit.
  const lewat = syaratVoid({ ...dasar, waktuTransaksi: tgl('2026-11-20T16:50:00Z'), sekarang: tgl('2026-11-20T17:05:00Z') })
  assert.equal(lewat.boleh, false)
  assert.match((lewat as { alasan: string }).alasan, /hari ini/)
  // Transaksi 00.10 WIB (17.10 UTC hari sebelumnya) dan void 20.00 WIB: tanggal WIB sama, boleh.
  assert.equal(syaratVoid({ ...dasar, waktuTransaksi: tgl('2026-11-19T17:10:00Z'), sekarang: tgl('2026-11-20T13:00:00Z') }).boleh, true)
  assert.equal(syaratVoid({ ...dasar, peran: 'OWNER', cabangSesi: null, waktuTransaksi: tgl('2026-10-01T03:00:00Z'), sekarang: tgl('2026-11-20T03:00:00Z') }).boleh, true)
  assert.equal(syaratVoid({ ...dasar, cabangSesi: 2, waktuTransaksi: tgl('2026-11-20T03:00:00Z'), sekarang: tgl('2026-11-20T04:00:00Z') }).boleh, false)
  assert.equal(syaratVoid({ ...dasar, alasan: '  ', waktuTransaksi: tgl('2026-11-20T03:00:00Z'), sekarang: tgl('2026-11-20T04:00:00Z') }).boleh, false)
  assert.equal(syaratVoid({ ...dasar, peran: 'OWNER', status: 'void', waktuTransaksi: tgl('2026-11-20T03:00:00Z'), sekarang: tgl('2026-11-20T04:00:00Z') }).boleh, false)
})

test('invarian dan keputusan peringatan stok', () => {
  const t = tgl('2026-11-20T01:00:00Z')
  const batch = [
    { id: 1, sisa: 2, hargaJual: 100, tanggalMasuk: t, jumlahAwal: 5 },
    { id: 2, sisa: 3, hargaJual: 120, tanggalMasuk: tgl('2026-11-21T01:00:00Z'), jumlahAwal: 3 },
  ]
  assert.deepEqual(cekInvarian({ label: 'A', stok: 5, harga: 100 }, batch), [])
  assert.equal(cekInvarian({ label: 'A', stok: 4, harga: 100 }, batch).length, 1)
  assert.equal(cekInvarian({ label: 'A', stok: 5, harga: 120 }, batch).length, 1)
  assert.deepEqual(cekInvarian({ label: 'A', stok: 0, harga: null }, []), [])
  assert.equal(keputusanPeringatan(3, 3, false), 'buat')
  assert.equal(keputusanPeringatan(2, 3, true), 'tetap')
  assert.equal(keputusanPeringatan(4, 3, true), 'tutup')
  assert.equal(keputusanPeringatan(4, 3, false), 'tetap')
  assert.equal(keputusanPeringatan(0, null, true), 'tutup')
  assert.equal(keputusanPeringatan(0, null, false), 'tetap')
})
