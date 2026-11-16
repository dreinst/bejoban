'use server'
// Aksi untuk halaman internal: stok ban, ongkir, harga jasa, situs, chatbot. Semua cek sesi di server.
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireOwner, requireUser } from '@/lib/auth'
import { parsePricelist, type ParseResult } from '@/lib/tire/pricelist'
import { namaPendek, pisahPerCabang } from '@/lib/tire/cabang'
import { tetapkanTanpaCabang } from '@/lib/stok/tetapkan'
import { CARRIERS, type Carrier, type ShippingSettings } from '@/lib/ongkir/types'
import { mergeSettings } from '@/lib/ongkir/calc'
import { loadShippingSettings } from '@/lib/ongkir/db-source'
import { mergeBot, normalizeNumber, type BotSettings } from '@/lib/bot/policy'
import { loadBotSettings, loadSosmed, loadTemplates, runBot } from '@/lib/bot/respond'
import { CHANNELS, TEMPLATE_KEYS, type Sosmed, type Templates } from '@/lib/bot/templates'
import { applyImport, gabungRingkasan, simpanRingkasan, type ImportSource, type RingkasanImpor } from '@/lib/tire/import'
import { fetchSheetCsv, sheetCsvUrl } from '@/lib/tire/sheet'
import { mergeSitus } from '@/lib/situs'
import { nextStatus, type Status } from '@/lib/bot/conversation'
import { catatAktivitas, penggunaDari } from '@/lib/stok/aktivitas'
import { ubahStokTx } from '@/lib/stok/ubah'
import { GalatStok } from '@/lib/stok/logika'

