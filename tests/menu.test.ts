import test from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN_MENU, LEGACY_REDIRECTS, activeFor, legacyDestination, menuFor } from '../src/lib/admin-menu'

const owner = menuFor('OWNER')
const cabang = menuFor('BRANCH_ADMIN')
const aktif = (path: string, menu = owner) => {
  const a = activeFor(path, menu)
  return `${a.menu ?? '-'}/${a.tab ?? '-'}`
}

test('sidebar paling banyak enam menu, owner melihat semuanya dalam urutan yang ditetapkan', () => {
  assert.ok(ADMIN_MENU.length <= 6)
  assert.deepEqual(owner.map((m) => m.label), ['Ringkasan', 'Stok dan harga', 'Chatbot', 'Ongkir', 'Situs', 'Pengaturan'])
})

test('admin cabang hanya mendapat empat menu tanpa item owner', () => {
  assert.deepEqual(cabang.map((m) => m.label), ['Ringkasan', 'Stok dan harga', 'Chatbot', 'Ongkir'])
  const tabs = cabang.flatMap((m) => m.tabs)
  assert.ok(tabs.every((t) => !t.owner))
  assert.deepEqual(cabang.find((m) => m.key === 'stok-harga')!.tabs.map((t) => t.key), ['produk-situs', 'perlu-dicek'])
  assert.deepEqual(cabang.find((m) => m.key === 'chatbot')!.tabs.map((t) => t.key), ['percakapan'])
  assert.deepEqual(cabang.find((m) => m.key === 'ongkir')!.tabs.map((t) => t.key), ['hitung'])
  // Alamat bawaan menu menjadi tab pertama yang boleh dilihat.
  assert.equal(cabang.find((m) => m.key === 'stok-harga')!.href, '/admin/harga')
  assert.equal(owner.find((m) => m.key === 'stok-harga')!.href, '/admin/stok-ban')
})

test('tiap alamat baru memetakan ke menu dan tab yang benar (owner)', () => {
  const peta: Record<string, string> = {
    '/admin': 'ringkasan/-',
    '/admin/stok-ban': 'stok-harga/stok-ban',
    '/admin/harga-jasa': 'stok-harga/harga-jasa',
    '/admin/harga': 'stok-harga/produk-situs',
    '/admin/produk/baru': 'stok-harga/produk-situs',
    '/admin/produk/12': 'stok-harga/produk-situs',
    '/admin/peringatan': 'stok-harga/perlu-dicek',
    '/admin/chatbot': 'chatbot/percakapan',
    '/admin/chatbot/uji': 'chatbot/uji',
    '/admin/chatbot/templat': 'chatbot/templat',
    '/admin/ongkir': 'ongkir/hitung',
    '/admin/ongkir/tarif': 'ongkir/tarif',
    '/admin/konten': 'situs/beranda',
    '/admin/konten/hero': 'situs/beranda',
    '/admin/merek': 'situs/merek',
    '/admin/kategori': 'situs/kategori',
    '/admin/situs': 'situs/whatsapp',
    '/admin/cabang': 'pengaturan/cabang',
    '/admin/pengguna': 'pengaturan/pengguna',
    '/admin/chatbot/pengaturan': 'chatbot/pengaturan-bot',
    '/admin/ongkir/pengaturan': 'ongkir/pengaturan-ongkir',
    // Kalender disembunyikan dari menu: halamannya ada, tapi tidak ada tab aktif.
    '/admin/kalender': '-/-',
    // Halaman di luar tab: tidak ada menu aktif.
    '/admin/akun': '-/-',
    '/admin/panduan-foto': '-/-',
    '/admin/hargaan': '-/-',
  }
  for (const [path, hasil] of Object.entries(peta)) assert.equal(aktif(path), hasil, path)
  assert.equal(aktif('/admin/chatbot/uji/'), 'chatbot/uji')
})

test('admin cabang: halaman owner tidak punya menu aktif, halaman miliknya tetap cocok', () => {
  assert.equal(aktif('/admin/harga', cabang), 'stok-harga/produk-situs')
  assert.equal(aktif('/admin/produk/3', cabang), 'stok-harga/produk-situs')
  assert.equal(aktif('/admin/peringatan', cabang), 'stok-harga/perlu-dicek')
  assert.equal(aktif('/admin/chatbot', cabang), 'chatbot/percakapan')
  assert.equal(aktif('/admin/ongkir', cabang), 'ongkir/hitung')
  for (const p of ['/admin/stok-ban', '/admin/chatbot/uji', '/admin/ongkir/tarif', '/admin/situs', '/admin/cabang', '/admin/chatbot/pengaturan', '/admin/ongkir/pengaturan']) {
    const a = activeFor(p, cabang)
    // /admin/chatbot/uji dan /admin/ongkir/tarif boleh jatuh ke menu induknya, tapi tidak ke tab owner.
    assert.ok(!cabang.flatMap((m) => m.tabs).some((t) => t.key === a.tab && t.owner), p)
    if (!p.startsWith('/admin/chatbot') && !p.startsWith('/admin/ongkir')) assert.equal(a.menu, null, p)
  }
})

test('alamat lama dialihkan ke alamat baru yang punya tab', () => {
  assert.equal(legacyDestination('/admin/produk'), '/admin/harga')
  assert.equal(legacyDestination('/admin/pengaturan/whatsapp'), '/admin/chatbot/pengaturan')
  assert.equal(legacyDestination('/admin/pengaturan/ongkir'), '/admin/ongkir/pengaturan')
  assert.equal(legacyDestination('/admin/chatbot/pengaturan'), null)
  assert.equal(legacyDestination('/admin/produk/5'), null)
  for (const r of LEGACY_REDIRECTS) {
    assert.notEqual(activeFor(r.destination, owner).tab, null, r.destination)
    // Tujuan tidak boleh dialihkan lagi (tidak ada rantai atau putaran).
    assert.equal(legacyDestination(r.destination), null)
  }
})

test('kunci tab unik di dalam tiap menu dan tiap tab punya alamat', () => {
  for (const m of ADMIN_MENU) {
    assert.equal(new Set(m.tabs.map((t) => t.key)).size, m.tabs.length, m.key)
    for (const t of m.tabs) assert.ok(t.href.startsWith('/admin'), t.key)
  }
})

test('Pengaturan hanya berisi Cabang dan Pengguna, pengaturan bot dan ongkir pindah ke menu masing-masing', () => {
  assert.deepEqual(owner.find((m) => m.key === 'pengaturan')!.tabs.map((t) => t.key), ['cabang', 'pengguna'])
  assert.deepEqual(owner.find((m) => m.key === 'chatbot')!.tabs.map((t) => t.label), ['Percakapan', 'Kotak uji', 'Templat pesan', 'Pengaturan bot'])
  assert.deepEqual(owner.find((m) => m.key === 'ongkir')!.tabs.map((t) => t.label), ['Hitung ongkir', 'Tarif', 'Pengaturan ongkir'])
  const semua = ADMIN_MENU.flatMap((m) => m.tabs).filter((t) => t.key.startsWith('pengaturan-'))
  assert.ok(semua.every((t) => t.owner))
})
