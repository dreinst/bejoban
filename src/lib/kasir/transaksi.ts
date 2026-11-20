// Transaksi kasir: jual, void, dan keputusan owner atas diskon. Semua cek peran ada di sini (server).
// Aturan: docs/KASIR.md. Urutan kunci sama dengan src/lib/kasir/stok.ts.
import { Prisma } from '@/generated/prisma/client'
import { db } from '../db'
import { catatAktivitas } from '../stok/aktivitas'
import type { HasilUbahStok, Tx } from '../stok/ubah'
import { GalatStok } from '../stok/logika'
import {
  bagiDiskon,
  formatNomor,
  GalatKasir,
  hitungNota,
  isChannel,
  isMetode,
  isSumber,
  syaratVoid,
  tanggalWib,
  type Channel,
  type MetodeBayar,
  type Sumber,
} from './logika'
import { batchTx, kembalikanKeBatchTx, kunciBarisTx, kunciCabangTx, kurangiFifoTx, samakanHargaTx, type SumberStok } from './stok'
import { siarkan, type Siaran } from './siaran'

export type SesiKasir = { uid: number; role: 'OWNER' | 'BRANCH_ADMIN'; branchId: number | null; name: string }

export type BarisMasuk = { sumber: Sumber; id: number; alt?: boolean; jumlah: number }

export type InputJual = {
  cabangId: number
  channel: Channel
  metode: MetodeBayar
  diskon: number
  alasanDiskon: string
  dibayar: number | null
  kunci: string
  baris: BarisMasuk[]
}

export type StokLain = { cabang: string; stok: number }

// Jumlah melebihi stok cabang: pesan plus stok cabang lain untuk barang itu.
export class GalatStokKurang extends GalatKasir {
  constructor(
    message: string,
    public nama: string,
    public stokLain: StokLain[],
  ) {
    super(message)
    this.name = 'GalatStokKurang'
  }
}

const KUNCI_IDEMPOTENCY = 4207002
const MAKS_BARIS = 60

const SUMBER_URUT: Record<Sumber, number> = { ban: 0, produk: 1, jasa: 2 }

// Baca dan rapikan masukan dari klien. Klien hanya mengirim kode barang, jumlah, pilihan bayar, dan kunci.
export function bacaInputJual(raw: unknown): InputJual {
  const o = (raw ?? {}) as Record<string, unknown>
  const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : typeof v === 'string' && /^\d{1,12}$/.test(v) ? Number(v) : NaN)
  const cabangId = int(o.cabangId)
  if (!Number.isInteger(cabangId)) throw new GalatKasir('Cabang tidak valid')
  if (!isChannel(o.channel)) throw new GalatKasir('Pilih channel: toko atau WhatsApp')
  if (!isMetode(o.metode)) throw new GalatKasir('Pilih metode bayar')
  const kunci = typeof o.kunci === 'string' ? o.kunci : ''
  if (!/^[A-Za-z0-9-]{16,64}$/.test(kunci)) throw new GalatKasir('Kunci kiriman tidak valid. Muat ulang halaman.')
  const diskon = o.diskon === undefined || o.diskon === null || o.diskon === '' ? 0 : int(o.diskon)
  if (!Number.isInteger(diskon) || diskon < 0) throw new GalatKasir('Diskon harus rupiah bulat')
  const alasanDiskon = typeof o.alasanDiskon === 'string' ? o.alasanDiskon.trim().slice(0, 200) : ''
  if (diskon > 0 && alasanDiskon.length < 3) throw new GalatKasir('Tulis alasan diskon')
  const dibayar = o.metode === 'tunai' ? int(o.dibayar) : null
  if (!Array.isArray(o.baris) || !o.baris.length) throw new GalatKasir('Keranjang masih kosong')
  if (o.baris.length > MAKS_BARIS) throw new GalatKasir(`Paling banyak ${MAKS_BARIS} baris per nota`)
  // Baris yang sama digabung, supaya FIFO dihitung sekali per barang.
  const gabung = new Map<string, BarisMasuk>()
  for (const b of o.baris as Record<string, unknown>[]) {
    const id = int(b?.id)
    const jumlah = int(b?.jumlah)
    if (!isSumber(b?.sumber) || !Number.isInteger(id)) throw new GalatKasir('Barang di keranjang tidak dikenali')
    if (!Number.isInteger(jumlah) || jumlah < 1 || jumlah > 9999) throw new GalatKasir('Jumlah tiap barang 1 sampai 9999')
    const alt = b.sumber === 'jasa' && b.alt === true
    const k = `${b.sumber}:${id}:${alt ? 1 : 0}`
    const ada = gabung.get(k)
    gabung.set(k, { sumber: b.sumber, id, ...(alt && { alt }), jumlah: (ada?.jumlah ?? 0) + jumlah })
  }
  return { cabangId, channel: o.channel, metode: o.metode, diskon, alasanDiskon: diskon > 0 ? alasanDiskon : '', dibayar: Number.isNaN(dibayar as number) ? null : dibayar, kunci, baris: [...gabung.values()] }
}

