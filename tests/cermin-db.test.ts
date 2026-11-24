// Tes cermin chat yang menyentuh database: penyimpanan idempoten, penanda bot, hapus dan edit, retensi,
// penarik riwayat, dan route webhook (HMAC). Basis data PostgreSQL sementara sendiri (tests/db-uji.ts).
// Semua nomor dan isi pesan karangan (contoh).
import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { siapkanDbUji } from './db-uji'
import { GRUP, KUNCI, LID, PEL, PEL_LID, pesanGows } from './cermin-contoh'
import { hitungHmac } from '../src/lib/cermin/baca'

let dbUji: Awaited<ReturnType<typeof siapkanDbUji>> | undefined

type Mod = {
  db: typeof import('../src/lib/db').db
  simpan: typeof import('../src/lib/cermin/simpan')
  baca: typeof import('../src/lib/cermin/baca')
  tarik: typeof import('../src/lib/cermin/tarik')
  lid: typeof import('../src/lib/cermin/lid')
  POST: typeof import('../src/app/api/waha/webhook/route').POST
}
let m: Mod

before(async () => {
  dbUji = await siapkanDbUji('cermin')
  const [{ db }, simpan, baca, tarik, route, lid] = await Promise.all([
    import('../src/lib/db'),
    import('../src/lib/cermin/simpan'),
    import('../src/lib/cermin/baca'),
    import('../src/lib/cermin/tarik'),
    import('../src/app/api/waha/webhook/route'),
    import('../src/lib/cermin/lid'),
  ])
  m = { db, simpan, baca, tarik, POST: route.POST, lid }
})

after(async () => {
  await m?.db.$disconnect()
  await dbUji?.hapus()
})

const kosongkan = async () => {
  await m.db.waPesan.deleteMany()
  await m.db.waChat.deleteMany()
  await m.db.waKirimBot.deleteMany()
  await m.db.waLid.deleteMany()
  m.lid.lupakanGagal()
}
const ev = (event: string, payload: unknown) => m.baca.bacaEvent({ event, session: 'default', payload })
const pesanDi = (chatId = PEL) => m.db.waPesan.findMany({ where: { chatId }, orderBy: { id: 'asc' } })

test('pesan yang sama dua kali (dan bersamaan) hanya satu baris', async () => {
  await kosongkan()
  const p = pesanGows({ id: 'DUP1', body: 'Ada ban 185/65R15?', pushName: 'Pelanggan Contoh' })
  await m.simpan.terapkanEvent(ev('message.any', p))
  await m.simpan.terapkanEvent(ev('message.any', p))
  await Promise.all([1, 2, 3, 4].map(() => m.simpan.terapkanEvent(ev('message.any', p))))
  const rows = await pesanDi()
  assert.equal(rows.length, 1)
  assert.equal(rows[0].pengirim, 'pelanggan')
  const chat = await m.db.waChat.findUniqueOrThrow({ where: { chatId: PEL } })
  assert.equal(chat.nama, 'Pelanggan Contoh')
  assert.equal(chat.pesanTerakhir, 'Ada ban 185/65R15?')
  assert.equal(chat.grup, false)
})

test('penanda bot: id dicatat sebelum webhook datang', async () => {
  await kosongkan()
  const id = await m.simpan.catatKirimBot({ id: `true_${PEL}_BOT1`, _data: null })
  assert.equal(id, 'BOT1')
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'BOT1', fromMe: true, body: 'Stok ada kak' })))
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'HP1', fromMe: true, body: 'Saya cek dulu ya' })))
  const rows = await pesanDi()
  assert.deepEqual(rows.map((r) => [r.idPendek, r.pengirim]), [['BOT1', 'bot'], ['HP1', 'admin']])
})

test('penanda bot: webhook datang lebih dulu, lalu worker mencatat id', async () => {
  await kosongkan()
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'BOT2', fromMe: true, body: 'Halo kak' })))
  assert.equal((await pesanDi())[0].pengirim, 'admin')
  await m.simpan.catatKirimBot({ id: `true_${PEL}_BOT2` })
  assert.equal((await pesanDi())[0].pengirim, 'bot')
  // Pesan masuk dengan id kebetulan sama tidak pernah menjadi bot.
  await m.simpan.catatKirimBot({ id: `true_${PEL}_IN9` })
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'IN9', body: 'masuk' })))
  assert.equal((await pesanDi()).find((r) => r.idPendek === 'IN9')?.pengirim, 'pelanggan')
  // Jawaban sendText tanpa id tidak mencatat apa pun.
  assert.equal(await m.simpan.catatKirimBot(null), '')
})

