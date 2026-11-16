// Opsi baca gambar: SVG dirender dengan density tinggi supaya logo tajam, format lain tidak berubah.
import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { isSvg, opsiBaca } from '../src/lib/images'

const svg = (head = '') => Buffer.from(`${head}<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50" fill="#000"/></svg>`)

test('SVG dikenali walau diawali deklarasi XML, komentar, atau spasi', () => {
  assert.equal(isSvg(svg()), true)
  assert.equal(isSvg(svg('<?xml version="1.0" encoding="UTF-8"?>\n<!-- contoh -->\n  ')), true)
  assert.equal(isSvg(Buffer.from('<html><svg></svg></html>')), false)
  assert.equal(isSvg(Buffer.from([0x89, 0x50, 0x4e, 0x47])), false)
})

test('density 300 hanya untuk SVG, dan SVG dirender lebih besar sehingga tetap tajam', async () => {
  assert.deepEqual(opsiBaca(svg()), { failOn: 'error', density: 300 })
  const png = await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()
  assert.deepEqual(opsiBaca(png), { failOn: 'error' })
  const meta = await sharp(svg(), opsiBaca(svg())).metadata()
  assert.equal(meta.width, Math.round((100 * 300) / 72))
})