const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? '').trim().slice(0, max)
const int = (fd: FormData, k: string) => Math.max(0, Math.round(Number(String(fd.get(k) ?? '0').replace(/\D/g, '')) || 0))
const dec = (fd: FormData, k: string) => {
  const n = Number(str(fd, k, 20).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : NaN
}
const go = (path: string, msg: string, kind: 'ok' | 'err' = 'ok'): never => {
  revalidatePath('/admin', 'layout')
  redirect(`${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`)
}
// Satu baris log_aktivitas per aksi admin yang mengubah data.
const catat = (s: { uid: number }, aksi: string, entitas: string, data: Record<string, unknown> = {}) =>
  catatAktivitas({ pengguna: penggunaDari(s), aksi, entitas, data })
const saveSetting = (key: string, value: unknown) =>
  db.setting.upsert({ where: { key }, create: { key, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } })

/* ---------- Stok ban ---------- */

const MAX_CSV = 2_000_000
const STOK_PAGE = '/admin/stok-ban'
// Nilai pilihan "sheet gabungan" di form: baris dibagi menurut kolom Cabang di sumber.
const GABUNGAN = '__gabungan'

type Tujuan = { jenis: 'tanpa' } | { jenis: 'cabang'; id: number; slug: string; name: string } | { jenis: 'gabungan' }

// Tujuan impor dari form: kosong = tanpa cabang (perilaku lama), slug cabang, atau sheet gabungan.
async function tujuanImpor(fd: FormData): Promise<Tujuan> {
  const v = str(fd, 'cabang', 40)
  if (!v) return { jenis: 'tanpa' }
  if (v === GABUNGAN) return { jenis: 'gabungan' }
  const b = await db.branch.findUnique({ where: { slug: v }, select: { id: true, slug: true, name: true } })
  if (!b) return go(STOK_PAGE, 'Cabang tidak ditemukan', 'err')
  return { jenis: 'cabang', ...b }
}

const labelTujuan = (t: Tujuan) => (t.jenis === 'cabang' ? `cabang ${namaPendek(t.name)}` : t.jenis === 'gabungan' ? 'sheet gabungan' : 'tanpa cabang')

// Jalankan impor sesuai tujuan dan kembalikan pesan hasil. Sheet gabungan diimpor per cabang, satu transaksi per cabang.
async function jalankanImpor(r: ParseResult, source: ImportSource, tujuan: Tujuan, s: { uid: number }): Promise<string> {
  const pengguna = penggunaDari(s)
  const aksi = source === 'sheet' ? 'sinkron' : 'impor'
  if (tujuan.jenis === 'gabungan') {
    if (!r.adaKolomCabang) go(STOK_PAGE, 'Sumber ini tidak punya kolom "Cabang" di baris judul. Pilih cabangnya, atau tambahkan kolom Cabang.', 'err')
    const branches = await db.branch.findMany({ select: { id: true, slug: true, name: true } })
    const { bagian, masalah } = pisahPerCabang(r, branches)
    if (!bagian.length) go(STOK_PAGE, `Tidak ada baris dengan cabang yang dikenali (${masalah.length} baris dilewati). Isi kolom Cabang dengan Batu atau Karanglo.`, 'err')
    const list: RingkasanImpor[] = []
    for (const b of bagian) list.push(await applyImport(b.hasil, source, pengguna, b.cabang.id, false))
    const sum = gabungRingkasan(list, source, { ...r, skipped: r.skipped + masalah.length, problems: [...masalah, ...r.problems] })
    await simpanRingkasan(sum)
    await catat(s, aksi, 'stok_ban', { sumber: source, cabang: 'gabungan', bagian: sum.bagian, cabangTakDikenal: masalah.length })
    const rinci = bagian.map((b, i) => `${namaPendek(b.cabang.name)} ${list[i].total}`).join(', ')
    return `${sum.total} baris masuk (${rinci})${masalah.length ? `, ${masalah.length} baris dilewati karena cabangnya kosong atau tidak dikenal` : ''}`
  }
  if (r.adaKolomCabang) go(STOK_PAGE, 'Sumber ini punya kolom "Cabang". Pilih "Sheet gabungan (kolom Cabang)" supaya baris dibagi menurut kolom itu.', 'err')
  const cabangId = tujuan.jenis === 'cabang' ? tujuan.id : null
  const sum = await applyImport(r, source, pengguna, cabangId)
  await catat(s, aksi, 'stok_ban', { sumber: source, cabangId, total: sum.total, dibuat: sum.created, dinonaktifkan: sum.deactivated, diaktifkan: sum.reactivated, stokBerubah: sum.stockChanges })
  return `${sum.total} baris masuk ke ${labelTujuan(tujuan)}`
}

export async function importStock(fd: FormData) {
  const s = await requireOwner()
  const tujuan = await tujuanImpor(fd)
  const file = fd.get('file')
  let text = str(fd, 'paste', MAX_CSV)
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_CSV) go(STOK_PAGE, 'Berkas terlalu besar (maksimal 2 MB)', 'err')
    text = await file.text()
  }
  if (!text.trim()) go(STOK_PAGE, 'Pilih berkas CSV atau tempel isinya dulu', 'err')
  const r = parsePricelist(text)
  if (!r.rows.length) go(STOK_PAGE, 'Tidak ada baris ban yang terbaca. Pastikan ada kolom "Ukuran Ban".', 'err')
  go(STOK_PAGE, await jalankanImpor(r, 'berkas', tujuan, s))
}

// Kunci Setting untuk URL sheet. "stok.sheet" (lama) tetap dipakai untuk baris tanpa cabang.
const kunciSheet = (t: Tujuan) => (t.jenis === 'cabang' ? `stok.sheet.${t.slug}` : t.jenis === 'gabungan' ? 'stok.sheet.gabungan' : 'stok.sheet')

