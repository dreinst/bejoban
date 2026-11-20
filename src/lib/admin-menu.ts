// Satu-satunya tempat susunan menu admin: urutan menu di sidebar, tab di tiap menu, hak owner,
// dan daftar pengalihan alamat lama. Berkas ini murni (tanpa React, tanpa database) supaya bisa dites.
//
// Aturan:
// - Paling banyak tujuh menu. Menu tanpa tab (Ringkasan) cocok hanya dengan alamatnya sendiri.
//   Menu ketujuh adalah Kasir; halaman kasir lainnya memakai tab supaya sidebar tidak bertambah.
// - Tab aktif ditentukan dari alamat halaman: pola terpanjang yang cocok menang
//   (mis. /admin/chatbot/uji lebih cocok ke Kotak uji daripada ke Percakapan).
// - `owner: true` berarti hanya owner yang melihatnya. Ini hanya penyaring tampilan;
//   setiap halaman dan aksi tetap memeriksa sesi dan peran di server.
// - Halaman yang tidak masuk tab (Akun saya, Panduan ukuran foto) tidak punya menu aktif.
//
// Pemetaan ke modul BejoStock (Asah): Ringkasan = Analitik, Stok dan harga = Inventaris,
// Pengaturan = Akses, Kasir = Kasir (transaksi, riwayat, tinjau diskon, harga batch). Rinciannya di
// docs/PENYELARASAN-BEJOSTOCK.md dan docs/KASIR.md.

export type Role = 'OWNER' | 'BRANCH_ADMIN'

export type AdminTab = {
  key: string
  label: string
  href: string // alamat yang dibuka saat tab diklik
  owner?: boolean
  match?: string[] // pola alamat yang membuat tab ini aktif; bawaan [href]
}

export type AdminMenu = {
  key: string
  label: string
  href: string // alamat bawaan menu (tab pertama)
  owner?: boolean
  tabs: AdminTab[]
}

export const ADMIN_MENU: AdminMenu[] = [
  { key: 'ringkasan', label: 'Ringkasan', href: '/admin', tabs: [] },
  {
    key: 'kasir',
    label: 'Kasir',
    href: '/admin/kasir',
    tabs: [
      { key: 'transaksi-baru', label: 'Transaksi baru', href: '/admin/kasir' },
      { key: 'riwayat', label: 'Riwayat', href: '/admin/kasir/riwayat' },
      { key: 'tinjau-diskon', label: 'Tinjau diskon', href: '/admin/kasir/diskon', owner: true },
      { key: 'pengaturan-kasir', label: 'Pengaturan kasir', href: '/admin/kasir/pengaturan', owner: true, match: ['/admin/kasir/pengaturan', '/admin/kasir/barang'] },
    ],
  },
  {
    key: 'stok-harga',
    label: 'Stok dan harga',
    href: '/admin/stok-ban',
    tabs: [
      { key: 'stok-ban', label: 'Stok ban', href: '/admin/stok-ban', owner: true },
      { key: 'harga-jasa', label: 'Harga jasa', href: '/admin/harga-jasa', owner: true },
      { key: 'produk-situs', label: 'Produk situs', href: '/admin/harga', match: ['/admin/harga', '/admin/produk'] },
      { key: 'perlu-dicek', label: 'Perlu dicek', href: '/admin/peringatan' },
    ],
  },
  {
    key: 'chatbot',
    label: 'Chatbot',
    href: '/admin/chatbot',
    tabs: [
      { key: 'percakapan', label: 'Percakapan', href: '/admin/chatbot' },
      { key: 'uji', label: 'Kotak uji', href: '/admin/chatbot/uji', owner: true },
      { key: 'templat', label: 'Templat pesan', href: '/admin/chatbot/templat', owner: true },
      { key: 'pengaturan-bot', label: 'Pengaturan bot', href: '/admin/chatbot/pengaturan', owner: true },
    ],
  },
  {
    key: 'ongkir',
    label: 'Ongkir',
    href: '/admin/ongkir',
    tabs: [
      { key: 'hitung', label: 'Hitung ongkir', href: '/admin/ongkir' },
      { key: 'tarif', label: 'Tarif', href: '/admin/ongkir/tarif', owner: true },
      { key: 'pengaturan-ongkir', label: 'Pengaturan ongkir', href: '/admin/ongkir/pengaturan', owner: true },
    ],
  },
  {
    key: 'situs',
    label: 'Situs',
    href: '/admin/konten',
    owner: true,
    tabs: [
      { key: 'beranda', label: 'Tampilan beranda', href: '/admin/konten' },
      { key: 'merek', label: 'Merek', href: '/admin/merek' },
      { key: 'kategori', label: 'Kategori', href: '/admin/kategori' },
      { key: 'whatsapp', label: 'Tautan WhatsApp', href: '/admin/situs' },
    ],
  },
  {
    key: 'pengaturan',
    label: 'Pengaturan',
    href: '/admin/cabang',
    owner: true,
    tabs: [
      { key: 'cabang', label: 'Cabang', href: '/admin/cabang' },
      { key: 'pengguna', label: 'Pengguna', href: '/admin/pengguna' },
    ],
  },
]

// Alamat lama yang dialihkan. Dipakai next.config.ts (redirects) dan tes.
// Alamat lain yang pindah menu tetap sama, jadi tidak perlu dialihkan.
// /admin/kalender sengaja tidak punya tab: datanya belum dipakai bot maupun situs, halaman dan datanya tetap ada.
export const LEGACY_REDIRECTS: { source: string; destination: string }[] = [
  { source: '/admin/produk', destination: '/admin/harga' },
  { source: '/admin/pengaturan/whatsapp', destination: '/admin/chatbot/pengaturan' },
  { source: '/admin/pengaturan/ongkir', destination: '/admin/ongkir/pengaturan' },
]

export const legacyDestination = (pathname: string) => LEGACY_REDIRECTS.find((r) => r.source === pathname)?.destination ?? null

// Menu dan tab yang boleh dilihat peran ini. Menu yang semua tabnya disaring ikut hilang,
// dan alamat bawaan menu menjadi tab pertama yang tersisa.
export function menuFor(role: Role, menu: AdminMenu[] = ADMIN_MENU): AdminMenu[] {
  const owner = role === 'OWNER'
  return menu.flatMap((m) => {
    if (m.owner && !owner) return []
    const tabs = m.tabs.filter((t) => owner || !t.owner)
    if (m.tabs.length && !tabs.length) return []
    return [{ ...m, href: tabs[0]?.href ?? m.href, tabs }]
  })
}

const cocok = (pathname: string, pola: string) => (pola === '/admin' ? pathname === '/admin' : pathname === pola || pathname.startsWith(pola + '/'))

// Menu dan tab yang aktif untuk alamat ini, dari menu yang sudah disaring menurut peran.
export function activeFor(pathname: string, menu: AdminMenu[]): { menu: string | null; tab: string | null } {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  let best = { menu: null as string | null, tab: null as string | null, len: -1 }
  for (const m of menu) {
    const calon = m.tabs.length ? m.tabs.flatMap((t) => (t.match ?? [t.href]).map((p) => ({ tab: t.key as string | null, p }))) : [{ tab: null, p: m.href }]
    for (const { tab, p } of calon) if (cocok(path, p) && p.length > best.len) best = { menu: m.key, tab, len: p.length }
  }
  return { menu: best.menu, tab: best.tab }
}