test('pesan dihapus tetap tersimpan dan ditandai; pesan diedit menyimpan isi terakhir', async () => {
  await kosongkan()
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'H1', body: 'pesan yang nanti dihapus', ts: 1_795_000_000 })))
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'E1', fromMe: true, body: 'harga 500rb', ts: 1_795_000_100 })))
  await m.simpan.terapkanEvent(ev('message.revoked', { after: pesanGows({ id: 'AKSI1', Message: { protocolMessage: { type: 0 } } }), before: null, revokedMessageId: 'H1' }))
  await m.simpan.terapkanEvent(ev('message.edited', { ...pesanGows({ id: 'AKSI2', fromMe: true, body: 'harga 450rb' }), editedMessageId: 'E1' }))
  const rows = await pesanDi()
  assert.equal(rows.length, 2)
  const h = rows.find((r) => r.idPendek === 'H1')!
  assert.equal(h.dihapus, true)
  assert.equal(h.isi, 'pesan yang nanti dihapus')
  const e = rows.find((r) => r.idPendek === 'E1')!
  assert.equal(e.diedit, true)
  assert.equal(e.isi, 'harga 450rb')
  // Pesan asli yang datang lagi (mis. dari tarik riwayat) tidak menimpa isi hasil edit atau tanda hapus.
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'E1', fromMe: true, body: 'harga 500rb', ts: 1_795_000_100 })))
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'H1', body: 'pesan yang nanti dihapus', ts: 1_795_000_000 })))
  const lagi = await pesanDi()
  assert.equal(lagi.length, 2)
  assert.equal(lagi.find((r) => r.idPendek === 'E1')!.isi, 'harga 450rb')
  assert.equal(lagi.find((r) => r.idPendek === 'H1')!.dihapus, true)
})

test('hapus dan edit yang datang sebelum pesan aslinya: baris sementara lalu dilengkapi', async () => {
  await kosongkan()
  await m.simpan.terapkanEvent(ev('message.edited', { ...pesanGows({ id: 'AKSI3', body: 'isi sesudah edit' }), editedMessageId: 'E2' }))
  await m.simpan.terapkanEvent(ev('message.revoked', { after: pesanGows({ id: 'AKSI4' }), before: null, revokedMessageId: 'H2' }))
  let rows = await pesanDi()
  assert.equal(rows.length, 2)
  assert.ok(rows.every((r) => r.sementara))
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'E2', body: 'isi sebelum edit', pushName: 'Pelanggan Contoh' })))
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'H2', body: 'isi asli', ts: 1_795_000_500 })))
  rows = await pesanDi()
  assert.equal(rows.length, 2)
  const e = rows.find((r) => r.idPendek === 'E2')!
  assert.deepEqual([e.sementara, e.diedit, e.isi, e.namaPengirim], [false, true, 'isi sesudah edit', 'Pelanggan Contoh'])
  const h = rows.find((r) => r.idPendek === 'H2')!
  assert.deepEqual([h.sementara, h.dihapus, h.isi, h.waktu.getTime()], [false, true, 'isi asli', 1_795_000_500_000])
  assert.equal((await m.db.waChat.findUniqueOrThrow({ where: { chatId: PEL } })).pesanTerakhir, 'Pesan dihapus')
})

test('status dan saluran tidak disimpan, grup disimpan dengan tanda grup', async () => {
  await kosongkan()
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'ST1', chat: 'status@broadcast', body: 'status contoh' })))
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'NW1', chat: '120363000000000009@newsletter', body: 'kabar saluran' })))
  await m.simpan.terapkanEvent(ev('message.revoked', { after: pesanGows({ id: 'AKSI5', chat: 'status@broadcast' }), revokedMessageId: 'ST1' }))
  assert.equal(await m.db.waPesan.count(), 0)
  assert.equal(await m.db.waChat.count(), 0)
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'GR1', chat: GRUP, participant: '6280000000002@c.us', body: 'di grup', pushName: 'Anggota Contoh' })))
  const chat = await m.db.waChat.findUniqueOrThrow({ where: { chatId: GRUP } })
  assert.equal(chat.grup, true)
  assert.equal(chat.nama, '', 'nama grup tidak diambil dari nama pengirim')
  assert.equal((await pesanDi(GRUP))[0].peserta, '6280000000002@c.us')
})

