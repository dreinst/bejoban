// Logika murni kasir: FIFO, pemecahan per batch, pembagian diskon, nomor transaksi, syarat void, invarian.
// Tidak menyentuh database supaya bisa dites terpisah (tests/kasir-logika.test.ts). Aturan lengkap: docs/KASIR.md.

export class GalatKasir extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GalatKasir'
  }
}

export const CHANNEL = ['toko', 'whatsapp'] as const
export type Channel = (typeof CHANNEL)[number]
export const CHANNEL_LABEL: Record<Channel, string> = { toko: 'Toko', whatsapp: 'WhatsApp' }

export const METODE_BAYAR = ['tunai', 'qris', 'debit'] as const
export type MetodeBayar = (typeof METODE_BAYAR)[number]
export const METODE_LABEL: Record<MetodeBayar, string> = { tunai: 'Tunai', qris: 'QRIS', debit: 'Debit' }

export const SUMBER = ['ban', 'produk', 'jasa'] as const
export type Sumber = (typeof SUMBER)[number]
export const SUMBER_LABEL: Record<Sumber, string> = { ban: 'Ban', produk: 'Produk', jasa: 'Jasa' }

export const isChannel = (v: unknown): v is Channel => typeof v === 'string' && (CHANNEL as readonly string[]).includes(v)
export const isMetode = (v: unknown): v is MetodeBayar => typeof v === 'string' && (METODE_BAYAR as readonly string[]).includes(v)
export const isSumber = (v: unknown): v is Sumber => typeof v === 'string' && (SUMBER as readonly string[]).includes(v)

/* ---------- FIFO ---------- */

export type Batch = { id: number; sisa: number; hargaJual: number; tanggalMasuk: Date }
export type Potongan = { batchId: number; jumlah: number; harga: number }

// Urutan FIFO: tanggal masuk paling lama dulu, lalu id terkecil.
export const urutFifo = <T extends Pick<Batch, 'id' | 'tanggalMasuk'>>(batches: T[]) =>
  batches.toSorted((a, b) => a.tanggalMasuk.getTime() - b.tanggalMasuk.getTime() || a.id - b.id)

// Ambil `jumlah` unit dari batch tertua yang masih bersisa. Kalau batch tertua kurang, hasilnya beberapa potongan.
// Melempar GalatKasir kalau total sisa tidak cukup.
export function pecahFifo(batches: Batch[], jumlah: number): Potongan[] {
  if (!Number.isInteger(jumlah) || jumlah < 1) throw new GalatKasir('Jumlah harus bilangan bulat 1 atau lebih')
  const ada = batches.reduce((n, b) => n + Math.max(0, b.sisa), 0)
  if (jumlah > ada) throw new GalatKasir(`Stok tidak cukup: tersedia ${ada}, diminta ${jumlah}`)
  const hasil: Potongan[] = []
  let kurang = jumlah
  for (const b of urutFifo(batches)) {
    if (kurang === 0) break
    if (b.sisa <= 0) continue
    const ambil = Math.min(b.sisa, kurang)
    hasil.push({ batchId: b.id, jumlah: ambil, harga: b.hargaJual })
    kurang -= ambil
  }
  return hasil
}

// Harga batch terdepan (yang terjual berikutnya), atau null kalau tidak ada batch bersisa.
export function hargaTerdepan(batches: Batch[]): number | null {
  const b = urutFifo(batches).find((x) => x.sisa > 0)
  return b ? b.hargaJual : null
}

/* ---------- Diskon nota ---------- */

// Bagi potongan nota ke baris secara proporsional terhadap nilai baris, dibulatkan ke bawah.
// Sisa pembulatan masuk ke baris bernilai terbesar (yang pertama kalau ada yang sama besar).
export function bagiDiskon(nilai: number[], diskon: number): number[] {
  if (!Number.isInteger(diskon) || diskon < 0) throw new GalatKasir('Diskon harus rupiah bulat, 0 atau lebih')
  const total = nilai.reduce((a, b) => a + b, 0)
  if (diskon > total) throw new GalatKasir('Diskon tidak boleh melebihi subtotal')
  if (diskon === 0 || total === 0) return nilai.map(() => 0)
  const bagian = nilai.map((v) => Math.floor((diskon * v) / total))
  const sisa = diskon - bagian.reduce((a, b) => a + b, 0)
  let besar = 0
  for (let i = 1; i < nilai.length; i++) if (nilai[i] > nilai[besar]) besar = i
  bagian[besar] += sisa
  return bagian
}

/* ---------- Hitungan nota ---------- */

export type HitungNota = { subtotal: number; diskon: number; total: number; dibayar: number | null; kembalian: number | null }

