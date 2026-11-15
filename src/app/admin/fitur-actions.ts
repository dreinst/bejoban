'use server'
// Aksi untuk tiga halaman internal: stok ban, ongkir, chatbot. Semua cek sesi di server.
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { parsePricelist } from '@/lib/tire/pricelist'
import { CARRIERS, type Carrier, type ShippingSettings } from '@/lib/ongkir/types'
import { mergeSettings } from '@/lib/ongkir/calc'
import { loadShippingSettings } from '@/lib/ongkir/db-source'
import { mergeBot, normalizeNumber, type BotSettings } from '@/lib/bot/policy'
import { respond } from '@/lib/bot/respond'

const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? '').trim().slice(0, max)
const int = (fd: FormData, k: string) => Math.max(0, Math.round(Number(String(fd.get(k) ?? '0').replace(/\D/g, '')) || 0))
const dec = (fd: FormData, k: string) => {
  const n = Number(str(fd, k, 20).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : NaN
}
const go = (path: string, msg: string, kind: 'ok' | 'err' = 'ok') => {
  revalidatePath('/admin', 'layout')
  redirect(`${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`)
}
const saveSetting = (key: string, value: unknown) =>
  db.setting.upsert({ where: { key }, create: { key, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } })

/* ---------- Stok ban ---------- */

const MAX_CSV = 2_000_000

export async function importStock(fd: FormData) {
  await requireOwner()
  const file = fd.get('file')
  let text = str(fd, 'paste', MAX_CSV)
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_CSV) go('/admin/stok-ban', 'Berkas terlalu besar (maksimal 2 MB)', 'err')
    text = await file.text()
  }
  if (!text.trim()) go('/admin/stok-ban', 'Pilih berkas CSV atau tempel isinya dulu', 'err')
  const r = parsePricelist(text)
  if (!r.rows.length) go('/admin/stok-ban', 'Tidak ada baris ban yang terbaca. Pastikan ada kolom "Ukuran Ban".', 'err')
  const now = new Date()
  await db.$transaction([
    db.stockTire.deleteMany(),
    db.stockTire.createMany({ data: r.rows.map((x) => ({ ...x, importedAt: now })) }),
  ])
  await saveSetting('stok.lastImport', {
    at: now.toISOString(),
    total: r.rows.length,
    withPrice: r.rows.filter((x) => x.price !== null).length,
    noPrice: r.rows.filter((x) => x.price === null).length,
    skipped: r.skipped,
    problems: r.problems.slice(0, 300),
    problemCount: r.problems.length,
  })
  go('/admin/stok-ban', `${r.rows.length} baris masuk`)
}

/* ---------- Ongkir ---------- */

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
  await requireOwner()
  const id = int(fd, 'id')
  const carrier = carrierOf(str(fd, 'carrier', 20))
  const city = str(fd, 'city', 60)
  const perKg = int(fd, 'perKg')
  const minWeight = dec(fd, 'minWeight')
  if (!carrier) go('/admin/ongkir/tarif', 'Ekspedisi tidak dikenali', 'err')
  if (city.length < 2) go('/admin/ongkir/tarif', 'Kota tujuan wajib diisi', 'err')
  if (perKg < 1 || perKg > 1_000_000) go('/admin/ongkir/tarif', 'Tarif per kg harus antara 1 dan 1.000.000', 'err')
  if (Number.isNaN(minWeight) || minWeight > 1000) go('/admin/ongkir/tarif', 'Berat minimum tidak valid', 'err')
  const data = rateData(carrier!, city, perKg, minWeight, str(fd, 'etaDays', 30), str(fd, 'note', 200), fd.get('isSample') === 'on')
  try {
    if (id) await db.shippingRate.update({ where: { id }, data })
    else await db.shippingRate.create({ data })
  } catch {
    go('/admin/ongkir/tarif', 'Tarif ekspedisi dan kota itu sudah ada. Ubah baris yang lama.', 'err')
  }
  go('/admin/ongkir/tarif', 'Tarif tersimpan')
}

