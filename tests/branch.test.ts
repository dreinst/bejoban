import test from 'node:test'
import assert from 'node:assert/strict'
import { detectBranch } from '../src/lib/bot/branch'
import { memoryFresh, nextStatus, isMuted, muteUntil, isClosed } from '../src/lib/bot/conversation'

const branches = [
  { slug: 'batu', name: 'Bejo Ban Batu (Hankook Masters)', aliases: [] as string[] },
  { slug: 'karanglo', name: 'Bejo Ban Karanglo', aliases: ['singosari'] },
]
const slug = (t: string) => detectBranch(t, branches)?.slug ?? null

test('cabang dari kalimat pembuka situs', () => {
  assert.equal(slug('Halo kak Bejo Ban Karanglo, saya mau tanya stok dan harga ban.'), 'karanglo')
  assert.equal(slug('Halo kak Bejo Ban Batu, saya mau tanya Hankook Ventus.'), 'batu')
})

test('cabang dikenali di mana pun dalam pesan, termasuk kata lain', () => {
  assert.equal(slug('ada ban 185/65 R15 di batu?'), 'batu')
  assert.equal(slug('saya di Singosari, ada ban?'), 'karanglo')
  assert.equal(slug('KARANGLO ada stok?'), 'karanglo')
  assert.equal(slug('Halo kak Bejo Ban, tanya dong (batu)'), 'batu')
})

test('kalimat pembuka yang diedit wajar tetap dikenali', () => {
  assert.equal(slug('Selamat pagi, mau tanya ban untuk Innova ya, Bejo Ban Karanglo'), 'karanglo')
})

test('dua cabang disebut sekaligus atau tidak ada: tidak ditebak', () => {
  assert.equal(slug('lebih dekat batu atau karanglo ya?'), null)
  assert.equal(slug('halo ada ban?'), null)
  assert.equal(slug('batunya besar'), null)
})

test('status percakapan', () => {
  assert.equal(nextStatus('BARU', 'bot_menjawab'), 'DIJAWAB_BOT')
  assert.equal(nextStatus('DIJAWAB_BOT', 'bot_serahkan'), 'DISERAHKAN')
  assert.equal(nextStatus('DISERAHKAN', 'bot_menjawab'), 'DISERAHKAN')
  assert.equal(nextStatus('DIJAWAB_BOT', 'admin_membalas'), 'DISERAHKAN')
  assert.equal(nextStatus('DISERAHKAN', 'tandai_ada'), 'SELESAI_ADA')
  assert.equal(nextStatus('DISERAHKAN', 'tandai_tidak_ada'), 'SELESAI_TIDAK_ADA')
  assert.equal(nextStatus('SELESAI_ADA', 'tandai_tidak_ada'), 'SELESAI_ADA', 'selesai tidak berubah lagi')
  assert.equal(nextStatus('BARU', 'luar_jam'), 'BARU')
  assert.ok(isClosed('SELESAI_TIDAK_ADA') && !isClosed('DISERAHKAN'))
})

test('bot diam selama masa diam, bebas setelah ditandai selesai atau waktu habis', () => {
  const now = new Date('2026-11-16T05:00:00Z')
  const until = muteUntil(now, 6)
  assert.equal(isMuted({ status: 'DISERAHKAN', mutedUntil: until }, now), true)
  assert.equal(isMuted({ status: 'DISERAHKAN', mutedUntil: until }, new Date(now.getTime() + 7 * 3600_000)), false)
  assert.equal(isMuted({ status: 'SELESAI_ADA', mutedUntil: until }, now), false)
  assert.equal(isMuted({ status: 'BARU', mutedUntil: null }, now), false)
})

test('ingatan cabang per nomor berlaku selama jangka waktu yang diatur', () => {
  const now = new Date('2026-11-16T05:00:00Z')
  const days = (n: number) => new Date(now.getTime() - n * 86400_000)
  assert.equal(memoryFresh({ chosenAt: days(29) }, now, 30), true)
  assert.equal(memoryFresh({ chosenAt: days(31) }, now, 30), false)
  assert.equal(memoryFresh({ chosenAt: days(31) }, now, 60), true)
  assert.equal(memoryFresh(null, now, 30), false)
})