// Admin hanya untuk cabangnya sendiri. Owner semua cabang.
export function bolehCabang(s: SesiKasir, cabangId: number) {
  return s.role === 'OWNER' || s.branchId === cabangId
}

async function stokCabangLain(sumber: SumberStok, barisId: number, cabangId: number): Promise<StokLain[]> {
  const cabang = await db.branch.findMany({ where: { NOT: { id: cabangId } }, select: { id: true, name: true }, orderBy: [{ sort: 'asc' }, { id: 'asc' }] })
  if (sumber === 'ban') {
    const r = await db.stockTire.findUnique({ where: { id: barisId }, select: { kode: true } })
    if (!r?.kode) return []
    const lain = await db.stockTire.findMany({ where: { kode: r.kode, aktif: true, NOT: { cabangId } }, select: { cabangId: true, stock: true } })
    return lain.map((x) => ({ cabang: x.cabangId === null ? 'Tanpa cabang' : (cabang.find((c) => c.id === x.cabangId)?.name ?? `Cabang ${x.cabangId}`), stok: x.stock }))
  }
  const l = await db.listing.findUnique({ where: { id: barisId }, select: { productId: true } })
  if (!l) return []
  const lain = await db.listing.findMany({ where: { productId: l.productId, NOT: { branchId: cabangId } }, select: { branchId: true, stock: true } })
  return lain.map((x) => ({ cabang: cabang.find((c) => c.id === x.branchId)?.name ?? `Cabang ${x.branchId}`, stok: x.stock }))
}

// Nomor urut berikutnya untuk cabang dan hari ini (WIB). Satu UPSERT, jadi dua transaksi bersamaan mendapat nomor berbeda.
async function nomorBerikutTx(tx: Tx, cabangId: number, tanggal: string) {
  const [r] = await tx.$queryRaw<{ nomor: number }[]>`
    INSERT INTO "penghitung_nota" ("cabang_id", "tanggal", "nomor") VALUES (${cabangId}, ${tanggal}, 1)
    ON CONFLICT ("cabang_id", "tanggal") DO UPDATE SET "nomor" = "penghitung_nota"."nomor" + 1
    RETURNING "nomor"`
  return r.nomor
}

type DetailRencana = {
  sumber: Sumber
  kodeProduk: string
  barisId: number | null
  nama: string
  jumlah: number
  harga: number
  batchId: number | null
}

export type HasilJual = { id: number; nomor: string; ulang: boolean }