export async function deleteRate(fd: FormData) {
  await requireOwner()
  await db.shippingRate.deleteMany({ where: { id: int(fd, 'id') } })
  go('/admin/ongkir/tarif', 'Tarif dihapus')
}

// Tempel banyak baris: ekspedisi, kota, tarif per kg, berat minimum, estimasi hari, catatan.
// Pemisah koma, titik koma, atau tab. Baris yang tidak valid dilaporkan, tidak ditebak.
export async function importRates(fd: FormData) {
  await requireOwner()
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
  if (!ok && bad.length) go('/admin/ongkir/tarif', `Tidak ada baris valid (${bad.slice(0, 5).join(', ')}). Format: ekspedisi, kota, tarif per kg, berat minimum, estimasi hari, catatan`, 'err')
  go('/admin/ongkir/tarif', `${ok} tarif masuk${bad.length ? `, ${bad.length} baris dilewati (${bad.slice(0, 5).join(', ')})` : ''}`)
}

export async function saveShipSettings(fd: FormData) {
  await requireOwner()
  const old = await loadShippingSettings()
  const ringPack: ShippingSettings['ringPack'] = {}
  for (let r = 12; r <= 19; r++) {
    const p = { weightKg: dec(fd, `w${r}`), lengthCm: dec(fd, `l${r}`), widthCm: dec(fd, `b${r}`), heightCm: dec(fd, `t${r}`) }
    if (Object.values(p).some((v) => Number.isNaN(v) || v > 500)) go('/admin/ongkir/tarif', `Ukuran kemasan R${r} tidak valid`, 'err')
    ringPack[String(r)] = p
  }
  const jnt = int(fd, 'divJnt')
  const bar = int(fd, 'divBaraka')
  if (jnt < 1000 || bar < 1000) go('/admin/ongkir/tarif', 'Pembagi berat volume minimal 1000', 'err')
  const next: ShippingSettings = mergeSettings({
    ...old,
    origin: str(fd, 'origin', 80),
    divisor: { JNT_CARGO: jnt, BARAKA: bar },
    packingPerTire: int(fd, 'packing'),
    ringPack,
    ringPackSample: fd.get('ringPackSample') === 'on',
  })
  await saveSetting('ongkir', next)
  go('/admin/ongkir/tarif', 'Pengaturan tersimpan')
}

/* ---------- Chatbot ---------- */

export async function testBot(fd: FormData) {
  await requireOwner()
  const input = str(fd, 'q', 500)
  if (!input) go('/admin/chatbot', 'Ketik pesan uji dulu', 'err')
  const a = await respond(input)
  const log = await db.botLog.create({
    data: { source: 'UJI', input, reply: a.reply, handoff: a.handoff, reason: a.reason },
  })
  redirect(`/admin/chatbot?log=${log.id}`)
}

const time = (v: string, fallback: string) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback)

export async function saveBot(fd: FormData) {
  await requireOwner()
  const numbers = [...new Set(str(fd, 'numbers', 2000).split(/[\s,;]+/).map(normalizeNumber).filter((n) => /^62\d{8,13}$/.test(n)))]
  const given = str(fd, 'numbers', 2000).split(/[\s,;]+/).filter(Boolean).length
  const next: BotSettings = mergeBot({
    enabled: fd.get('enabled') === 'on',
    startTime: time(str(fd, 'startTime', 5), '08:00'),
    endTime: time(str(fd, 'endTime', 5), '17:00'),
    gapSec: Math.min(int(fd, 'gapSec'), 3600),
    dailyLimit: Math.min(int(fd, 'dailyLimit'), 1000),
    numbers,
    replyOnHandoff: fd.get('replyOnHandoff') === 'on',
  })
  await saveSetting('bot', next)
  go('/admin/chatbot', given > numbers.length ? `Tersimpan, tapi ${given - numbers.length} nomor tidak valid atau dobel dibuang` : 'Pengaturan tersimpan')
}

export async function clearBotLogs() {
  await requireOwner()
  await db.botLog.deleteMany({ where: { source: 'UJI' } })
  go('/admin/chatbot', 'Log uji dihapus')
}
