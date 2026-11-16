import test from 'node:test'
import assert from 'node:assert/strict'
import { branchLabel, mergeSitus, waHref, waNumber } from '../src/lib/situs'
import { renderTemplate } from '../src/lib/text/template'
import { mergeTemplates, DEFAULT_TEMPLATES, mergeSosmed } from '../src/lib/bot/templates'
import { sheetCsvUrl } from '../src/lib/tire/sheet'
import { decide, mergeBot, withinHours } from '../src/lib/bot/policy'

const batu = { name: 'Bejo Ban Batu (Hankook Masters)', whatsapp: '081200000001' }

test('satu nomor utama untuk dua cabang, kalimat pembuka membedakan cabang', () => {
  const s = mergeSitus({ mainWhatsapp: '6281299999999' })
  assert.equal(waNumber(s, batu), '6281299999999')
  assert.equal(waNumber(mergeSitus(null), batu), '081200000001')
  const href = decodeURIComponent(waHref(s, batu, 'umum'))
  assert.ok(href.startsWith('https://wa.me/6281299999999?text='))
  assert.ok(href.includes('Halo kak Bejo Ban Batu, saya mau tanya stok dan harga ban.'))
  assert.ok(decodeURIComponent(waHref(s, batu, 'produk', { produk: 'Ban X' })).includes('Halo kak Bejo Ban Batu, saya mau tanya Ban X.'))
  assert.equal(branchLabel('Bejo Ban Batu (Hankook Masters)'), 'Bejo Ban Batu')
})

test('harga di situs mati secara bawaan', () => {
  assert.equal(mergeSitus(null).showPrices, false)
})

test('templat: variabel diisi, yang tidak dikenal menjadi kosong, templat kosong memakai bawaan', () => {
  assert.equal(renderTemplate('Halo {nama}, {x}!', { nama: 'kak' }), 'Halo kak, !')
  assert.equal(mergeTemplates({ sapaan: '   ' }).sapaan, DEFAULT_TEMPLATES.sapaan)
  assert.equal(mergeTemplates({ sapaan: 'Hai {cabang}' }).sapaan, 'Hai {cabang}')
  assert.ok(mergeSosmed(null).instagram.includes('{tautanWa}'))
})

test('URL Google Sheets diubah ke ekspor CSV dan hanya docs.google.com yang diterima', () => {
  const a = sheetCsvUrl('https://docs.google.com/spreadsheets/d/ABC_123-x/edit#gid=456')
  assert.deepEqual(a, { ok: true, csvUrl: 'https://docs.google.com/spreadsheets/d/ABC_123-x/export?format=csv&gid=456' })
  const b = sheetCsvUrl('https://docs.google.com/spreadsheets/d/ABC/edit')
  assert.ok(b.ok && b.csvUrl.endsWith('gid=0'))
  assert.equal(sheetCsvUrl('https://evil.example.com/spreadsheets/d/ABC/edit').ok, false)
  assert.equal(sheetCsvUrl('http://localhost:9/x.csv').ok, false)
  assert.equal(sheetCsvUrl('http://localhost:9/x.csv', true).ok, true)
  assert.equal(sheetCsvUrl('bukan url').ok, false)
})

test('kebijakan balas: saklar, nomor uji, jam aktif, batas harian', () => {
  const s = mergeBot({ enabled: true, restrictNumbers: true, testNumbers: ['0812-3456-7890'], dailyLimit: 5 })
  const noon = new Date('2026-11-16T05:00:00Z') // 12.00 WIB
  const night = new Date('2026-11-16T17:00:00Z') // 00.00 WIB
  const base = { settings: s, now: noon, sender: '6281234567890@c.us', sentToday: 0 }
  assert.equal(decide(base).action, 'balas')
  assert.equal(decide({ ...base, settings: { ...s, enabled: false } }).action, 'diam')
  assert.equal(decide({ ...base, sender: '6289999999999' }).action, 'diam')
  assert.equal(decide({ ...base, settings: { ...s, restrictNumbers: false }, sender: '6289999999999' }).action, 'balas')
  assert.equal(decide({ ...base, now: night }).action, 'luar_jam')
  assert.equal(decide({ ...base, sentToday: 5 }).action, 'diam')
  assert.equal(withinHours(noon, s), true)
  assert.deepEqual(mergeBot({ numbers: ['0811'] } as never).testNumbers, ['0811'])
  assert.deepEqual(mergeBot(null).branchAliases, { karanglo: ['singosari'] })
})
