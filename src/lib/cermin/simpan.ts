// Penyimpanan cermin chat WhatsApp. Dipakai webhook WAHA, penarik riwayat, dan worker bot (penanda kiriman bot).
// Semua penulisan idempoten per (chat, id pesan): pesan yang datang dua kali tidak membuat baris ganda.
// Jangan mencetak isi pesan ke log: isi chat adalah data pribadi pelanggan.
import { db } from '../db'
import { chatLid, cuplikan, idDariKiriman, penanda, retensiDari, type EventCermin, type PesanCermin } from './baca'
import { petakanLid, type CariPn } from './lid'

const unik = <T,>(xs: T[]) => [...new Set(xs)]

// Perbarui pesan terakhir dan waktunya dari isi tabel pesan, supaya urutan daftar chat selalu benar
// walau pesan datang tidak berurutan (webhook dan tarik riwayat bergantian, atau pesan dihapus).
async function segarkanChat(chatId: string) {
  const akhir = await db.waPesan.findFirst({ where: { chatId }, orderBy: [{ waktu: 'desc' }, { id: 'desc' }], select: { isi: true, jenis: true, namaBerkas: true, dihapus: true, waktu: true } })
  if (akhir) await db.waChat.update({ where: { chatId }, data: { pesanTerakhir: cuplikan(akhir), waktuTerakhir: akhir.waktu } })
}

async function pastikanChat(chatId: string, grup: boolean, nama: string) {
  await db.waChat.upsert({ where: { chatId }, create: { chatId, grup, nama }, update: nama ? { nama, grup } : { grup } })
}

// Chat pribadi ber-LID diganti nomornya kalau diketahui (payload, tabel wa_lid, atau WAHA). Yang tidak ketemu tetap LID.
async function normalkan(list: PesanCermin[], cari?: CariPn): Promise<PesanCermin[]> {
  const lid = list.filter((p) => !p.grup && chatLid(p.chatId))
  if (!lid.length) return list
  const alt = new Map(lid.filter((p) => p.chatAlt).map((p) => [p.chatId, p.chatAlt]))
  const peta = await petakanLid(lid.map((p) => p.chatId), alt, cari)
  return list.map((p) => (peta.has(p.chatId) ? { ...p, chatId: peta.get(p.chatId)!, chatAlt: '' } : p))
}

// Simpan sekumpulan pesan. namaChat: nama dari daftar chat WAHA (tarik riwayat), mengalahkan nama tampilan pengirim.
// cari: pencari nomor untuk chat LID (API WAHA), dipakai kalau payload dan tabel wa_lid belum tahu nomornya.
export async function simpanPesan(asli: PesanCermin[], namaChat: Map<string, string> = new Map(), cari?: CariPn): Promise<{ baru: number }> {
  if (!asli.length) return { baru: 0 }
  const list = await normalkan(asli, cari)
  const idKeluar = unik(list.filter((p) => p.dariSaya).map((p) => p.idPendek))
  const idBot = new Set(idKeluar.length ? (await db.waKirimBot.findMany({ where: { idPendek: { in: idKeluar } }, select: { idPendek: true } })).map((r) => r.idPendek) : [])
  const ada = await db.waPesan.findMany({
    where: { idPendek: { in: unik(list.map((p) => p.idPendek)) } },
    select: { id: true, chatId: true, idPendek: true, pengirim: true, sementara: true, diedit: true },
  })
  const kunci = (c: string, i: string) => `${c}\u0000${i}`
  const lama = new Map(ada.map((r) => [kunci(r.chatId, r.idPendek), r]))

  // Chat dulu, karena baris pesan merujuk chat lewat chat_id (tanpa relasi, tapi daftar chat membaca tabel ini).
  for (const chatId of unik(list.map((p) => p.chatId))) {
    const milik = list.filter((p) => p.chatId === chatId)
    const grup = milik[0].grup
    // Chat pribadi: nama tampilan pelanggan dari pesan masuk terbaru. Grup: hanya dari daftar chat WAHA.
    const dariPelanggan = grup ? '' : ([...milik].filter((p) => !p.dariSaya && p.namaPengirim).sort((a, b) => b.waktu.getTime() - a.waktu.getTime())[0]?.namaPengirim ?? '')
    await pastikanChat(chatId, grup, namaChat.get(chatId) || dariPelanggan)
  }

  const baruRows = []
  for (const p of list) {
    const r = lama.get(kunci(p.chatId, p.idPendek))
    const pengirim = penanda(p.dariSaya, p.idPendek, idBot)
    if (!r) {
      baruRows.push({ chatId: p.chatId, waId: p.waId, idPendek: p.idPendek, dariSaya: p.dariSaya, pengirim, peserta: p.peserta, namaPengirim: p.namaPengirim, isi: p.isi, jenis: p.jenis, namaBerkas: p.namaBerkas, waktu: p.waktu })
      continue
    }
    if (r.sementara) {
      // Baris dari event hapus atau edit yang datang lebih dulu: lengkapi, tapi tanda dihapus dan isi hasil edit dipertahankan.
      await db.waPesan.update({
        where: { id: r.id },
        data: { waId: p.waId, dariSaya: p.dariSaya, pengirim, peserta: p.peserta, namaPengirim: p.namaPengirim, jenis: p.jenis, namaBerkas: p.namaBerkas, waktu: p.waktu, sementara: false, ...(r.diedit ? {} : { isi: p.isi }) },
      })
    } else if (r.pengirim !== pengirim && pengirim === 'bot') {
      await db.waPesan.update({ where: { id: r.id }, data: { pengirim } })
    }
  }
  // skipDuplicates: dua webhook yang sama datang bersamaan tetap menghasilkan satu baris.
  const { count } = baruRows.length ? await db.waPesan.createMany({ data: baruRows, skipDuplicates: true }) : { count: 0 }
  for (const chatId of unik(list.map((p) => p.chatId))) await segarkanChat(chatId)
  return { baru: count }
}