// Sinkron dari Google Sheets: ambil ekspor CSV lalu jalankan impor yang sama. URL disimpan per tujuan.
export async function syncSheet(fd: FormData) {
  const s = await requireOwner()
  const tujuan = await tujuanImpor(fd)
  const url = str(fd, 'url', 500)
  if (!url) go(STOK_PAGE, 'Isi URL spreadsheet dulu', 'err')
  const u = sheetCsvUrl(url, process.env.NODE_ENV !== 'production')
  if (!u.ok) go(STOK_PAGE, u.error, 'err')
  await saveSetting(kunciSheet(tujuan), { url })
  const got = await fetchSheetCsv((u as { csvUrl: string }).csvUrl)
  if (!got.ok) go(STOK_PAGE, got.error, 'err')
  const r = parsePricelist((got as { text: string }).text)
  if (!r.rows.length) go(STOK_PAGE, 'Spreadsheet terbaca tapi tidak ada baris ban. Pastikan ada kolom "Ukuran Ban".', 'err')
  go(STOK_PAGE, `Sinkron selesai, ${await jalankanImpor(r, 'sheet', tujuan, s)}`)
}

// Tetapkan semua baris tanpa cabang ke satu cabang. Wajib centang "Yakin".
export async function tetapkanCabang(fd: FormData) {
  const s = await requireOwner()
  if (fd.get('yakin') !== 'on') go(STOK_PAGE, 'Centang "Yakin" dulu', 'err')
  const b = await db.branch.findUnique({ where: { slug: str(fd, 'cabang', 40) }, select: { id: true, name: true } })
  if (!b) return go(STOK_PAGE, 'Pilih cabang tujuan', 'err')
  const h = await tetapkanTanpaCabang(b.id, penggunaDari(s))
  await catat(s, 'tetapkan_cabang', 'stok_ban', { cabangId: b.id, dipindah: h.dipindah, dilewati: h.dilewati })
  go(STOK_PAGE, `${h.dipindah} baris ditetapkan ke ${namaPendek(b.name)}${h.dilewati ? `, ${h.dilewati} baris dilewati karena sudah ada di cabang itu` : ''}`)
}

// Ubah satu baris stok langsung di tabel. Baris diberi penanda manual.
export async function saveStockRow(fd: FormData) {
  const s = await requireOwner()
  const id = int(fd, 'id')
  const back = String(fd.get('back') ?? '/admin/stok-ban')
  const to = back.startsWith('/admin/stok-ban') ? back : '/admin/stok-ban'
  const priceRaw = str(fd, 'price', 15).replace(/\D/g, '')
  const price = priceRaw ? Number(priceRaw) : null
  const discount = int(fd, 'discount')
  if (price !== null && discount >= price) go(to, 'Potongan harus lebih kecil dari harga', 'err')
  const stock = int(fd, 'stock')
  // Kolom lain dan stok (lewat buku stok, tipe koreksi) disimpan dalam satu transaksi.
  try {
    await db.$transaction(async (tx) => {
      await tx.stockTire.update({
        where: { id },
        data: { price, discount, note: str(fd, 'note', 200), priceIssue: price === null ? undefined : '', manual: true, lockManual: fd.get('lock') === 'on', manualAt: new Date() },
      })
      await ubahStokTx(tx, { target: { jenis: 'stok_ban', id }, setKe: stock, tipe: 'koreksi', refId: `stok_ban:${id}`, pengguna: penggunaDari(s) })
    })
  } catch (e) {
    go(to, e instanceof GalatStok ? e.message : 'Baris stok tidak ditemukan atau gagal disimpan', 'err')
  }
  await catat(s, 'simpan', 'stok_ban', { id, stok: stock })
  go(to, 'Baris stok tersimpan')
}

/* ---------- Ongkir ---------- */

const TARIF_PAGE = '/admin/ongkir/tarif'
const SHIP_PAGE = '/admin/pengaturan/ongkir'

function carrierOf(raw: string): Carrier | null {
  const s = raw.toLowerCase().replace(/[^a-z]/g, '')
  if ((CARRIERS as readonly string[]).includes(raw)) return raw as Carrier
  if (s.startsWith('jnt') || s.startsWith('jt')) return 'JNT_CARGO'
  if (s.startsWith('baraka')) return 'BARAKA'
  return null
}

