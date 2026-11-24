// Pembaca payload WAHA untuk cermin chat. Modul murni (tanpa database, tanpa jaringan) supaya mudah dites.
// Bentuk payload mengikuti WAHA engine GOWS (src/core/engines/gows/session.gows.core.ts di repo devlikeapro/waha):
// - message.any: { id: "true_<chat>_<ID>[_<peserta>]", timestamp (detik), from, to, fromMe, participant, body,
//   hasMedia, media, location, vCards, _data: { Info: { Chat, Sender, PushName, IsGroup, MediaType }, Message } }
// - message.revoked: { after: <pesan aksi hapus>, before: null, revokedMessageId: "<ID>" }
// - message.edited: { ...<pesan aksi edit>, body: <isi baru>, editedMessageId: "<ID>" }
// Semua field dianggap boleh hilang. Payload yang tidak bisa dibaca menghasilkan { jenis: 'abaikan' }, tidak melempar galat.
import { createHmac, timingSafeEqual } from 'node:crypto'

export type Pengirim = 'pelanggan' | 'bot' | 'admin'
export const PENGIRIM: Pengirim[] = ['pelanggan', 'bot', 'admin']
export const PENGIRIM_LABEL: Record<Pengirim, string> = { pelanggan: 'Pelanggan', bot: 'Bot', admin: 'Admin' }

export type JenisPesan = 'teks' | 'gambar' | 'video' | 'suara' | 'dokumen' | 'stiker' | 'lokasi' | 'kontak'
export const JENIS_LABEL: Record<JenisPesan, string> = {
  teks: 'Teks',
  gambar: 'Gambar',
  video: 'Video',
  suara: 'Pesan suara',
  dokumen: 'Dokumen',
  stiker: 'Stiker',
  lokasi: 'Lokasi',
  kontak: 'Kontak',
}

export type PesanCermin = {
  chatId: string
  waId: string
  idPendek: string
  dariSaya: boolean
  grup: boolean
  peserta: string
  namaPengirim: string
  isi: string
  jenis: JenisPesan
  namaBerkas: string
  waktu: Date
}

export type EventCermin =
  | { jenis: 'pesan'; pesan: PesanCermin }
  | { jenis: 'hapus'; chatId: string; idPendek: string; dariSaya: boolean; waktu: Date }
  | { jenis: 'edit'; chatId: string; idPendek: string; dariSaya: boolean; isi: string; waktu: Date }
  | { jenis: 'abaikan'; alasan: string }

// Batas panjang supaya satu pesan raksasa tidak membengkakkan basis data.
export const MAKS_ISI = 4000
const MAKS_NAMA = 120

type O = Record<string, unknown>
const obj = (v: unknown): O | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as O) : null)
const teks = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
const potong = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s)

// ---- HMAC ----

// WAHA menghitung HMAC SHA-512 atas body mentah (JSON.stringify) lalu mengirim hasil hex di X-Webhook-Hmac.
// Kunci kosong berarti webhook belum dipasang: semua permintaan ditolak. Perbandingan memakai waktu konstan.
export function hmacCocok(bodyMentah: string, header: string | null | undefined, kunci: string | null | undefined): boolean {
  if (!kunci) return false
  const diterima = (header ?? '').trim().toLowerCase()
  if (!/^[0-9a-f]{128}$/.test(diterima)) return false
  const seharusnya = createHmac('sha512', kunci).update(bodyMentah, 'utf8').digest()
  return timingSafeEqual(seharusnya, Buffer.from(diterima, 'hex'))
}

export const hitungHmac = (bodyMentah: string, kunci: string) => createHmac('sha512', kunci).update(bodyMentah, 'utf8').digest('hex')

// ---- Id dan chat ----

// Chat yang tidak dicerminkan: status, siaran, dan saluran (newsletter).
export const chatDibuang = (chatId: string) => !chatId || chatId.startsWith('status@') || /@(newsletter|broadcast)$/.test(chatId)
export const chatGrup = (chatId: string) => chatId.endsWith('@g.us')