// Subtotal dari baris (jumlah x harga), total sesudah diskon, dan kembalian untuk tunai.
// Harga sudah termasuk pajak, jadi tidak ada hitungan pajak.
export function hitungNota(baris: { jumlah: number; harga: number }[], diskon: number, metode: MetodeBayar, dibayar: number | null): HitungNota {
  if (!baris.length) throw new GalatKasir('Keranjang masih kosong')
  const subtotal = baris.reduce((n, b) => n + b.jumlah * b.harga, 0)
  if (!Number.isInteger(diskon) || diskon < 0) throw new GalatKasir('Diskon harus rupiah bulat, 0 atau lebih')
  if (diskon > subtotal) throw new GalatKasir('Diskon tidak boleh melebihi subtotal')
  const total = subtotal - diskon
  if (metode !== 'tunai') return { subtotal, diskon, total, dibayar: null, kembalian: null }
  if (dibayar === null || !Number.isInteger(dibayar)) throw new GalatKasir('Isi uang diterima untuk pembayaran tunai')
  if (dibayar < total) throw new GalatKasir(`Uang diterima kurang dari total (kurang ${(total - dibayar).toLocaleString('id-ID')})`)
  return { subtotal, diskon, total, dibayar, kembalian: dibayar - total }
}

/* ---------- Waktu WIB dan nomor transaksi ---------- */

const WIB = 7 * 3600_000
const dua = (n: number) => String(n).padStart(2, '0')

// Tanggal WIB berbentuk YYMMDD, mis. 261120.
export function tanggalWib(d: Date): string {
  const w = new Date(d.getTime() + WIB)
  return `${dua(w.getUTCFullYear() % 100)}${dua(w.getUTCMonth() + 1)}${dua(w.getUTCDate())}`
}

// Tanggal WIB berbentuk YYYY-MM-DD, untuk isian tanggal di saringan.
export function isoWib(d: Date): string {
  const w = new Date(d.getTime() + WIB)
  return `${w.getUTCFullYear()}-${dua(w.getUTCMonth() + 1)}-${dua(w.getUTCDate())}`
}

// Awal hari WIB (pukul 00.00 WIB) yang memuat waktu d, sebagai Date UTC.
export function awalHariWib(d: Date): Date {
  const w = new Date(d.getTime() + WIB)
  return new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()) - WIB)
}

// Rentang [mulai, akhir) dari teks YYYY-MM-DD (WIB). null kalau formatnya salah.
export function rentangHariWib(dari: string, sampai: string): { mulai: Date; akhir: Date } | null {
  const baca = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
    if (!m) return null
    const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - WIB
    return Number.isNaN(t) ? null : t
  }
  const a = baca(dari)
  const b = baca(sampai)
  if (a === null || b === null || b < a) return null
  return { mulai: new Date(a), akhir: new Date(b + 24 * 3600_000) }
}

export const KODE_NOTA = /^[A-Z]{2,5}$/

// Nomor transaksi KODE-YYMMDD-NNNN, urut per cabang per hari WIB, mis. BTU-261120-0001.
export function formatNomor(kode: string, tanggal: string, urut: number): string {
  if (!KODE_NOTA.test(kode)) throw new GalatKasir('Kode nota cabang harus 2 sampai 5 huruf besar')
  if (!/^\d{6}$/.test(tanggal)) throw new GalatKasir('Tanggal nomor harus YYMMDD')
  if (!Number.isInteger(urut) || urut < 1) throw new GalatKasir('Nomor urut harus 1 atau lebih')
  return `${kode}-${tanggal}-${String(urut).padStart(4, '0')}`
}

/* ---------- Void ---------- */

export type SyaratVoid = {
  peran: 'OWNER' | 'BRANCH_ADMIN'
  cabangSesi: number | null
  cabangTransaksi: number
  status: string
  waktuTransaksi: Date
  sekarang: Date
  alasan: string
}

// Admin: transaksi cabang sendiri, di hari WIB yang sama. Owner: kapan saja. Alasan wajib, dan void tidak bisa diulang.
export function syaratVoid(p: SyaratVoid): { boleh: true } | { boleh: false; alasan: string } {
  if (p.status === 'void') return { boleh: false, alasan: 'Transaksi ini sudah di-void' }
  if (p.status !== 'selesai') return { boleh: false, alasan: 'Status transaksi tidak dikenal' }
  if (p.peran !== 'OWNER') {
    if (p.cabangSesi !== p.cabangTransaksi) return { boleh: false, alasan: 'Transaksi ini milik cabang lain' }
    if (tanggalWib(p.waktuTransaksi) !== tanggalWib(p.sekarang)) return { boleh: false, alasan: 'Admin hanya bisa void transaksi hari ini. Minta owner untuk transaksi hari sebelumnya.' }
  }
  if (p.alasan.trim().length < 3) return { boleh: false, alasan: 'Tulis alasan void' }
  return { boleh: true }
}

/* ---------- Invarian mode kasir ---------- */

export type BarisInvarian = { label: string; stok: number; harga: number | null }