// Simpan penjualan dalam satu transaksi basis data. Kiriman ulang dengan kunci yang sama mengembalikan transaksi lama.
export async function jual(sesi: SesiKasir, input: InputJual): Promise<HasilJual> {
  if (!bolehCabang(sesi, input.cabangId)) throw new GalatKasir('Kamu hanya bisa bertransaksi untuk cabang sendiri')
  const siaran: Siaran[] = []
  let gagalBaris: { sumber: SumberStok; barisId: number; nama: string; pesan: string } | null = null
  try {
    const hasil = await db.$transaction(
      async (tx) => {
        // Kiriman dengan kunci yang sama diantrekan, lalu yang kedua melihat transaksi yang pertama.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KUNCI_IDEMPOTENCY}, hashtext(${input.kunci}))`
        const ada = await tx.transaksi.findUnique({ where: { idempotencyKey: input.kunci }, select: { id: true, nomor: true, cabangId: true } })
        if (ada) {
          if (ada.cabangId !== input.cabangId) throw new GalatKasir('Kunci kiriman sudah dipakai transaksi lain. Muat ulang halaman.')
          return { id: ada.id, nomor: ada.nomor, ulang: true, diskon: 0 }
        }
        const cabang = await kunciCabangTx(tx, input.cabangId)
        if (cabang.mode !== 'kasir' || !cabang.kodeNota) throw new GalatKasir('Kasir belum aktif di cabang ini')

        // Urutan baris tetap (ban, produk, jasa, lalu id) supaya kunci baris selalu diambil dengan urutan yang sama.
        const urut = input.baris.toSorted((a, b) => SUMBER_URUT[a.sumber] - SUMBER_URUT[b.sumber] || a.id - b.id || Number(!!a.alt) - Number(!!b.alt))
        const rencana: DetailRencana[] = []
        const terkunci = new Map<string, Awaited<ReturnType<typeof kunciBarisTx>>>()
        for (const b of urut) {
          if (b.sumber === 'jasa') {
            const j = await tx.servicePrice.findUnique({ where: { id: b.id } })
            if (!j) throw new GalatKasir('Jasa tidak ditemukan')
            const harga = b.alt ? j.altPrice : j.price
            const nama = [j.name, j.variant, b.alt ? j.altLabel : ''].filter(Boolean).join(' ')
            if (b.alt && !j.altLabel) throw new GalatKasir(`${j.name}: pilihan kedua tidak ada`)
            if (!harga || harga <= 0) throw new GalatKasir(`${nama}: harganya belum diatur`)
            rencana.push({ sumber: 'jasa', kodeProduk: `jasa:${j.id}${b.alt ? ':alt' : ''}`, barisId: null, nama, jumlah: b.jumlah, harga, batchId: null })
            continue
          }
          const baris = await kunciBarisTx(tx, b.sumber, b.id)
          if (baris.cabangId !== input.cabangId || (b.sumber === 'ban' && !baris.aktif)) throw new GalatKasir(`${baris.nama} bukan stok cabang ini`)
          const batch = await batchTx(tx, b.sumber, b.id)
          const ada = batch.reduce((n, x) => n + x.sisa, 0)
          if (b.jumlah > ada) {
            gagalBaris = { sumber: b.sumber, barisId: b.id, nama: baris.nama, pesan: `${baris.nama}: stok cabang ini ${ada}, diminta ${b.jumlah}` }
            throw new GalatKasir(gagalBaris.pesan)
          }
          terkunci.set(`${b.sumber}:${b.id}`, baris)
          // Rencana per batch dihitung lagi oleh kurangiFifoTx dengan batch yang sama (sudah dikunci).
          let kurang = b.jumlah
          for (const x of batch) {
            if (!kurang) break
            const ambil = Math.min(x.sisa, kurang)
            if (x.hargaJual <= 0) throw new GalatKasir(`${baris.nama}: harga belum diatur. Minta owner mengatur harga batch-nya.`)
            rencana.push({ sumber: b.sumber, kodeProduk: baris.kode, barisId: b.id, nama: baris.nama, jumlah: ambil, harga: x.hargaJual, batchId: x.id })
            kurang -= ambil
          }
        }

        const nota = hitungNota(rencana.map((r) => ({ jumlah: r.jumlah, harga: r.harga })), input.diskon, input.metode, input.dibayar)
        const potongan = bagiDiskon(rencana.map((r) => r.jumlah * r.harga), nota.diskon)
        const sekarang = new Date()
        const nomor = formatNomor(cabang.kodeNota, tanggalWib(sekarang), await nomorBerikutTx(tx, input.cabangId, tanggalWib(sekarang)))
        const trx = await tx.transaksi.create({
          data: {
            nomor,
            cabangId: input.cabangId,
            penggunaId: sesi.uid,
            namaKasir: sesi.name.slice(0, 60),
            channel: input.channel,
            metodeBayar: input.metode,
            subtotal: nota.subtotal,
            diskon: nota.diskon,
            alasanDiskon: input.alasanDiskon,
            total: nota.total,
            dibayar: nota.dibayar,
            kembalian: nota.kembalian,
            idempotencyKey: input.kunci,
            waktuTransaksi: sekarang,
            detail: {
              create: rencana.map((r, i) => ({
                sumber: r.sumber,
                kodeProduk: r.kodeProduk,
                barisId: r.barisId,
                nama: r.nama.slice(0, 200),
                jumlah: r.jumlah,
                hargaSatuan: r.harga,
                hargaAsli: r.harga,
                diskon: potongan[i],
                subtotal: r.jumlah * r.harga,
                batchId: r.batchId,
              })),
            },
          },
          select: { id: true, nomor: true },
        })

        // Potong stok per barang menurut FIFO, satu baris buku_stok per batch.
        const refId = `transaksi:${trx.id}`
        const hasilStok: HasilUbahStok[] = []
        for (const b of urut) {
          if (b.sumber === 'jasa') continue
          const baris = terkunci.get(`${b.sumber}:${b.id}`)!
          const { potongan: pakai, hasil } = await kurangiFifoTx(tx, baris, b.jumlah, { tipe: 'jual', refId, pengguna: String(sesi.uid) })
          const rencanaBaris = rencana.filter((r) => r.sumber === b.sumber && r.barisId === b.id)
          if (pakai.length !== rencanaBaris.length || pakai.some((p, i) => p.batchId !== rencanaBaris[i].batchId || p.jumlah !== rencanaBaris[i].jumlah))
            throw new GalatKasir('Urutan batch berubah saat diproses. Coba lagi.')
          hasilStok.push(...hasil)
          await samakanHargaTx(tx, b.sumber, b.id)
        }

        if (nota.diskon > 0 && sesi.role !== 'OWNER')
          await tx.pengajuanHarga.create({
            data: { tipe: 'diskon', cabangId: input.cabangId, pengajuId: sesi.uid, hargaLama: nota.subtotal, hargaBaru: nota.total, alasan: input.alasanDiskon, transaksiId: trx.id },
          })

        siaran.push({ jenis: 'stok', cabangId: input.cabangId }, { jenis: 'transaksi', cabangId: input.cabangId })
        if (hasilStok.some((h) => h.peringatan === 'buat')) siaran.push({ jenis: 'peringatan', cabangId: input.cabangId, pesan: `Stok menipis di ${cabang.name}` })
        if (nota.diskon > 0 && sesi.role !== 'OWNER') siaran.push({ jenis: 'pengajuan', cabangId: input.cabangId, hanyaOwner: true, pesan: `Diskon baru di ${nomor} menunggu tinjauan` })
        return { id: trx.id, nomor: trx.nomor, ulang: false, diskon: nota.diskon }
      },
      { timeout: 20_000, maxWait: 10_000 },
    )
    if (!hasil.ulang) {
      siarkan(...siaran)
      if (hasil.diskon > 0 && sesi.role === 'OWNER')
        await catatAktivitas({ pengguna: String(sesi.uid), aksi: 'diskon_owner', entitas: 'transaksi', data: { id: hasil.id, nomor: hasil.nomor, diskon: hasil.diskon } })
    }
    return { id: hasil.id, nomor: hasil.nomor, ulang: hasil.ulang }
  } catch (e) {
    const g = gagalBaris as { sumber: SumberStok; barisId: number; nama: string; pesan: string } | null
    if (g) throw new GalatStokKurang(g.pesan, g.nama, await stokCabangLain(g.sumber, g.barisId, input.cabangId))
    // Cadangan: kunci yang sama lolos dari kunci antrean (mestinya tidak terjadi) dan bentrok di indeks unik.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const ada = await db.transaksi.findUnique({ where: { idempotencyKey: input.kunci }, select: { id: true, nomor: true } })
      if (ada) return { ...ada, ulang: true }
    }
    if (e instanceof GalatStok) throw new GalatKasir(e.message)
    throw e
  }
}

