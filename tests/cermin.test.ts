// Tes murni cermin chat: pembaca payload WAHA, HMAC, penanda pengirim, dan aturan tampil.
// Semua nomor dan isi pesan karangan (contoh), bukan data toko.
import test from 'node:test'
import assert from 'node:assert/strict'
import { adalahPesan, bacaEvent, bacaPesan, bolehCermin, chatDibuang, cuplikan, hitungHmac, hmacCocok, idDariKiriman, penanda, retensiDari, urai } from '../src/lib/cermin/baca'

import { GRUP, KUNCI, PEL, pesanGows } from './cermin-contoh'

test('pesan teks masuk dibaca lengkap', () => {
  const p = bacaPesan(pesanGows({ id: 'AAA111', body: 'Ada ban 185/65R15?', pushName: 'Pelanggan Contoh' }))
  assert.ok(adalahPesan(p))
  assert.equal(p.chatId, PEL)
  assert.equal(p.idPendek, 'AAA111')
  assert.equal(p.waId, `false_${PEL}_AAA111`)
  assert.equal(p.dariSaya, false)
  assert.equal(p.grup, false)
  assert.equal(p.isi, 'Ada ban 185/65R15?')
  assert.equal(p.jenis, 'teks')
  assert.equal(p.namaPengirim, 'Pelanggan Contoh')
  assert.equal(p.waktu.toISOString(), new Date(1_795_000_000 * 1000).toISOString())
})

test('field hilang tidak membuat galat', () => {
  for (const raw of [null, undefined, 'teks', 12, [], {}, { id: '' }, { id: {} }, { id: 'xyz' }, { id: 'false_@c.us_' }]) {
    assert.doesNotThrow(() => bacaPesan(raw))
    assert.equal(adalahPesan(bacaPesan(raw)), false, JSON.stringify(raw))
  }
  // Hanya id dan body: chat diambil dari id.
  const p = bacaPesan({ id: `true_${PEL}_BBB222`, body: 'halo' })
  assert.ok(adalahPesan(p))
  assert.equal(p.chatId, PEL)
  assert.equal(p.dariSaya, true)
  // Tanpa timestamp: waktu sekarang.
  const sekarang = new Date('2026-11-24T03:00:00Z')
  const q = bacaPesan({ id: `false_${PEL}_C1`, body: 'x' }, sekarang)
  assert.ok(adalahPesan(q) && q.waktu.getTime() === sekarang.getTime())
  // Id gaya WEBJS (objek) dan timestamp milidetik.
  const w = bacaPesan({ id: { _serialized: `false_${PEL}_W1`, id: 'W1' }, timestamp: 1_795_000_000_123, body: 'y', from: PEL, fromMe: false })
  assert.ok(adalahPesan(w) && w.idPendek === 'W1' && w.waktu.getTime() === 1_795_000_000_123)
  assert.equal(bacaEvent(null).jenis, 'abaikan')
  assert.equal(bacaEvent({ event: 'message.any' }).jenis, 'abaikan')
  assert.equal(bacaEvent({ event: 'session.status', payload: {} }).jenis, 'abaikan')
})

test('status, siaran, dan saluran dibuang; grup dicatat dengan tanda grup', () => {
  assert.ok(chatDibuang('status@broadcast'))
  assert.ok(chatDibuang('120363000000000009@newsletter'))
  assert.ok(chatDibuang('1234@broadcast'))
  assert.ok(!chatDibuang(PEL))
  assert.equal(adalahPesan(bacaPesan(pesanGows({ id: 'S1', chat: 'status@broadcast', body: 'status' }))), false)
  assert.equal(adalahPesan(bacaPesan(pesanGows({ id: 'N1', chat: '120363000000000009@newsletter', body: 'kabar' }))), false)
  assert.equal(bacaEvent({ event: 'message.any', payload: pesanGows({ id: 'S2', chat: 'status@broadcast', body: 'x' }) }).jenis, 'abaikan')
  const g = bacaPesan(pesanGows({ id: 'G1', chat: GRUP, participant: '6280000000002@c.us', body: 'di grup', pushName: 'Anggota Contoh' }))
  assert.ok(adalahPesan(g))
  assert.equal(g.grup, true)
  assert.equal(g.chatId, GRUP)
  assert.equal(g.idPendek, 'G1')
  assert.equal(g.peserta, '6280000000002@c.us')
})