const rateData = (carrier: Carrier, city: string, perKg: number, minWeight: number, etaDays: string, note: string, isSample: boolean) => ({
  carrier,
  city,
  perKg,
  minWeight,
  etaDays: etaDays.slice(0, 30),
  note: note.slice(0, 200),
  isSample,
})

export async function saveRate(fd: FormData) {
  const s = await requireOwner()
  const id = int(fd, 'id')
  const carrier = carrierOf(str(fd, 'carrier', 20))
  const city = str(fd, 'city', 60)
  const perKg = int(fd, 'perKg')
  const minWeight = dec(fd, 'minWeight')
  if (!carrier) go(TARIF_PAGE, 'Ekspedisi tidak dikenali', 'err')
  if (city.length < 2) go(TARIF_PAGE, 'Kota tujuan wajib diisi', 'err')
  if (perKg < 1 || perKg > 1_000_000) go(TARIF_PAGE, 'Tarif per kg harus antara 1 dan 1.000.000', 'err')
  if (Number.isNaN(minWeight) || minWeight > 1000) go(TARIF_PAGE, 'Berat minimum tidak valid', 'err')
  const data = rateData(carrier!, city, perKg, minWeight, str(fd, 'etaDays', 30), str(fd, 'note', 200), fd.get('isSample') === 'on')
  try {
    if (id) await db.shippingRate.update({ where: { id }, data })
    else await db.shippingRate.create({ data })
  } catch {
    go(TARIF_PAGE, 'Tarif ekspedisi dan kota itu sudah ada. Ubah baris yang lama.', 'err')
  }
  await catat(s, id ? 'ubah' : 'tambah', 'tarif_ongkir', { id: id || null, carrier, city })
  go(TARIF_PAGE, 'Tarif tersimpan')
}

export async function deleteRate(fd: FormData) {
  const s = await requireOwner()
  await db.shippingRate.deleteMany({ where: { id: int(fd, 'id') } })
  await catat(s, 'hapus', 'tarif_ongkir', { id: int(fd, 'id') })
  go(TARIF_PAGE, 'Tarif dihapus')
}

// Tempel banyak baris: ekspedisi, kota, tarif per kg, berat minimum, estimasi hari, catatan.
// Pemisah koma, titik koma, atau tab. Baris yang tidak valid dilaporkan, tidak ditebak.
export async function importRates(fd: FormData) {
  const s = await requireOwner()
  const lines = str(fd, 'paste', 50_000).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const sample = fd.get('isSample') === 'on'
  let ok = 0
  const bad: string[] = []
  for (const [i, l] of lines.entries()) {
    const c = l.split(/[\t;,]/).map((x) => x.trim())
    const carrier = carrierOf(c[0] ?? '')
    const perKg = Number((c[2] ?? '').replace(/\./g, ''))
    const min = c[3] ? Number(c[3].replace(',', '.')) : 10
    if (/^ekspedisi$/i.test(c[0] ?? '')) continue
    if (!carrier || !c[1] || !Number.isInteger(perKg) || perKg < 1 || perKg > 1_000_000 || !Number.isFinite(min) || min < 0) {
      bad.push(`baris ${i + 1}`)
      continue
    }
    const data = rateData(carrier, c[1], perKg, min, c[4] ?? '', c[5] ?? '', sample)
    await db.shippingRate.upsert({ where: { carrier_city: { carrier, city: c[1] } }, create: data, update: data })
    ok++
  }
  if (!ok && bad.length) go(TARIF_PAGE, `Tidak ada baris valid (${bad.slice(0, 5).join(', ')}). Format: ekspedisi, kota, tarif per kg, berat minimum, estimasi hari, catatan`, 'err')
  await catat(s, 'impor', 'tarif_ongkir', { masuk: ok, dilewati: bad.length })
  go(TARIF_PAGE, `${ok} tarif masuk${bad.length ? `, ${bad.length} baris dilewati (${bad.slice(0, 5).join(', ')})` : ''}`)
}