// Stok baris harus sama dengan jumlah sisa batch, dan harga baris sama dengan harga batch terdepan.
// Harga hanya dibandingkan kalau ada batch bersisa. Hasil: daftar masalah, kosong kalau benar.
export function cekInvarian(baris: BarisInvarian, batches: (Batch & { jumlahAwal: number })[]): string[] {
  const masalah: string[] = []
  const sisa = batches.reduce((n, b) => n + b.sisa, 0)
  if (sisa !== baris.stok) masalah.push(`${baris.label}: stok ${baris.stok}, jumlah sisa batch ${sisa}`)
  for (const b of batches) if (b.sisa < 0 || b.sisa > b.jumlahAwal) masalah.push(`${baris.label}: batch ${b.id} sisa ${b.sisa} dari ${b.jumlahAwal}`)
  const depan = hargaTerdepan(batches)
  if (depan !== null && (baris.harga ?? 0) !== depan) masalah.push(`${baris.label}: harga ${baris.harga ?? 'kosong'}, harga batch terdepan ${depan}`)
  return masalah
}

/* ---------- Peringatan stok ---------- */

// Keputusan peringatan sesudah stok berubah. batas null: tanpa peringatan (yang aktif ditutup).
export function keputusanPeringatan(stok: number, batas: number | null, adaAktif: boolean): 'buat' | 'tutup' | 'tetap' {
  if (batas === null) return adaAktif ? 'tutup' : 'tetap'
  if (stok <= batas) return adaAktif ? 'tetap' : 'buat'
  return adaAktif ? 'tutup' : 'tetap'
}

/* ---------- Bagian 2: barang masuk, opname, analitik ---------- */

export const JENIS_PEMASOK = ['distributor', 'rekanan'] as const
export type JenisPemasok = (typeof JENIS_PEMASOK)[number]
export const JENIS_PEMASOK_LABEL: Record<JenisPemasok, string> = { distributor: 'Distributor', rekanan: 'Toko rekanan' }
export const isJenisPemasok = (v: unknown): v is JenisPemasok => typeof v === 'string' && (JENIS_PEMASOK as readonly string[]).includes(v)

// Nomor penerimaan BM-KODE-YYMMDD-NNN, urut per cabang per hari WIB. Awalan BM membuatnya tidak mungkin sama
// dengan nomor nota (KODE-YYMMDD-NNNN), walau kode nota cabang kebetulan "BM".
export function formatNomorPenerimaan(kode: string, tanggal: string, urut: number): string {
  formatNomor(kode, tanggal, urut) // validasi yang sama dengan nomor nota
  return `BM-${kode}-${tanggal}-${String(urut).padStart(3, '0')}`
}

// Tanggal YYYY-MM-DD (WIB) menjadi pukul 00.00 WIB hari itu. null kalau formatnya salah.
export const tanggalKeWaktu = (iso: string): Date | null => rentangHariWib(iso, iso)?.mulai ?? null

// Lead time dalam hari dari tanggal pesan ke tanggal terima (keduanya pukul 00.00 WIB). null kalau tanggal pesan kosong.
export const leadTimeHari = (pesan: Date | null, terima: Date) => (pesan ? Math.round((terima.getTime() - pesan.getTime()) / (24 * 3600_000)) : null)

// Senin (WIB) dari minggu yang memuat waktu d, berbentuk YYYY-MM-DD. Minggu dihitung Senin sampai Minggu.
export function awalMingguWib(d: Date): string {
  const w = new Date(d.getTime() + WIB)
  const geser = (w.getUTCDay() + 6) % 7
  return isoWib(new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate() - geser) - WIB))
}

// Rentang [mulai, akhir) satu bulan WIB dari teks YYYY-MM. null kalau formatnya salah.
export function rentangBulanWib(bulan: string): { mulai: Date; akhir: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(bulan)
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null
  const y = Number(m[1])
  const b = Number(m[2]) - 1
  return { mulai: new Date(Date.UTC(y, b, 1) - WIB), akhir: new Date(Date.UTC(y, b + 1, 1) - WIB) }
}

// Hasil opname untuk satu baris saat final: selisih diterapkan ke stok sekarang (bukan menimpa angkanya),
// supaya penjualan sesudah baris diisi tidak hilang. Hasil negatif berarti hitungan fisik tidak cocok lagi.
export function hasilOpname(stokSekarang: number, selisih: number): { akhir: number; negatif: boolean } {
  const akhir = stokSekarang + selisih
  return { akhir, negatif: akhir < 0 }
}

/* ---------- CSV ---------- */

// Satu sel CSV. Teks yang diawali =, +, -, @, tab, atau CR diberi awalan ' supaya spreadsheet tidak menjalankannya
// sebagai rumus (CSV injection). Angka ditulis apa adanya. Sel dikutip kalau memuat koma, kutip, atau baris baru.
export function selCsv(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  const t = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

export const keCsv = (kolom: readonly string[], baris: (string | number | null)[][]) =>
  [kolom.map(selCsv).join(','), ...baris.map((r) => r.map(selCsv).join(','))].join('\r\n') + '\r\n'