test('media: hanya jenis, nama berkas, dan keterangan; koordinat dan vCard tidak disimpan', () => {
  const gambar = bacaPesan(pesanGows({ id: 'M1', body: 'foto ban', hasMedia: true, Message: { imageMessage: { caption: 'foto ban', mimetype: 'image/jpeg' } } }))
  assert.ok(adalahPesan(gambar) && gambar.jenis === 'gambar' && gambar.isi === 'foto ban')
  const dok = bacaPesan(pesanGows({ id: 'M2', hasMedia: true, Message: { documentWithCaptionMessage: { message: { documentMessage: { fileName: 'penawaran-contoh.pdf', caption: '' } } } } }))
  assert.ok(adalahPesan(dok) && dok.jenis === 'dokumen' && dok.namaBerkas === 'penawaran-contoh.pdf')
  const suara = bacaPesan(pesanGows({ id: 'M3', hasMedia: true, Message: { audioMessage: { ptt: true } } }))
  assert.ok(adalahPesan(suara) && suara.jenis === 'suara' && suara.isi === '')
  const stiker = bacaPesan(pesanGows({ id: 'M4', hasMedia: true, Message: { stickerMessage: {} } }))
  assert.ok(adalahPesan(stiker) && stiker.jenis === 'stiker')
  const video = bacaPesan(pesanGows({ id: 'M5', hasMedia: true, Message: { viewOnceMessageV2: { message: { videoMessage: { caption: 'sekali lihat' } } } }, body: 'sekali lihat' }))
  assert.ok(adalahPesan(video) && video.jenis === 'video')
  const lokasi = bacaPesan({ ...pesanGows({ id: 'M6', body: '-7.1,112.1', Message: { locationMessage: { degreesLatitude: -7.1, degreesLongitude: 112.1, name: 'Toko Contoh' } } }), location: { latitude: -7.1, longitude: 112.1, description: 'Toko Contoh' } })
  assert.ok(adalahPesan(lokasi) && lokasi.jenis === 'lokasi' && lokasi.isi === 'Toko Contoh')
  const kontak = bacaPesan({ ...pesanGows({ id: 'M7', Message: { contactMessage: { displayName: 'Kontak Contoh', vcard: 'BEGIN:VCARD\nTEL:+6280000000003\nEND:VCARD' } } }), vCards: ['BEGIN:VCARD'] })
  assert.ok(adalahPesan(kontak) && kontak.jenis === 'kontak' && kontak.isi === '' && kontak.namaBerkas === 'Kontak Contoh')
  assert.ok(!JSON.stringify(kontak).includes('6280000000003'))
  // Engine tanpa _data.Message: dari mimetype media.
  const lain = bacaPesan({ id: `false_${PEL}_M8`, fromMe: false, hasMedia: true, media: { mimetype: 'application/pdf', filename: 'nota-contoh.pdf', url: 'http://waha/berkas' } })
  assert.ok(adalahPesan(lain) && lain.jenis === 'dokumen' && lain.namaBerkas === 'nota-contoh.pdf')
  assert.ok(!JSON.stringify(lain).includes('http://waha/berkas'))
})

test('reaksi, protokol, dan pesan kosong tidak dicerminkan', () => {
  assert.equal(adalahPesan(bacaPesan(pesanGows({ id: 'R1', Message: { reactionMessage: { text: 'x' } } }))), false)
  assert.equal(adalahPesan(bacaPesan(pesanGows({ id: 'R2', Message: { protocolMessage: { type: 0 } } }))), false)
  assert.equal(adalahPesan(bacaPesan(pesanGows({ id: 'R3', body: '   ' }))), false)
  assert.equal(adalahPesan(bacaPesan(pesanGows({ id: 'R4', Message: { senderKeyDistributionMessage: {} } }))), false)
})

test('isi panjang dipotong', () => {
  const p = bacaPesan(pesanGows({ id: 'L1', body: 'a'.repeat(10_000) }))
  assert.ok(adalahPesan(p) && p.isi.length === 4000)
})