// Form pengaturan ongkir dipecah per bagian (asal, hitung, velg, kemasan). Hanya bagian yang dikirim
// yang diperbarui; bagian lain tetap memakai nilai tersimpan. Tanpa penanda bagian, semua diperbarui.
export async function saveShipSettings(fd: FormData) {
  const s = await requireOwner()
  const old = await loadShippingSettings()
  const bagian = str(fd, 'bagian', 20)
  const ubah = (b: string) => !bagian || bagian === b
  let ringPack: ShippingSettings['ringPack'] = old.ringPack
  if (ubah('kemasan')) {
    ringPack = {}
    for (let r = 12; r <= 19; r++) {
      const p = { weightKg: dec(fd, `w${r}`), lengthCm: dec(fd, `l${r}`), widthCm: dec(fd, `b${r}`), heightCm: dec(fd, `t${r}`) }
      if (Object.values(p).some((v) => Number.isNaN(v) || v > 500)) go(SHIP_PAGE, `Ukuran kemasan R${r} tidak valid`, 'err')
      ringPack[String(r)] = p
    }
  }
  let velgPack = old.velg
  if (ubah('velg')) {
    velgPack = { weightKg: dec(fd, 'velgW'), lengthCm: dec(fd, 'velgL'), widthCm: dec(fd, 'velgB'), heightCm: dec(fd, 'velgT') }
    if (Object.values(velgPack).some((v) => Number.isNaN(v) || v > 500)) go(SHIP_PAGE, 'Berat atau ukuran velg tidak valid', 'err')
  }
  let origins: ShippingSettings['origins'] = old.origins
  if (ubah('asal')) {
    origins = {}
    for (const b of await db.branch.findMany({ select: { slug: true } })) {
      const lat = str(fd, `lat_${b.slug}`, 20).replace(',', '.')
      const lon = str(fd, `lon_${b.slug}`, 20).replace(',', '.')
      const la = lat === '' ? null : Number(lat)
      const lo = lon === '' ? null : Number(lon)
      if ((la !== null && !(la >= -90 && la <= 90)) || (lo !== null && !(lo >= -180 && lo <= 180))) go(SHIP_PAGE, `Koordinat cabang ${b.slug} tidak valid`, 'err')
      origins[b.slug] = { lat: la, lon: lo }
    }
  }
  let divisor = old.divisor
  if (ubah('hitung')) {
    divisor = { JNT_CARGO: int(fd, 'divJnt'), BARAKA: int(fd, 'divBaraka') }
    if (divisor.JNT_CARGO < 1000 || divisor.BARAKA < 1000) go(SHIP_PAGE, 'Pembagi berat volume minimal 1000', 'err')
  }
  const next: ShippingSettings = mergeSettings({
    ...old,
    origin: ubah('asal') ? str(fd, 'origin', 80) : old.origin,
    divisor,
    packingPerTire: ubah('hitung') ? int(fd, 'packing') : old.packingPerTire,
    ringPack,
    ringPackSample: ubah('kemasan') ? fd.get('ringPackSample') === 'on' : old.ringPackSample,
    velg: velgPack,
    velgNote: ubah('velg') ? str(fd, 'velgNote', 120) : old.velgNote,
    origins,
  })
  await saveSetting('ongkir', next)
  await catat(s, 'simpan', 'pengaturan_ongkir', { kunci: 'ongkir', bagian: bagian || 'semua' })
  go(SHIP_PAGE, 'Pengaturan ongkir tersimpan')
}

/* ---------- Harga jasa ---------- */

const optInt = (fd: FormData, k: string) => {
  const v = str(fd, k, 12).replace(/\D/g, '')
  return v === '' ? null : Number(v)
}

