// Satu-satunya tempat pengelompokan menu sidebar admin. Mengikuti modul proyek BejoStock (Asah).
// Mengubah urutan, judul kelompok, atau isi menu cukup di berkas ini. Alamat halaman tidak diubah.
export type MenuItem = { href: string; label: string; owner?: boolean }
export type MenuGroup = { title: string; items?: MenuItem[]; soon?: string } // soon: kelompok belum ada halamannya

export const ADMIN_MENU: MenuGroup[] = [
  { title: 'Analitik', items: [{ href: '/admin', label: 'Ringkasan' }] },
  {
    title: 'Inventaris',
    items: [
      { href: '/admin/produk', label: 'Produk' },
      { href: '/admin/kategori', label: 'Kategori', owner: true },
      { href: '/admin/merek', label: 'Merek', owner: true },
      { href: '/admin/harga', label: 'Pricelist & Stok' },
      { href: '/admin/stok-ban', label: 'Stok ban', owner: true },
      { href: '/admin/harga-jasa', label: 'Harga jasa', owner: true },
    ],
  },
  { title: 'Kasir dan Harga', soon: 'menyusul dari BejoStock' },
  {
    title: 'Peringatan',
    items: [
      { href: '/admin/peringatan', label: 'Peringatan', owner: true },
      { href: '/admin/kalender', label: 'Kalender libur dan promo', owner: true },
    ],
  },
  {
    title: 'Kanal',
    items: [
      { href: '/admin/chatbot', label: 'Chatbot', owner: true },
      { href: '/admin/ongkir', label: 'Ongkir' },
      { href: '/admin/situs', label: 'Situs dan WhatsApp', owner: true },
      { href: '/admin/konten', label: 'Tampilan Web', owner: true },
      { href: '/admin/panduan-foto', label: 'Panduan Ukuran Foto' },
    ],
  },
  {
    title: 'Akses',
    items: [
      { href: '/admin/pengguna', label: 'Pengguna', owner: true },
      { href: '/admin/cabang', label: 'Cabang' },
      { href: '/admin/akun', label: 'Akun Saya' },
    ],
  },
]

// Item yang aktif: yang paling spesifik cocok dengan alamat sekarang.
export function activeHref(pathname: string, groups: MenuGroup[]): string | null {
  const all = groups.flatMap((g) => g.items ?? []).map((i) => i.href)
  const hits = all.filter((h) => (h === '/admin' ? pathname === '/admin' : pathname === h || pathname.startsWith(h + '/')))
  return hits.sort((a, b) => b.length - a.length)[0] ?? null
}