test('retensi: pesan lebih tua dari batas dihapus, chat kosong ikut hilang', async () => {
  await kosongkan()
  const sekarang = new Date('2026-11-24T00:00:00Z')
  const detik = (hariLalu: number) => Math.floor((sekarang.getTime() - hariLalu * 86400_000) / 1000)
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'T1', body: 'lama sekali', ts: detik(200) })))
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'T2', body: 'baru', ts: detik(10) })))
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'T3', chat: '6280000000004@c.us', body: 'chat lama', ts: detik(181) })))
  await m.db.waLid.create({ data: { lid: LID, pn: PEL_LID } })
  await m.db.$executeRaw`UPDATE "wa_lid" SET "diperbarui" = ${new Date(sekarang.getTime() - 200 * 86400_000)}`
  const h = await m.simpan.bersihkan(180, sekarang)
  assert.equal(h.pesan, 2)
  assert.equal(await m.db.waLid.count(), 0, 'pemetaan LID ikut lama simpan')
  assert.deepEqual((await m.db.waPesan.findMany()).map((r) => r.idPendek), ['T2'])
  assert.deepEqual((await m.db.waChat.findMany()).map((r) => r.chatId), [PEL])
  // Lama simpan dibaca dari Setting "cermin", bawaan 180.
  assert.equal(await m.simpan.bacaRetensi(), 180)
  await m.db.setting.upsert({ where: { key: 'cermin' }, create: { key: 'cermin', value: '{"hari":30}' }, update: { value: '{"hari":30}' } })
  assert.equal(await m.simpan.bacaRetensi(), 30)
  await m.db.setting.update({ where: { key: 'cermin' }, data: { value: 'rusak' } })
  assert.equal(await m.simpan.bacaRetensi(), 180)
})

test('tarik riwayat: idempoten, terbatas, dan melewati status serta chat yang gagal dibaca', async () => {
  await kosongkan()
  const dipanggil: string[] = []
  const ambil = async (path: string) => {
    dipanggil.push(path)
    if (path.includes('/chats/overview')) return [{ id: PEL, name: 'Kontak Contoh' }, { id: 'status@broadcast', name: 'Status' }, { id: GRUP, name: 'Grup Contoh' }, { id: '6280000000005@c.us', name: 'Rusak' }]
    if (path.includes(encodeURIComponent('6280000000005@c.us'))) throw new Error('WAHA 500')
    if (path.includes(encodeURIComponent(GRUP))) return [pesanGows({ id: 'TG1', chat: GRUP, participant: '6280000000002@c.us', body: 'halo grup' })]
    return [pesanGows({ id: 'TR1', body: 'satu' }), pesanGows({ id: 'TR2', fromMe: true, body: 'dua' }), pesanGows({ id: 'TR3', body: 'tiga' })]
  }
  const h1 = await m.tarik.tarikRiwayat({ ambil, session: 'default', maksPesan: 2 })
  assert.deepEqual(h1, { chat: 2, pesan: 3, baru: 3, gagal: 1, lid: 0 })
  assert.ok(dipanggil[0].startsWith('/api/default/chats/overview?limit=30'))
  assert.ok(dipanggil.every((p) => !p.includes('status')))
  assert.ok(dipanggil.filter((p) => p.includes('/messages')).every((p) => p.includes('limit=2') && p.includes('downloadMedia=false')))
  const h2 = await m.tarik.tarikRiwayat({ ambil, session: 'default', maksPesan: 2 })
  assert.equal(h2.baru, 0)
  assert.equal(await m.db.waPesan.count(), 3)
  assert.equal((await m.db.waChat.findUniqueOrThrow({ where: { chatId: PEL } })).nama, 'Kontak Contoh')
  assert.equal((await m.db.waChat.findUniqueOrThrow({ where: { chatId: GRUP } })).nama, 'Grup Contoh')
  // Pesan yang datang lewat webhook lalu ditarik lagi tetap satu.
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'TR1', body: 'satu' })))
  assert.equal(await m.db.waPesan.count(), 3)
})

// ---- LID ----

const ALT = '6280000000031@s.whatsapp.net'

