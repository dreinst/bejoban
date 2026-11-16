// Pembentuk permintaan label WhatsApp (WAHA). Murni, tidak memanggil WAHA. Id dan nomor karangan.
import test from 'node:test'
import assert from 'node:assert/strict'
import { cariLabel, labelBaruChat, mintaBuatLabel, mintaDaftarLabel, mintaLabelChat, mintaPasangLabel, rencanaLabelKering } from '../src/lib/bot/label'

const CHAT = '6285700000000@c.us'

test('path endpoint label sesuai dokumentasi WAHA', () => {
  assert.deepEqual(mintaDaftarLabel('bejo ban'), { method: 'GET', path: '/api/bejo%20ban/labels', ket: 'daftar label' })
  assert.deepEqual(mintaBuatLabel('s1', 'Batu', 'batu'), { method: 'POST', path: '/api/s1/labels', body: { name: 'Batu', color: 1 }, ket: 'buat label "Batu"' })
  assert.equal(mintaBuatLabel('s1', 'Lain', 'lain').body && (mintaBuatLabel('s1', 'Lain', 'lain').body as { color: number }).color, 4)
  assert.equal(mintaLabelChat('s1', CHAT).path, '/api/s1/labels/chats/6285700000000%40c.us/')
  const put = mintaPasangLabel('s1', CHAT, [{ id: '7' }], 'Batu')
  assert.deepEqual([put.method, put.path, put.body], ['PUT', '/api/s1/labels/chats/6285700000000%40c.us/', { labels: [{ id: '7' }] }])
})

test('label dicari menurut nama tanpa beda huruf besar kecil', () => {
  const labels = [{ id: '1', name: 'Pelanggan baru' }, { id: '7', name: ' batu ' }]
  assert.equal(cariLabel(labels, 'Batu')?.id, '7')
  assert.equal(cariLabel(labels, 'Karanglo'), null)
})

test('label chat: label admin lain dipertahankan, label cabang lain dilepas, tidak dobel', () => {
  const admin = { id: '1', name: 'Pelanggan baru' }
  const batu = { id: '7', name: 'Batu' }
  const krg = { id: '8', name: 'Karanglo' }
  assert.deepEqual(labelBaruChat([admin], '7', ['8']), [{ id: '1' }, { id: '7' }])
  assert.deepEqual(labelBaruChat([admin, krg], '7', ['8']), [{ id: '1' }, { id: '7' }])
  assert.equal(labelBaruChat([admin, batu], '7', ['8']), null, 'sudah terpasang: tidak perlu PUT')
  assert.deepEqual(labelBaruChat([batu, krg], '7', ['8']), [{ id: '7' }])
  assert.deepEqual(labelBaruChat([], '7', []), [{ id: '7' }])
})

test('rencana uji kering: tanpa id tersimpan ada langkah daftar dan buat label, dengan id tersimpan langsung ke chat', () => {
  const awal = rencanaLabelKering({ session: 's1', chatId: CHAT, nama: 'Karanglo', slug: 'karanglo' })
  assert.deepEqual(awal.map((l) => `${l.method} ${l.path}`), ['GET /api/s1/labels', 'POST /api/s1/labels', 'GET /api/s1/labels/chats/6285700000000%40c.us/', 'PUT /api/s1/labels/chats/6285700000000%40c.us/'])
  assert.deepEqual(awal[1].body, { name: 'Karanglo', color: 5 })
  const lanjut = rencanaLabelKering({ session: 's1', chatId: CHAT, nama: 'Karanglo', slug: 'karanglo', idDiketahui: { karanglo: '8' } })
  assert.equal(lanjut.length, 2)
  assert.deepEqual((lanjut[1].body as { labels: { id: string }[] }).labels.at(-1), { id: '8' })
})