export async function saveService(fd: FormData) {
  const s = await requireOwner()
  const id = int(fd, 'id')
  const name = str(fd, 'name', 80)
  const groupName = str(fd, 'groupName', 60) || name
  if (!name) go('/admin/harga-jasa', 'Nama jasa wajib diisi', 'err')
  const data = {
    groupName,
    name,
    variant: str(fd, 'variant', 80),
    ringMin: optInt(fd, 'ringMin'),
    ringMax: optInt(fd, 'ringMax'),
    minDiameter: optInt(fd, 'minDiameter'),
    price: optInt(fd, 'price'),
    unit: str(fd, 'unit', 40),
    altLabel: str(fd, 'altLabel', 40),
    altPrice: optInt(fd, 'altPrice'),
    note: str(fd, 'note', 200),
    keywords: str(fd, 'keywords', 200).toLowerCase(),
    sort: int(fd, 'sort'),
  }
  if (data.ringMin !== null && data.ringMax !== null && data.ringMin > data.ringMax) go('/admin/harga-jasa', 'Ring awal tidak boleh lebih besar dari ring akhir', 'err')
  if (id) await db.servicePrice.update({ where: { id }, data })
  else await db.servicePrice.create({ data })
  await catat(s, id ? 'ubah' : 'tambah', 'harga_jasa', { id: id || null, nama: name })
  go('/admin/harga-jasa', 'Harga jasa tersimpan')
}

export async function deleteService(fd: FormData) {
  const s = await requireOwner()
  await db.servicePrice.deleteMany({ where: { id: int(fd, 'id') } })
  await catat(s, 'hapus', 'harga_jasa', { id: int(fd, 'id') })
  go('/admin/harga-jasa', 'Baris dihapus')
}

/* ---------- Pengaturan situs publik ---------- */

// Halaman Tautan WhatsApp punya tiga form (nomor, pembuka, harga). Hanya bagian yang dikirim yang
// diperbarui; bagian lain tetap memakai nilai tersimpan. Tanpa penanda bagian, semua diperbarui.
export async function saveSitus(fd: FormData) {
  const s = await requireOwner()
  const bagian = str(fd, 'bagian', 20)
  const ubah = (b: string) => !bagian || bagian === b
  const row = await db.setting.findUnique({ where: { key: 'situs' } })
  const cur = mergeSitus(row ? JSON.parse(row.value) : null)
  const main = str(fd, 'mainWhatsapp', 30)
  if (ubah('nomor') && main && !/^62\d{8,13}$/.test(normalizeNumber(main))) go('/admin/situs', 'Nomor WhatsApp utama tidak valid', 'err')
  const op = (k: string) => str(fd, k, 300)
  const next = mergeSitus({
    mainWhatsapp: ubah('nomor') ? (main ? normalizeNumber(main) : '') : cur.mainWhatsapp,
    showPrices: ubah('harga') ? fd.get('showPrices') === 'on' : cur.showPrices,
    openers: ubah('pembuka') ? { umum: op('opUmum'), produk: op('opProduk') } : cur.openers,
  })
  for (const [k, v] of Object.entries(next.openers)) if (!v.trim()) go('/admin/situs', `Kalimat pembuka ${k} tidak boleh kosong`, 'err')
  await saveSetting('situs', next)
  await catat(s, 'simpan', 'pengaturan_situs', { kunci: 'situs', bagian: bagian || 'semua' })
  go('/admin/situs', bagian === 'nomor' ? 'Nomor WhatsApp utama tersimpan' : bagian === 'pembuka' ? 'Kalimat pembuka tersimpan' : bagian === 'harga' ? 'Pengaturan harga di situs tersimpan' : 'Pengaturan situs tersimpan')
}

/* ---------- Chatbot ---------- */