test('event message.revoked dan message.edited', () => {
  const hapus = bacaEvent({ event: 'message.revoked', session: 'default', payload: { after: pesanGows({ id: 'AKSI1', fromMe: false, Message: { protocolMessage: { type: 0, key: { ID: 'AAA111' } } } }), before: null, revokedMessageId: 'AAA111' } })
  assert.equal(hapus.jenis, 'hapus')
  assert.ok(hapus.jenis === 'hapus' && hapus.chatId === PEL && hapus.idPendek === 'AAA111' && hapus.dariSaya === false)
  const edit = bacaEvent({ event: 'message.edited', payload: { ...pesanGows({ id: 'AKSI2', fromMe: true, body: 'isi baru' }), editedMessageId: 'OUT1' } })
  assert.ok(edit.jenis === 'edit' && edit.chatId === PEL && edit.idPendek === 'OUT1' && edit.isi === 'isi baru' && edit.dariSaya === true)
  assert.equal(bacaEvent({ event: 'message.revoked', payload: { after: null } }).jenis, 'abaikan')
  assert.equal(bacaEvent({ event: 'message.edited', payload: { body: 'x' } }).jenis, 'abaikan')
  // Tanpa pesan "after": id dari "before".
  const lama = bacaEvent({ event: 'message.revoked', payload: { before: { id: `false_${PEL}_BEF1`, fromMe: false }, revokedMessageId: '' } })
  assert.ok(lama.jenis === 'hapus' && lama.idPendek === 'BEF1' && lama.chatId === PEL)
})

test('HMAC: cocok, salah, kosong, dan kunci env kosong', () => {
  const body = JSON.stringify({ event: 'message.any', payload: { id: 'x' } })
  const benar = hitungHmac(body, KUNCI)
  assert.equal(benar.length, 128)
  assert.ok(hmacCocok(body, benar, KUNCI))
  assert.ok(hmacCocok(body, benar.toUpperCase(), KUNCI))
  assert.ok(!hmacCocok(body + ' ', benar, KUNCI), 'body berubah')
  assert.ok(!hmacCocok(body, hitungHmac(body, 'kunci-lain'), KUNCI), 'kunci lain')
  assert.ok(!hmacCocok(body, benar.slice(0, 127) + (benar[127] === '0' ? '1' : '0'), KUNCI), 'satu digit beda')
  assert.ok(!hmacCocok(body, '', KUNCI))
  assert.ok(!hmacCocok(body, null, KUNCI))
  assert.ok(!hmacCocok(body, 'bukan-hex', KUNCI))
  assert.ok(!hmacCocok(body, benar.slice(0, 64), KUNCI), 'panjang salah')
  assert.ok(!hmacCocok(body, benar, ''), 'kunci env kosong menolak semua')
  assert.ok(!hmacCocok(body, benar, undefined))
})

test('penanda pengirim: pelanggan, bot, admin', () => {
  const bot = new Set(['OUT1'])
  assert.equal(penanda(false, 'OUT1', bot), 'pelanggan')
  assert.equal(penanda(true, 'OUT1', bot), 'bot')
  assert.equal(penanda(true, 'OUT2', bot), 'admin')
})

test('id dari jawaban sendText berbagai engine', () => {
  assert.equal(idDariKiriman({ id: `true_${PEL}_3EB0C0FFEE`, _data: null }), '3EB0C0FFEE')
  assert.equal(idDariKiriman({ key: { id: 'NOWEB1', fromMe: true } }), 'NOWEB1')
  assert.equal(idDariKiriman({ id: { _serialized: `true_${PEL}_WEB1`, id: 'WEB1' } }), 'WEB1')
  assert.equal(idDariKiriman(null), '')
  assert.equal(idDariKiriman({}), '')
  assert.deepEqual(urai(`false_${GRUP}_G9_6280000000002@c.us`), { dariSaya: false, chatId: GRUP, idPendek: 'G9', peserta: '6280000000002@c.us' })
})

test('cuplikan, hak akses, dan lama simpan', () => {
  assert.equal(cuplikan({ isi: 'halo  kak\nada?', jenis: 'teks', namaBerkas: '' }), 'halo kak ada?')
  assert.equal(cuplikan({ isi: '', jenis: 'gambar', namaBerkas: '' }), 'Gambar')
  assert.equal(cuplikan({ isi: '', jenis: 'dokumen', namaBerkas: 'a.pdf' }), 'Dokumen: a.pdf')
  assert.equal(cuplikan({ isi: 'x', jenis: 'teks', namaBerkas: '', dihapus: true }), 'Pesan dihapus')
  assert.equal(cuplikan({ isi: 'a'.repeat(200), jenis: 'teks', namaBerkas: '' }).length, 90)
  assert.equal(bolehCermin('OWNER'), true)
  assert.equal(bolehCermin('BRANCH_ADMIN'), false)
  assert.equal(bolehCermin(undefined), false)
  assert.equal(retensiDari(null), 180)
  assert.equal(retensiDari({ hari: 30 }), 30)
  assert.equal(retensiDari({ hari: 3 }), 180)
  assert.equal(retensiDari({ hari: 5000 }), 730)
  assert.equal(retensiDari({ hari: 'x' }), 180)
})
