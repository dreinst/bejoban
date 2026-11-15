import test from 'node:test'
import assert from 'node:assert/strict'
import { findSizes, findRing, normalizeSize } from '../src/lib/tire/size'

const norms = (t: string) => findSizes(t).map((s) => s.norm)

test('ukuran radial dengan berbagai penulisan', () => {
  for (const t of ['185/65 R15', '185/65-15', '185 65 15', '1856515', '185/65r15', 'ada ban 185/65R15 gak?']) {
    assert.deepEqual(norms(t), ['185/65R15'], t)
  }
})

test('ukuran muatan dan flotasi', () => {
  assert.deepEqual(norms('165-13'), ['165-13'])
  assert.deepEqual(norms('750-16'), ['750-16'])
  assert.deepEqual(norms('31x10.5-15'), ['31x10.5-15'])
  assert.deepEqual(norms('31 x 10,5 R15'), ['31x10.5-15'])
  assert.deepEqual(norms('26x7.5-13'), ['26x7.5-13'])
})

test('ring dikenali hanya kalau berdiri sendiri', () => {
  assert.equal(findRing('ring 15'), 15)
  assert.equal(findRing('r16 apa aja'), 16)
  assert.equal(findRing('stok 4 ban'), null)
})

test('lebih dari satu ukuran dalam satu pesan', () => {
  assert.deepEqual(norms('185/65R15 dan 195/50-16'), ['185/65R15', '195/50R16'])
})

test('angka biasa bukan ukuran', () => {
  assert.deepEqual(norms('halo 0812 tolong'), [])
  assert.deepEqual(norms('harga 999/99 R99'), [])
})

test('normalizeSize untuk sel pricelist', () => {
  assert.equal(normalizeSize('175/80-13 ')?.norm, '175/80R13')
  assert.equal(normalizeSize('165-13')?.norm, '165-13')
  assert.equal(normalizeSize('ngawur'), null)
})