export async function testBot(fd: FormData) {
  await requireOwner()
  const input = str(fd, 'q', 500)
  if (!input) go('/admin/chatbot/uji', 'Ketik pesan uji dulu', 'err')
  const known = str(fd, 'known', 40)
  const pending = str(fd, 'pending', 500)
  // Saklar stok per cabang untuk uji ini saja: kosong = ikut pengaturan.
  const per = str(fd, 'perCabang', 5)
  const o = await runBot(input, '0857 0000 0000', {
    knownBranch: known || undefined,
    awaiting: pending ? { action: 'stok', text: pending } : null,
    ...(per === 'on' || per === 'off' ? { stokPerCabang: per === 'on' } : {}),
  })
  const reply = o.reply + (o.adminNote ? `\n\n[Ringkasan ke admin ${o.adminNumber || '(nomor admin belum diisi)'}]\n${o.adminNote}` : '')
  const log = await db.botLog.create({
    data: {
      source: 'UJI',
      input,
      reply,
      handoff: o.kind === 'serah',
      reason: `${o.kind}${known ? ` [cabang diingat ${known}]` : ''}${pending ? ' [menunggu jawaban cabang]' : ''}${per === 'on' ? ' [stok per cabang nyala]' : per === 'off' ? ' [stok per cabang mati]' : ''}${o.branchSlug ? ` (cabang ${o.branchSlug})` : ' (cabang tidak dikenali)'}: ${o.reason}`,
    },
  })
  redirect(`/admin/chatbot/uji?log=${log.id}`)
}

const time = (v: string, fallback: string) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback)
const BOT_PAGE = '/admin/pengaturan/whatsapp'
const TEMPLAT_PAGE = '/admin/chatbot/templat'

export async function saveBotHours(fd: FormData) {
  const s = await requireOwner()
  const cur = await loadBotSettings()
  const given = str(fd, 'testNumbers', 2000).split(/[\s,;]+/).filter(Boolean)
  const testNumbers = [...new Set(given.map(normalizeNumber).filter((n) => /^62\d{8,13}$/.test(n)))]
  const next: BotSettings = mergeBot({
    ...cur,
    enabled: fd.get('enabled') === 'on',
    startTime: time(str(fd, 'startTime', 5), '08:00'),
    endTime: time(str(fd, 'endTime', 5), '17:00'),
    gapSec: Math.min(int(fd, 'gapSec'), 3600),
    dailyLimit: Math.min(int(fd, 'dailyLimit'), 5000),
    muteHours: Math.max(1, Math.min(int(fd, 'muteHours') || 6, 168)),
    branchMemoryDays: Math.max(1, Math.min(int(fd, 'branchMemoryDays') || 30, 365)),
    branchWaitMin: Math.max(1, Math.min(int(fd, 'branchWaitMin') || 15, 1440)),
    restrictNumbers: fd.get('restrictNumbers') === 'on',
    stokPerCabang: fd.get('stokPerCabang') === 'on',
    testNumbers,
  })
  await saveSetting('bot', next)
  await catat(s, 'simpan', 'pengaturan_bot', { bagian: 'jam', nomorUji: testNumbers.length, stokPerCabang: next.stokPerCabang })
  go(BOT_PAGE, given.length > testNumbers.length ? `Tersimpan, ${given.length - testNumbers.length} nomor tidak valid atau dobel dibuang` : 'Jam dan batas kirim tersimpan')
}

export async function saveBotAdmins(fd: FormData) {
  const s = await requireOwner()
  const cur = await loadBotSettings()
  const adminNumbers: Record<string, string> = {}
  const branchAliases: Record<string, string[]> = {}
  for (const b of await db.branch.findMany({ select: { slug: true } })) {
    branchAliases[b.slug] = str(fd, `alias_${b.slug}`, 200).toLowerCase().split(/[,;\n]/).map((x) => x.trim()).filter((x) => /^[a-z0-9 ]{3,30}$/.test(x))
    const raw = str(fd, `admin_${b.slug}`, 30)
    if (!raw) continue
    const n = normalizeNumber(raw)
    if (!/^62\d{8,13}$/.test(n)) go(BOT_PAGE, `Nomor admin ${b.slug} tidak valid`, 'err')
    adminNumbers[b.slug] = n
  }
  const ownerRaw = str(fd, 'ownerNumber', 30)
  const ownerNumber = ownerRaw ? normalizeNumber(ownerRaw) : ''
  if (ownerNumber && !/^62\d{8,13}$/.test(ownerNumber)) go(BOT_PAGE, 'Nomor owner tidak valid', 'err')
  await saveSetting('bot', mergeBot({ ...cur, adminNumbers, ownerNumber, branchAliases }))
  await catat(s, 'simpan', 'pengaturan_bot', { bagian: 'nomor_admin', cabang: Object.keys(adminNumbers).length })
  go(BOT_PAGE, 'Nomor admin tersimpan')
}