// Void: kembalikan tiap baris ke batch asalnya, stok naik, buku_stok tipe void. Pengajuan diskon yang menunggu ditutup.
export async function voidTransaksi(sesi: SesiKasir, p: { transaksiId: number; alasan: string }) {
  const alasan = p.alasan.trim().slice(0, 200)
  const siaran: Siaran[] = []
  const hasil = await db.$transaction(
    async (tx) => {
      const [t] = await tx.$queryRaw<{ id: number; nomor: string; cabangId: number; status: string; waktu: Date }[]>`
        SELECT "id", "nomor", "cabang_id" AS "cabangId", "status", "waktu_transaksi" AS "waktu" FROM "transaksi" WHERE "id" = ${p.transaksiId} FOR UPDATE`
      if (!t) throw new GalatKasir('Transaksi tidak ditemukan')
      const s = syaratVoid({ peran: sesi.role, cabangSesi: sesi.branchId, cabangTransaksi: t.cabangId, status: t.status, waktuTransaksi: t.waktu, sekarang: new Date(), alasan })
      if (!s.boleh) throw new GalatKasir(s.alasan)
      await kunciCabangTx(tx, t.cabangId)
      const detail = await tx.detailTransaksi.findMany({ where: { transaksiId: t.id }, orderBy: { id: 'asc' } })
      const urut = detail
        .filter((d) => d.sumber !== 'jasa' && d.batchId !== null && d.barisId !== null)
        .toSorted((a, b) => SUMBER_URUT[a.sumber as Sumber] - SUMBER_URUT[b.sumber as Sumber] || a.barisId! - b.barisId! || a.id - b.id)
      const refId = `void:${t.id}`
      const disentuh = new Set<string>()
      let peringatan = false
      for (const d of urut) {
        const baris = await kunciBarisTx(tx, d.sumber as SumberStok, d.barisId!)
        const h = await kembalikanKeBatchTx(tx, baris, d.batchId!, d.jumlah, { tipe: 'void', refId, pengguna: String(sesi.uid) })
        if (h.peringatan !== 'tetap') peringatan = true
        disentuh.add(`${d.sumber}:${d.barisId}`)
      }
      for (const k of disentuh) {
        const [sumber, id] = k.split(':')
        await samakanHargaTx(tx, sumber as SumberStok, Number(id))
      }
      await tx.transaksi.update({ where: { id: t.id }, data: { status: 'void', alasanVoid: alasan, divoidOleh: sesi.uid, waktuVoid: new Date() } })
      const batal = await tx.pengajuanHarga.updateMany({ where: { transaksiId: t.id, status: 'menunggu' }, data: { status: 'batal', diputuskan: new Date() } })
      siaran.push({ jenis: 'stok', cabangId: t.cabangId }, { jenis: 'transaksi', cabangId: t.cabangId })
      if (peringatan) siaran.push({ jenis: 'peringatan', cabangId: t.cabangId })
      if (batal.count) siaran.push({ jenis: 'pengajuan', cabangId: t.cabangId, hanyaOwner: true })
      return { id: t.id, nomor: t.nomor, cabangId: t.cabangId }
    },
    { timeout: 20_000, maxWait: 10_000 },
  ).catch((e) => {
    if (e instanceof GalatStok) throw new GalatKasir(e.message)
    throw e
  })
  siarkan(...siaran)
  await catatAktivitas({ pengguna: String(sesi.uid), aksi: 'void', entitas: 'transaksi', data: { id: hasil.id, nomor: hasil.nomor, alasan } })
  return hasil
}

