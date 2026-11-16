import test from 'node:test'
import assert from 'node:assert/strict'
import { rencanaPulih, type Isian, type Kontrol } from '../src/components/admin/panel-simpan'

const k = (o: Partial<Kontrol> & { name: string }): Kontrol => ({ type: 'text', value: '', checked: false, disabled: false, ...o })

test('teks: diisi ulang bila berbeda, dibiarkan bila sama', () => {
  const isian: Isian = [['name', 'Laufenn']]
  assert.deepEqual(rencanaPulih([k({ name: 'name', value: '' })], isian), [{ i: 0, aksi: 'isi', nilai: 'Laufenn' }])
  assert.deepEqual(rencanaPulih([k({ name: 'name', value: 'Laufenn' })], isian), [])
})

test('angka dan teks panjang memakai jalur yang sama', () => {
  const isian: Isian = [['harga', '450000'], ['catatan', 'baris 1\nbaris 2']]
  const kontrol = [k({ name: 'harga', type: 'number', value: '100' }), k({ name: 'catatan', type: 'textarea', value: '' })]
  assert.deepEqual(rencanaPulih(kontrol, isian), [{ i: 0, aksi: 'isi', nilai: '450000' }, { i: 1, aksi: 'isi', nilai: 'baris 1\nbaris 2' }])
})

test('kolom yang tidak ada di kiriman dikosongkan', () => {
  assert.deepEqual(rencanaPulih([k({ name: 'spec', value: 'bawaan' })], []), [{ i: 0, aksi: 'isi', nilai: '' }])
})

test('kotak centang yang tidak tercentang saat dikirim tetap tidak tercentang', () => {
  // Laufenn distok: By order tidak ada di data kiriman, jadi tidak boleh diklik walau bawaannya mati.
  const kontrol = [k({ name: 'aktif', type: 'checkbox', value: 'on', checked: true }), k({ name: 'byOrder', type: 'checkbox', value: 'on', checked: false })]
  assert.deepEqual(rencanaPulih(kontrol, [['aktif', 'on']]), [])
})

test('kotak centang yang tercentang saat dikirim kembali tercentang, dan yang kebetulan tercentang dimatikan', () => {
  const kontrol = [k({ name: 'aktif', type: 'checkbox', value: 'on', checked: false }), k({ name: 'byOrder', type: 'checkbox', value: 'on', checked: true })]
  assert.deepEqual(rencanaPulih(kontrol, [['aktif', 'on']]), [{ i: 0, aksi: 'klik' }, { i: 1, aksi: 'klik' }])
})

test('pilihan: select diisi ulang dan radio hanya diklik bila belum terpilih', () => {
  const kontrol = [
    k({ name: 'kategori', type: 'select-one', value: '1' }),
    k({ name: 'mode', type: 'radio', value: 'a', checked: true }),
    k({ name: 'mode', type: 'radio', value: 'b', checked: false }),
  ]
  assert.deepEqual(rencanaPulih(kontrol, [['kategori', '3'], ['mode', 'b']]), [{ i: 0, aksi: 'isi', nilai: '3' }, { i: 2, aksi: 'klik' }])
})

test('password, tersembunyi, berkas, dan kolom nonaktif tidak disentuh', () => {
  const kontrol = [
    k({ name: 'password', type: 'password', value: 'rahasia' }),
    k({ name: 'id', type: 'hidden', value: '7' }),
    k({ name: 'foto', type: 'file' }),
    k({ name: 'kunci', value: 'x', disabled: true }),
  ]
  assert.deepEqual(rencanaPulih(kontrol, [['password', 'lama'], ['id', '9'], ['kunci', 'y']]), [])
})