// "true_62812@c.us_3EB0ABC" -> { dariSaya: true, chatId: "62812@c.us", idPendek: "3EB0ABC" }.
// Format WAHA: {fromMe}_{chat}_{id}[_{peserta}]. Id tanpa garis bawah dianggap id pendek apa adanya.
export function urai(waId: string): { dariSaya: boolean | null; chatId: string; idPendek: string; peserta: string } {
  const m = /^(true|false)_([^_]+)_([^_]+)(?:_(.+))?$/.exec(waId)
  if (!m) return { dariSaya: null, chatId: '', idPendek: waId, peserta: '' }
  return { dariSaya: m[1] === 'true', chatId: m[2], idPendek: m[3], peserta: m[4] ?? '' }
}

// id bisa berupa teks (GOWS, NOWEB) atau objek { _serialized, id } (WEBJS).
const idDari = (v: unknown): string => {
  if (typeof v === 'string') return v
  const o = obj(v)
  return o ? teks(o._serialized) || teks(o.id) : ''
}

const keCus = (jid: string) => jid.replace(/@s\.whatsapp\.net$/, '@c.us')

// ---- Jenis pesan ----

// Membuka pembungkus pesan sekali lihat, pesan sementara, dan dokumen berketerangan.
function isiPesan(m: O | null): O | null {
  let cur = m
  for (let i = 0; i < 4 && cur; i++) {
    const bungkus = obj(cur.ephemeralMessage) ?? obj(cur.viewOnceMessage) ?? obj(cur.viewOnceMessageV2) ?? obj(cur.viewOnceMessageV2Extension) ?? obj(cur.documentWithCaptionMessage)
    const dalam = bungkus ? obj(bungkus.message) : null
    if (!dalam) break
    cur = dalam
  }
  return cur
}

const JENIS_PROTO: [string, JenisPesan][] = [
  ['stickerMessage', 'stiker'],
  ['imageMessage', 'gambar'],
  ['videoMessage', 'video'],
  ['ptvMessage', 'video'],
  ['audioMessage', 'suara'],
  ['documentMessage', 'dokumen'],
  ['locationMessage', 'lokasi'],
  ['liveLocationMessage', 'lokasi'],
  ['contactMessage', 'kontak'],
  ['contactsArrayMessage', 'kontak'],
]
const JENIS_TIPE: Record<string, JenisPesan> = {
  image: 'gambar',
  video: 'video',
  ptv: 'video',
  gif: 'video',
  audio: 'suara',
  ptt: 'suara',
  document: 'dokumen',
  sticker: 'stiker',
  location: 'lokasi',
  vcard: 'kontak',
  multi_vcard: 'kontak',
}
// Pesan yang bukan pesan percakapan: reaksi, suara polling, protokol (hapus, edit), distribusi kunci.
const PROTO_DIABAIKAN = ['protocolMessage', 'reactionMessage', 'pollUpdateMessage', 'encReactionMessage', 'encEventResponseMessage', 'keepInChatMessage', 'pinInChatMessage']
const TIPE_DIABAIKAN = new Set(['revoked', 'protocol', 'reaction', 'e2e_notification', 'notification_template', 'gp2', 'call_log', 'ciphertext', 'poll_vote'])

function jenisDari(p: O, proto: O | null, data: O | null, info: O | null): { jenis: JenisPesan; namaBerkas: string } {
  const media = obj(p.media)
  let jenis: JenisPesan | null = null
  let kunci = ''
  if (proto) for (const [k, j] of JENIS_PROTO) if (obj(proto[k])) { jenis = j; kunci = k; break }
  if (!jenis) jenis = JENIS_TIPE[teks(info?.MediaType)] ?? JENIS_TIPE[teks(data?.type)] ?? null
  if (!jenis && obj(p.location)) jenis = 'lokasi'
  if (!jenis && Array.isArray(p.vCards) && p.vCards.length) jenis = 'kontak'
  if (!jenis && (p.hasMedia === true || media)) {
    const mime = teks(media?.mimetype)
    jenis = mime.startsWith('image/webp') ? 'stiker' : mime.startsWith('image/') ? 'gambar' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'suara' : 'dokumen'
  }
  jenis ??= 'teks'
  const bagian = kunci ? obj(proto?.[kunci]) : null
  // Nama berkas hanya untuk dokumen. Untuk kontak dipakai nama tampilannya saja, isi vCard (nomor) tidak disimpan.
  const namaBerkas =
    jenis === 'dokumen' ? teks(media?.filename) || teks(bagian?.fileName) || teks(data?.filename) : jenis === 'kontak' ? teks(bagian?.displayName) : ''
  return { jenis, namaBerkas: potong(namaBerkas.trim(), 200) }
}