// Owner menandai pengajuan diskon disetujui atau ditolak. Transaksinya tidak berubah.
export async function putuskanPengajuan(sesi: SesiKasir, p: { id: number; keputusan: 'disetujui' | 'ditolak' }) {
  if (sesi.role !== 'OWNER') throw new GalatKasir('Hanya owner yang meninjau diskon')
  const awal = await db.pengajuanHarga.findUnique({ where: { id: p.id }, select: { pengajuId: true, cabangId: true, transaksiId: true } })
  if (!awal) throw new GalatKasir('Pengajuan tidak ditemukan')
  const n = await db.pengajuanHarga.updateMany({ where: { id: p.id, status: 'menunggu' }, data: { status: p.keputusan, penyetujuId: sesi.uid, diputuskan: new Date() } })
  if (!n.count) throw new GalatKasir('Pengajuan ini sudah diputuskan atau dibatalkan')
  const t = awal.transaksiId ? await db.transaksi.findUnique({ where: { id: awal.transaksiId }, select: { nomor: true } }) : null
  siarkan(
    { jenis: 'keputusan', cabangId: awal.cabangId, untukPengguna: awal.pengajuId, pesan: `Diskon ${t?.nomor ?? ''} ${p.keputusan} owner`.replace('  ', ' ') },
    { jenis: 'pengajuan', cabangId: awal.cabangId, hanyaOwner: true },
  )
  await catatAktivitas({ pengguna: String(sesi.uid), aksi: `diskon_${p.keputusan}`, entitas: 'pengajuan_harga', data: { id: p.id, transaksi: t?.nomor } })
  return { nomor: t?.nomor ?? '' }
}