export async function saveBotTemplates(fd: FormData) {
  const s = await requireOwner()
  const cur = await loadTemplates()
  const next = { ...cur } as Templates
  for (const k of TEMPLATE_KEYS) {
    const v = String(fd.get(`tpl_${k}`) ?? '').trim().slice(0, 1000)
    if (!v) go(TEMPLAT_PAGE, `Templat "${k}" tidak boleh kosong`, 'err')
    next[k] = v
  }
  await saveSetting('bot.templates', next)
  await catat(s, 'simpan', 'templat_bot', { jumlah: TEMPLATE_KEYS.length })
  go(TEMPLAT_PAGE, 'Templat pesan tersimpan')
}

export async function resetBotTemplates() {
  const s = await requireOwner()
  await db.setting.deleteMany({ where: { key: 'bot.templates' } })
  await catat(s, 'reset', 'templat_bot')
  go(TEMPLAT_PAGE, 'Templat dikembalikan ke bawaan')
}

export async function saveSosmed(fd: FormData) {
  const s = await requireOwner()
  const cur = await loadSosmed()
  const next = { ...cur } as Sosmed
  for (const c of CHANNELS) {
    const v = String(fd.get(`sosmed_${c}`) ?? '').trim().slice(0, 1000)
    if (v) next[c] = v
  }
  await saveSetting('bot.sosmed', next)
  await catat(s, 'simpan', 'templat_sosmed', { saluran: CHANNELS.length })
  go(BOT_PAGE, 'Templat sosial media tersimpan')
}

// Admin menandai percakapan selesai. Tidak tersedia: bot mengirim kalimat penutup.
// Owner boleh semua percakapan; admin cabang hanya percakapan cabangnya sendiri.
export async function markConversation(fd: FormData) {
  const s = await requireUser()
  const id = int(fd, 'id')
  const ada = str(fd, 'to', 20) === 'ada'
  const c = await db.botConversation.findUnique({ where: { id } })
  if (!c) go('/admin/chatbot', 'Percakapan tidak ditemukan', 'err')
  if (s.role !== 'OWNER') {
    const milik = s.branchId ? await db.branch.findUnique({ where: { id: s.branchId }, select: { slug: true } }) : null
    if (!milik || c!.branchSlug !== milik.slug) go('/admin/chatbot', 'Percakapan ini bukan milik cabang kamu', 'err')
  }
  const status = nextStatus(c!.status as Status, ada ? 'tandai_ada' : 'tandai_tidak_ada')
  await db.botConversation.update({ where: { id }, data: { status, mutedUntil: null, closingPending: !ada && status === 'SELESAI_TIDAK_ADA' ? true : c!.closingPending } })
  await catat(s, 'tandai', 'percakapan_bot', { id, status })
  go('/admin/chatbot', ada ? 'Ditandai selesai, tersedia' : 'Ditandai selesai, tidak tersedia')
}

export async function clearBotLogs() {
  const s = await requireOwner()
  await db.botLog.deleteMany({ where: { source: 'UJI' } })
  await catat(s, 'hapus', 'log_uji_bot')
  go('/admin/chatbot/uji', 'Riwayat uji dihapus')
}