test('LID: nomor dari payload dipakai, pemetaan disimpan, WAHA tidak ditanya', async () => {
  await kosongkan()
  let ditanya = 0
  const cari = async () => (ditanya++, PEL_LID)
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'LA1', chat: LID, body: 'Ada ban ring 14?', alt: ALT, pushName: 'Pelanggan LID' })), cari)
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'LA2', chat: LID, fromMe: true, body: 'Ada kak', alt: ALT })), cari)
  assert.equal(ditanya, 0)
  assert.deepEqual((await m.db.waPesan.findMany({ orderBy: { id: 'asc' } })).map((r) => [r.chatId, r.idPendek, r.pengirim]), [[PEL_LID, 'LA1', 'pelanggan'], [PEL_LID, 'LA2', 'admin']])
  assert.deepEqual((await m.db.waChat.findMany()).map((c) => [c.chatId, c.nama]), [[PEL_LID, 'Pelanggan LID']])
  assert.deepEqual((await m.db.waLid.findMany()).map((r) => [r.lid, r.pn]), [[LID, PEL_LID]])
  // Pesan berikutnya tanpa nomor di payload memakai tabel wa_lid.
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'LA3', chat: LID, body: 'tanpa alt' })), cari)
  assert.equal(ditanya, 0)
  assert.equal((await m.db.waPesan.findFirstOrThrow({ where: { idPendek: 'LA3' } })).chatId, PEL_LID)
  // Tarik riwayat dari chat bernomor dengan pesan yang sama tidak menggandakan.
  const ambil = async (path: string) => (path.includes('/overview') ? [{ id: PEL_LID, name: 'Kontak LID' }] : path.includes('/lids') ? [] : [pesanGows({ id: 'LA1', chat: LID, body: 'Ada ban ring 14?' }), pesanGows({ id: 'LA4', chat: LID, body: 'pesan lama' })])
  const h = await m.tarik.tarikRiwayat({ ambil, session: 'default', cari })
  assert.equal(h.baru, 1)
  assert.equal(await m.db.waPesan.count(), 4)
  assert.equal(await m.db.waPesan.count({ where: { chatId: LID } }), 0)
})

test('LID: nomor dicari lewat WAHA sekali, lalu dari tabel', async () => {
  await kosongkan()
  const ditanya: string[] = []
  const cari = async (lid: string) => (ditanya.push(lid), PEL_LID)
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'LB1', chat: LID, body: 'satu' })), cari)
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'LB2', chat: LID, body: 'dua' })), cari)
  assert.deepEqual(ditanya, [LID])
  assert.equal(await m.db.waPesan.count({ where: { chatId: PEL_LID } }), 2)
})

test('LID: gagal dipetakan tetap disimpan dengan id LID, WAHA tidak ditanya ulang dalam 10 menit', async () => {
  await kosongkan()
  let ditanya = 0
  const rusak = async () => {
    ditanya++
    throw new Error('WAHA 500')
  }
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'LC1', chat: LID, body: 'satu' })), rusak)
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'LC2', chat: LID, body: 'dua' })), rusak)
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'LC3', chat: LID, body: 'tiga' })), async () => (ditanya++, ''))
  assert.equal(ditanya, 1)
  assert.equal(await m.db.waPesan.count({ where: { chatId: LID } }), 3)
  assert.equal((await m.db.waChat.findUniqueOrThrow({ where: { chatId: LID } })).grup, false)
  // Tanpa pencari sama sekali juga tetap tersimpan.
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'LC4', chat: LID, body: 'empat' })))
  assert.equal(await m.db.waPesan.count({ where: { chatId: LID } }), 4)
})