// Tandai pesan dihapus atau diedit. Kalau pesan aslinya belum ada, dibuat baris sementara supaya tandanya tidak hilang.
async function terapkanAksi(asli: Extract<EventCermin, { jenis: 'hapus' | 'edit' }>, cari?: CariPn) {
  let ev = asli
  if (ev.chatId && chatLid(ev.chatId)) {
    const pn = (await petakanLid([ev.chatId], new Map(ev.chatAlt ? [[ev.chatId, ev.chatAlt]] : []), cari)).get(ev.chatId)
    if (pn) ev = { ...ev, chatId: pn }
  }
  const data = ev.jenis === 'hapus' ? { dihapus: true } : { diedit: true, isi: ev.isi }
  const where = ev.chatId ? { chatId: ev.chatId, idPendek: ev.idPendek } : { idPendek: ev.idPendek }
  const { count } = await db.waPesan.updateMany({ where, data })
  if (!count && ev.chatId) {
    const idBot = ev.dariSaya && (await db.waKirimBot.findUnique({ where: { idPendek: ev.idPendek } })) ? new Set([ev.idPendek]) : new Set<string>()
    await pastikanChat(ev.chatId, ev.chatId.endsWith('@g.us'), '')
    await db.waPesan.createMany({
      data: [{ chatId: ev.chatId, waId: ev.idPendek, idPendek: ev.idPendek, dariSaya: ev.dariSaya, pengirim: penanda(ev.dariSaya, ev.idPendek, idBot), waktu: ev.waktu, sementara: true, ...data }],
      skipDuplicates: true,
    })
    // Baris sementara bisa kalah balapan dengan pesan aslinya; ulangi tandanya supaya tetap terpasang.
    await db.waPesan.updateMany({ where, data })
  }
  const chats = ev.chatId ? [ev.chatId] : (await db.waPesan.findMany({ where, select: { chatId: true } })).map((r) => r.chatId)
  for (const c of unik(chats)) await segarkanChat(c)
}

export async function terapkanEvent(ev: EventCermin, cari?: CariPn): Promise<{ simpan: boolean }> {
  if (ev.jenis === 'pesan') {
    await simpanPesan([ev.pesan], new Map(), cari)
    return { simpan: true }
  }
  if (ev.jenis === 'hapus' || ev.jenis === 'edit') {
    await terapkanAksi(ev, cari)
    return { simpan: true }
  }
  return { simpan: false }
}

// Dipanggil worker bot sesudah sendText berhasil. Pesan keluar dengan id ini menjadi "bot", termasuk yang
// sudah lebih dulu masuk lewat webhook dan sempat ditandai "admin".
export async function catatKirimBot(jawabanSendText: unknown): Promise<string> {
  const idPendek = idDariKiriman(jawabanSendText)
  if (!idPendek) return ''
  await db.waKirimBot.createMany({ data: [{ idPendek }], skipDuplicates: true })
  await db.waPesan.updateMany({ where: { idPendek, dariSaya: true, pengirim: { not: 'bot' } }, data: { pengirim: 'bot' } })
  return idPendek
}

// ---- Retensi ----

export const bacaRetensi = async () => {
  const row = await db.setting.findUnique({ where: { key: 'cermin' } })
  let v: unknown = null
  try {
    v = row ? JSON.parse(row.value) : null
  } catch {
    v = null
  }
  return retensiDari(v)
}

// Hapus pesan yang lebih tua dari `hari`, id kiriman bot yang sama tuanya, dan chat yang sudah tidak punya pesan.
export async function bersihkan(hari: number, sekarang = new Date()) {
  const batas = new Date(sekarang.getTime() - hari * 86400_000)
  const pesan = await db.waPesan.deleteMany({ where: { waktu: { lt: batas } } })
  await db.waKirimBot.deleteMany({ where: { dibuat: { lt: batas } } })
  await db.waLid.deleteMany({ where: { diperbarui: { lt: batas } } })
  const chat = await db.$executeRaw`DELETE FROM "wa_chat" c WHERE NOT EXISTS (SELECT 1 FROM "wa_pesan" p WHERE p."chat_id" = c."chat_id")`
  return { pesan: pesan.count, chat }
}

// Pembersihan tanpa cron: dijalankan oleh webhook dan tarik riwayat, paling sering sekali per jam per proses.
let terakhirBersih = 0
export async function bersihkanBilaPerlu(sekarang = new Date()) {
  if (sekarang.getTime() - terakhirBersih < 3600_000) return null
  terakhirBersih = sekarang.getTime()
  return bersihkan(await bacaRetensi(), sekarang)
}