// Keterangan pesan. Untuk lokasi hanya nama tempatnya, koordinat tidak disimpan.
function isiDari(p: O, jenis: JenisPesan, bagianLokasi: O | null): string {
  if (jenis === 'lokasi') {
    const lok = obj(p.location)
    return teks(lok?.description) || teks(bagianLokasi?.name) || teks(bagianLokasi?.address)
  }
  if (jenis === 'kontak') return ''
  return teks(p.body) || teks(p.caption)
}

const waktuDari = (v: unknown, cadangan: Date): Date => {
  const n = typeof v === 'number' ? v : Number(teks(v))
  if (!Number.isFinite(n) || n <= 0) return cadangan
  return new Date(n > 1e12 ? n : n * 1000)
}

// Satu objek pesan WAHA (dari webhook atau dari GET .../messages) menjadi baris cermin. null = tidak dicerminkan.
export function bacaPesan(raw: unknown, sekarang = new Date()): PesanCermin | { abaikan: string } {
  const p = obj(raw)
  if (!p) return { abaikan: 'payload bukan objek' }
  const waId = idDari(p.id)
  if (!waId) return { abaikan: 'tanpa id' }
  const data = obj(p._data)
  const info = obj(data?.Info)
  const protoMentah = obj(data?.Message) ?? obj(data?.message)
  const proto = isiPesan(protoMentah)
  if (proto && PROTO_DIABAIKAN.some((k) => proto[k])) return { abaikan: 'pesan protokol' }
  if (TIPE_DIABAIKAN.has(teks(data?.type))) return { abaikan: 'pesan sistem' }

  const u = urai(waId)
  const dariSaya = typeof p.fromMe === 'boolean' ? p.fromMe : typeof info?.IsFromMe === 'boolean' ? info.IsFromMe : (u.dariSaya ?? false)
  const chatId = keCus(u.chatId || teks(info?.Chat) || (dariSaya ? teks(p.to) : teks(p.from)))
  if (!chatId) return { abaikan: 'chat tidak diketahui' }
  if (chatDibuang(chatId)) return { abaikan: 'status atau saluran' }
  const grup = chatGrup(chatId)

  const { jenis, namaBerkas } = jenisDari(p, proto, data, info)
  const bagianLokasi = proto ? (obj(proto.locationMessage) ?? obj(proto.liveLocationMessage)) : null
  const isi = potong(isiDari(p, jenis, bagianLokasi).trim(), MAKS_ISI)
  if (jenis === 'teks' && !isi) return { abaikan: 'pesan kosong' }

  const peserta = grup ? keCus(teks(p.participant) || u.peserta || teks(info?.Sender)) : ''
  const namaPengirim = potong((teks(info?.PushName) || teks(data?.notifyName) || teks(data?.pushName)).trim(), MAKS_NAMA)
  return {
    chatId,
    waId,
    idPendek: u.idPendek,
    dariSaya,
    grup,
    peserta,
    namaPengirim,
    isi,
    jenis,
    namaBerkas,
    waktu: waktuDari(p.timestamp, sekarang),
  }
}

export const adalahPesan = (x: PesanCermin | { abaikan: string }): x is PesanCermin => !('abaikan' in x)

// Chat dan arah dari pesan aksi (hapus atau edit).
function asalAksi(p: O | null): { chatId: string; dariSaya: boolean } {
  if (!p) return { chatId: '', dariSaya: false }
  const u = urai(idDari(p.id))
  const info = obj(obj(p._data)?.Info)
  const dariSaya = typeof p.fromMe === 'boolean' ? p.fromMe : (u.dariSaya ?? false)
  return { chatId: keCus(u.chatId || teks(info?.Chat) || (dariSaya ? teks(p.to) : teks(p.from))), dariSaya }
}