test('LID: chat lama digabung ke nomor begitu pemetaan diketahui, tanpa baris ganda', async () => {
  await kosongkan()
  // Keadaan seperti produksi sebelum perbaikan: chat LID dari webhook, chat bernomor dari tarik riwayat, sebagian pesan sama.
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'LD1', chat: LID, body: 'harga 500rb', ts: 1_795_000_000, pushName: 'Pelanggan LID' })))
  await m.simpan.terapkanEvent(ev('message.edited', { ...pesanGows({ id: 'AKSI1', chat: LID, body: 'harga 450rb' }), editedMessageId: 'LD1' }))
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'LD2', chat: LID, body: 'salah kirim', ts: 1_795_000_100 })))
  await m.simpan.terapkanEvent(ev('message.revoked', { after: pesanGows({ id: 'AKSI2', chat: LID }), revokedMessageId: 'LD2' }))
  await m.simpan.terapkanEvent(ev('message.revoked', { after: pesanGows({ id: 'AKSI3', chat: LID }), revokedMessageId: 'LD9' })) // baris sementara
  await m.db.waChat.update({ where: { chatId: LID }, data: { dilihat: new Date('2026-11-20T00:00:00Z') } })
  await m.simpan.simpanPesan([pesanGows({ id: 'LD1', body: 'harga 500rb', ts: 1_795_000_000 }), pesanGows({ id: 'LD3', body: 'pesan lain', ts: 1_795_000_200 })].map((p) => m.baca.bacaPesan({ ...p, id: p.id.replace(PEL, PEL_LID), from: PEL_LID, _data: { ...p._data, Info: { ...p._data.Info, Chat: PEL_LID } } })).filter(m.baca.adalahPesan), new Map([[PEL_LID, 'Kontak LID']]))
  assert.equal(await m.db.waChat.count(), 2)
  // Pesan baru dengan nomor di payload memicu penggabungan.
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'LD4', chat: LID, body: 'masih ada?', ts: 1_795_000_300, alt: ALT })))
  assert.deepEqual((await m.db.waChat.findMany()).map((c) => [c.chatId, c.nama, c.pesanTerakhir, c.dilihat?.toISOString()]), [[PEL_LID, 'Kontak LID', 'masih ada?', '2026-11-20T00:00:00.000Z']])
  const rows = await m.db.waPesan.findMany({ orderBy: { idPendek: 'asc' } })
  assert.deepEqual(rows.map((r) => [r.chatId, r.idPendek]), [[PEL_LID, 'LD1'], [PEL_LID, 'LD2'], [PEL_LID, 'LD3'], [PEL_LID, 'LD4'], [PEL_LID, 'LD9']])
  const ld1 = rows.find((r) => r.idPendek === 'LD1')!
  assert.deepEqual([ld1.diedit, ld1.isi, ld1.namaPengirim], [true, 'harga 450rb', 'Pelanggan LID'])
  assert.equal(rows.find((r) => r.idPendek === 'LD2')!.dihapus, true)
  assert.equal(rows.find((r) => r.idPendek === 'LD9')!.sementara, true)
  // Fungsi gabung aman diulang.
  assert.deepEqual(await m.lid.gabungLid(LID, PEL_LID), { pindah: 0, ganda: 0 })
  assert.equal(await m.db.waPesan.count(), 5)
})

test('LID: tarik riwayat menggabungkan chat LID lama lewat daftar lids WAHA, sisanya lewat pencarian', async () => {
  await kosongkan()
  const LID2 = '100000000000002@lid'
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'LE1', chat: LID, body: 'lama satu' })))
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'LE2', chat: LID2, body: 'lama dua' })))
  await m.simpan.terapkanEvent(ev('message.any', pesanGows({ id: 'LE3', chat: '100000000000003@lid', body: 'tak dikenal' })))
  assert.equal(await m.db.waChat.count({ where: { chatId: { endsWith: '@lid' } } }), 3)
  const dicari: string[] = []
  const ambil = async (path: string) => (path.includes('/overview') ? [] : path.startsWith('/api/default/lids?') ? [{ lid: LID, pn: PEL_LID }, { lid: '100000000000009@lid', pn: '6280000000039@c.us' }] : [])
  const cari = async (lid: string) => (dicari.push(lid), lid === LID2 ? '6280000000032@c.us' : '')
  const h = await m.tarik.tarikRiwayat({ ambil, session: 'default', cari })
  assert.equal(h.lid, 2)
  assert.deepEqual(dicari.sort(), [LID2, '100000000000003@lid'].sort())
  assert.deepEqual((await m.db.waChat.findMany({ orderBy: { chatId: 'asc' } })).map((c) => c.chatId), ['100000000000003@lid', PEL_LID, '6280000000032@c.us'])
  assert.equal(await m.db.waLid.count(), 2, 'pemetaan yang tidak dipakai chat mana pun tidak disimpan')
})

// ---- Route webhook ----

const kirim = (body: string, hmac?: string | null) =>
  m.POST(new Request('http://localhost/api/waha/webhook', { method: 'POST', headers: { 'content-type': 'application/json', ...(hmac ? { 'x-webhook-hmac': hmac } : {}) }, body }))

