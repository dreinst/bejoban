import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SOSMED, DEFAULT_TEMPLATES, TEMPLATE_INFO, TEMPLATE_KEYS, galatIsian, isianTakDikenal } from '../src/lib/bot/templates'

test('isian di luar daftar templat terdeteksi', () => {
  assert.deepEqual(isianTakDikenal('Halo {nama} di {cabang}', ['cabang']), ['nama'])
  assert.deepEqual(isianTakDikenal('{x} {x} {cabang}', ['cabang']), ['x'])
  assert.deepEqual(isianTakDikenal('Tanpa isian, kurung kosong {} dan {dua kata} diabaikan', []), [])
})

test('kalimat galat menyebut isian yang dikenal', () => {
  assert.equal(galatIsian(['nama'], ['cabang', 'ukuran']), 'Isian {nama} tidak dikenal. Isian yang bisa dipakai di sini: {cabang}, {ukuran}.')
})

test('templat dan balasan sosmed bawaan lolos pemeriksaan isian', () => {
  for (const k of TEMPLATE_KEYS) assert.deepEqual(isianTakDikenal(DEFAULT_TEMPLATES[k], TEMPLATE_INFO[k].vars), [], k)
  for (const [c, t] of Object.entries(DEFAULT_SOSMED)) assert.deepEqual(isianTakDikenal(t, ['tautanWa']), [], c)
})