// Body webhook lengkap { event, session, payload } menjadi satu event cermin.
export function bacaEvent(raw: unknown, sekarang = new Date()): EventCermin {
  const b = obj(raw)
  if (!b) return { jenis: 'abaikan', alasan: 'body bukan objek' }
  const event = teks(b.event)
  const p = obj(b.payload)
  if (!p) return { jenis: 'abaikan', alasan: 'tanpa payload' }
  if (event === 'message.any' || event === 'message') {
    const m = bacaPesan(p, sekarang)
    return adalahPesan(m) ? { jenis: 'pesan', pesan: m } : { jenis: 'abaikan', alasan: m.abaikan }
  }
  if (event === 'message.revoked') {
    const after = obj(p.after)
    const before = obj(p.before)
    const idPendek = teks(p.revokedMessageId) || (before ? urai(idDari(before.id)).idPendek : '')
    if (!idPendek) return { jenis: 'abaikan', alasan: 'id pesan yang dihapus tidak ada' }
    const asal = asalAksi(after ?? before)
    if (asal.chatId && chatDibuang(asal.chatId)) return { jenis: 'abaikan', alasan: 'status atau saluran' }
    return { jenis: 'hapus', chatId: asal.chatId, idPendek, dariSaya: asal.dariSaya, waktu: waktuDari(after?.timestamp, sekarang) }
  }
  if (event === 'message.edited') {
    const idPendek = teks(p.editedMessageId)
    if (!idPendek) return { jenis: 'abaikan', alasan: 'id pesan yang diedit tidak ada' }
    const asal = asalAksi(p)
    if (asal.chatId && chatDibuang(asal.chatId)) return { jenis: 'abaikan', alasan: 'status atau saluran' }
    return { jenis: 'edit', chatId: asal.chatId, idPendek, dariSaya: asal.dariSaya, isi: potong(teks(p.body).trim(), MAKS_ISI), waktu: waktuDari(p.timestamp, sekarang) }
  }
  return { jenis: 'abaikan', alasan: `event ${event || '(kosong)'} tidak dipakai` }
}

// ---- Penanda pengirim ----

// Pesan masuk = pelanggan. Pesan keluar yang id-nya dicatat worker bot = bot. Pesan keluar lain = admin (HP atau WhatsApp Web).
export const penanda = (dariSaya: boolean, idPendek: string, idBot: ReadonlySet<string>): Pengirim => (!dariSaya ? 'pelanggan' : idBot.has(idPendek) ? 'bot' : 'admin')

// Id pendek dari jawaban sendText WAHA. GOWS: { id: "true_<chat>_<ID>", _data }. NOWEB: { key: { id } }. WEBJS: { id: { id, _serialized } }.
export function idDariKiriman(res: unknown): string {
  const r = obj(res)
  if (!r) return ''
  const id = idDari(r.id) || teks(obj(r.key)?.id) || idDari(obj(r._data)?.id)
  return id ? urai(id).idPendek : ''
}

// ---- Tampilan ----

// Cuplikan untuk daftar chat. Media tanpa keterangan ditulis jenisnya.
export function cuplikan(p: { isi: string; jenis: string; namaBerkas: string; dihapus?: boolean }, n = 90): string {
  if (p.dihapus) return 'Pesan dihapus'
  const label = p.jenis !== 'teks' ? (JENIS_LABEL[p.jenis as JenisPesan] ?? 'Media') : ''
  const isi = p.isi.replace(/\s+/g, ' ').trim() || p.namaBerkas
  const s = label ? (isi ? `${label}: ${isi}` : label) : isi
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

// "62812345678@c.us" -> "62812345678". Grup dan @lid ditampilkan tanpa akhiran.
export const nomorDari = (chatId: string) => chatId.replace(/@.*$/, '')

// Hak membuka cermin: owner saja. Dipakai halaman dan aksi di server.
export const bolehCermin = (role: string | null | undefined) => role === 'OWNER'

// Lama simpan (hari) dari Setting "cermin". Bawaan 180, batas 7 sampai 730.
export const RETENSI_BAWAAN = 180
export const retensiDari = (v: unknown): number => {
  const n = Math.round(Number(obj(v)?.hari))
  return Number.isFinite(n) && n >= 7 ? Math.min(n, 730) : RETENSI_BAWAAN
}