test('route: 401 tanpa HMAC atau HMAC salah, tanpa menyimpan apa pun', async () => {
  await kosongkan()
  process.env.WAHA_WEBHOOK_HMAC = KUNCI
  process.env.WAHA_SESSION = 'default'
  const body = JSON.stringify({ event: 'message.any', session: 'default', payload: pesanGows({ id: 'RT1', body: 'dari internet' }) })
  assert.equal((await kirim(body)).status, 401)
  assert.equal((await kirim(body, hitungHmac(body, 'kunci-lain'))).status, 401)
  assert.equal((await kirim(body, 'x'.repeat(128))).status, 401)
  assert.equal((await kirim(body + ' ', hitungHmac(body, KUNCI))).status, 401)
  assert.equal(await m.db.waPesan.count(), 0)
  // Kunci env kosong: semua ditolak, termasuk yang membawa HMAC.
  process.env.WAHA_WEBHOOK_HMAC = ''
  assert.equal((await kirim(body, hitungHmac(body, ''))).status, 401)
  delete process.env.WAHA_WEBHOOK_HMAC
  assert.equal((await kirim(body, hitungHmac(body, KUNCI))).status, 401)
  assert.equal(await m.db.waPesan.count(), 0)
  assert.equal(await m.db.waChat.count(), 0)
})

test('route: 200 dengan HMAC benar dan pesan tersimpan sekali', async () => {
  await kosongkan()
  process.env.WAHA_WEBHOOK_HMAC = KUNCI
  process.env.WAHA_SESSION = 'default'
  const body = JSON.stringify({ event: 'message.any', session: 'default', payload: pesanGows({ id: 'RT2', body: 'Ada velg ring 15?' }) })
  const r1 = await kirim(body, hitungHmac(body, KUNCI))
  assert.equal(r1.status, 200)
  assert.deepEqual(await r1.json(), { ok: true, simpan: true })
  assert.equal((await kirim(body, hitungHmac(body, KUNCI))).status, 200)
  assert.equal(await m.db.waPesan.count(), 1)
  // Event lain dan sesi lain dijawab 200 tanpa menyimpan, supaya WAHA tidak mengulang.
  const lain = JSON.stringify({ event: 'session.status', session: 'default', payload: { status: 'WORKING' } })
  assert.deepEqual(await (await kirim(lain, hitungHmac(lain, KUNCI))).json(), { ok: true, simpan: false })
  const sesiLain = JSON.stringify({ event: 'message.any', session: 'sesi-lain', payload: pesanGows({ id: 'RT3', body: 'x' }) })
  assert.equal((await kirim(sesiLain, hitungHmac(sesiLain, KUNCI))).status, 200)
  assert.equal(await m.db.waPesan.count(), 1)
  // Body bukan JSON dengan HMAC benar: 400.
  assert.equal((await kirim('bukan json', hitungHmac('bukan json', KUNCI))).status, 400)
  // Body terlalu besar ditolak sebelum HMAC dihitung.
  const besar = 'x'.repeat(1_000_001)
  assert.equal((await kirim(besar, hitungHmac(besar, KUNCI))).status, 413)
})

test('route: chat LID saat WAHA tidak bisa dihubungi tetap 200 dan tersimpan dengan id LID', async () => {
  await kosongkan()
  process.env.WAHA_WEBHOOK_HMAC = KUNCI
  process.env.WAHA_SESSION = 'default'
  process.env.WAHA_URL = 'http://127.0.0.1:9'
  process.env.WAHA_API_KEY = 'kunci-uji'
  try {
    const body = JSON.stringify({ event: 'message.any', session: 'default', payload: pesanGows({ id: 'RL1', chat: LID, body: 'halo' }) })
    const r = await kirim(body, hitungHmac(body, KUNCI))
    assert.equal(r.status, 200)
    assert.equal((await m.db.waPesan.findFirstOrThrow({ where: { idPendek: 'RL1' } })).chatId, LID)
    // Dengan nomor di payload, pesan berikutnya masuk ke nomor dan chat LID tadi ikut digabung.
    const body2 = JSON.stringify({ event: 'message.any', session: 'default', payload: pesanGows({ id: 'RL2', chat: LID, body: 'lagi', alt: ALT }) })
    assert.equal((await kirim(body2, hitungHmac(body2, KUNCI))).status, 200)
    assert.deepEqual((await m.db.waPesan.findMany({ orderBy: { id: 'asc' } })).map((r) => r.chatId), [PEL_LID, PEL_LID])
  } finally {
    delete process.env.WAHA_URL
    delete process.env.WAHA_API_KEY
  }
})
