import type { PresetKey } from './images-presets'

export type Field =
  | { key: string; label: string; type: 'text' | 'textarea' | 'datetime'; hint?: string }
  | { key: string; label: string; type: 'image'; preset: PresetKey }
  | { key: string; label: string; type: 'images'; preset: PresetKey; max: number }
  | { key: string; label: string; type: 'products'; max: number }
  | { key: string; label: string; type: 'list'; max: number; fields: Field[] }

export type Section = { key: string; title: string; note?: string; fields: Field[]; defaults: Record<string, unknown> }

const txt = (key: string, label: string, hint?: string): Field => ({ key, label, type: 'text', hint })
const area = (key: string, label: string): Field => ({ key, label, type: 'textarea' })

export const SECTIONS: Section[] = [
  {
    key: 'site',
    title: 'Identitas & SEO',
    fields: [
      txt('name', 'Nama toko'),
      { key: 'logo', label: 'Logo (tampil di header putih)', type: 'image', preset: 'logo' },
      txt('seoTitle', 'Judul di Google'),
      area('seoDescription', 'Deskripsi di Google'),
      { key: 'ogImage', label: 'Gambar saat link dibagikan', type: 'image', preset: 'og' },
    ],
    defaults: {
      name: 'Bejo Ban',
      logo: '',
      seoTitle: 'Bejo Ban: Toko Ban, Velg & Oli Mobil di Batu dan Karanglo Malang',
      seoDescription:
        'Authorized Hankook & Michelin Dealer. Ban, velg, oli, spooring, balancing dan nitrogen. Cabang Batu dan Karanglo, buka 08.00 sampai 17.00.',
      ogImage: '',
    },
  },
  {
    key: 'trust',
    title: 'Bar keunggulan (di bawah header)',
    fields: [{ key: 'items', label: 'Poin', type: 'list', max: 5, fields: [txt('title', 'Judul'), txt('sub', 'Keterangan')] }],
    defaults: {
      items: [
        { title: '100% Original', sub: 'Dealer resmi Hankook & Michelin' },
        { title: 'Spooring & Balancing', sub: 'Dikerjakan di bengkel kami' },
        { title: 'Isi Nitrogen', sub: 'Tersedia di semua cabang' },
        { title: '2 Cabang', sub: 'Batu dan Karanglo' },
        { title: 'Jam Buka', sub: 'Pukul 08.00 sampai 17.00' },
      ],
    },
  },
  {
    key: 'hero',
    title: 'Hero (banner utama)',
    fields: [
      txt('eyebrow', 'Label kecil di atas judul'),
      txt('title', 'Judul baris 1'),
      txt('highlight', 'Judul baris 2 (abu-abu)'),
      area('text', 'Paragraf'),
      txt('cta1', 'Tombol 1'),
      txt('cta1Href', 'Link tombol 1'),
      txt('cta2', 'Tombol 2'),
      { key: 'background', label: 'Foto latar (opsional)', type: 'image', preset: 'hero' },
      { key: 'side', label: 'Foto samping (maks. 3)', type: 'images', preset: 'heroSide', max: 3 },
    ],
    defaults: {
      eyebrow: 'Authorized Hankook & Michelin Dealer',
      title: 'Pilih Ban Terbaik',
      highlight: 'Pasang Langsung di Bejo Ban',
      text: 'Ban, velg dan oli original untuk mobil Anda. Sekalian spooring, balancing dan isi nitrogen di bengkel kami.',
      cta1: 'Belanja Sekarang',
      cta1Href: '/produk',
      cta2: 'Booking via WhatsApp',
      background: '',
      side: [],
    },
  },
  {
    key: 'panel',
    title: 'Panel layanan (kolom kanan)',
    fields: [
      txt('eyebrow', 'Label kecil'),
      txt('badge', 'Lencana'),
      txt('cardTitle', 'Judul kartu'),
      txt('cardSub', 'Keterangan kartu'),
      txt('listTitle', 'Judul daftar'),
      { key: 'points', label: 'Poin keunggulan', type: 'list', max: 4, fields: [txt('text', 'Teks')] },
      txt('guarantee', 'Kotak jaminan'),
      { key: 'storeImage', label: 'Foto toko', type: 'image', preset: 'store' },
      txt('storeTitle', 'Judul foto toko'),
    ],
    defaults: {
      eyebrow: 'Layanan Bengkel',
      badge: 'Buka hari ini',
      cardTitle: 'Spooring, Balancing & Nitrogen',
      cardSub: 'Pasang ban dan velg langsung di cabang Bejo Ban',
      listTitle: 'Keunggulan Bejo Ban',
      points: [
        { text: 'Authorized Hankook & Michelin Dealer' },
        { text: 'Pemasangan ban, velg & ganti oli di tempat' },
        { text: 'Mesin spooring dan balancing' },
      ],
      guarantee: '100% Original & Bergaransi Resmi',
      storeImage: '',
      storeTitle: 'Our Official Store',
    },
  },
  {
    key: 'steps',
    title: 'Alur belanja',
    fields: [{ key: 'items', label: 'Langkah', type: 'list', max: 5, fields: [txt('title', 'Judul'), txt('sub', 'Keterangan')] }],
    defaults: {
      items: [
        { title: 'Pilih Produk', sub: 'di bejoban' },
        { title: 'Pilih Cabang', sub: 'Batu atau Karanglo' },
        { title: 'Kirim Pesanan', sub: 'lewat WhatsApp' },
        { title: 'Datang & Pasang', sub: 'dikerjakan mekanik kami' },
        { title: 'Selesai', sub: 'kendaraan siap jalan' },
      ],
    },
  },
  {
    key: 'payment',
    title: 'Pembayaran',
    fields: [
      txt('title', 'Judul'),
      txt('sub', 'Keterangan'),
      { key: 'logos', label: 'Logo metode bayar', type: 'images', preset: 'payment', max: 8 },
    ],
    defaults: { title: 'Pesan Mudah Lewat WhatsApp', sub: 'Konfirmasi stok dan harga dulu, bayar saat di bengkel', logos: [] },
  },
  {
    key: 'flash',
    title: 'Flash sale',
    note: 'Produk yang tampil diatur dari menu Harga (centang Flash Sale). Bagian ini tersembunyi kalau belum ada produk atau waktunya habis.',
    fields: [txt('title', 'Judul'), txt('sub', 'Keterangan'), { key: 'endsAt', label: 'Berakhir pada', type: 'datetime' }],
    defaults: { title: 'FLASH SALE', sub: 'Harga spesial, stok terbatas! Buruan sebelum kehabisan.', endsAt: '' },
  },
  {
    key: 'newest',
    title: 'Produk terbaru',
    fields: [txt('title', 'Judul'), txt('sub', 'Keterangan')],
    defaults: { title: 'Produk Terbaru', sub: 'Produk pilihan untuk kebutuhan mobil Anda' },
  },
  {
    key: 'promo',
    title: 'Banner promo + Shop the look',
    fields: [
      { key: 'image', label: 'Banner', type: 'image', preset: 'promo' },
      txt('title', 'Judul (kalau tanpa banner)'),
      txt('sub', 'Sub judul (kalau tanpa banner)'),
      { key: 'thumbs', label: 'Foto kecil di banner bawaan (maks. 3)', type: 'images', preset: 'heroSide', max: 3 },
      txt('button', 'Teks tombol'),
      txt('link', 'Link tombol (misal reel Instagram)'),
      txt('lookTitle', 'Judul produk terkait'),
      { key: 'products', label: 'Produk terkait', type: 'products', max: 4 },
    ],
    defaults: {
      image: '',
      title: 'SPOORING & GANTI VELG',
      sub: 'Traga · L300 · Innova · Granmax · FJ Cruiser',
      thumbs: [],
      button: 'Lihat di Instagram',
      link: 'https://www.instagram.com/bejoban/',
      lookTitle: 'Produk Pada Konten Ini:',
      products: [],
    },
  },
  {
    key: 'cars',
    title: 'Rekomendasi berdasarkan mobil',
    fields: [
      txt('title', 'Judul'),
      txt('sub', 'Sub judul'),
      {
        key: 'items',
        label: 'Kartu mobil',
        type: 'list',
        max: 8,
        fields: [
          txt('title', 'Judul'),
          txt('sub', 'Keterangan'),
          txt('query', 'Kata kunci mobil', 'Dicocokkan dengan kolom "Cocok untuk" di produk'),
          { key: 'image', label: 'Foto', type: 'image', preset: 'car' },
        ],
      },
    ],
    defaults: { title: 'REKOMENDASI BERDASARKAN MOBIL', sub: 'Temukan Velg & Ban yang Tepat untuk Mobil Anda', items: [] },
  },
  {
    key: 'locations',
    title: 'Judul bagian lokasi',
    note: 'Alamat, foto dan WhatsApp tiap cabang diatur di menu Cabang.',
    fields: [txt('eyebrow', 'Label kecil'), txt('title', 'Judul')],
    defaults: { eyebrow: 'KUNJUNGI BENGKEL KAMI', title: 'Lokasi Bejo Ban' },
  },
  {
    key: 'brands',
    title: 'Judul bagian merek',
    note: 'Daftar merek dan logonya diatur di menu Merek.',
    fields: [txt('title', 'Judul'), txt('sub', 'Sub judul'), txt('highlight', 'Kata lanjutan')],
    defaults: { title: 'Our Brand', sub: 'Brand Terpercaya untuk', highlight: 'Performa Maksimal' },
  },
  {
    key: 'gallery',
    title: 'Galeri',
    fields: [txt('title', 'Judul'), txt('sub', 'Keterangan'), { key: 'images', label: 'Foto galeri', type: 'images', preset: 'heroSide', max: 40 }],
    defaults: { title: 'Galeri Bengkel', sub: 'Pekerjaan terbaru dari Bejo Ban Batu dan Karanglo', images: [] },
  },
  {
    key: 'footer',
    title: 'Footer',
    fields: [area('about', 'Tentang'), txt('copyright', 'Teks hak cipta')],
    defaults: {
      about: 'Authorized Hankook & Michelin Dealer. Menyediakan ban, velg dan oli mobil, lengkap dengan layanan spooring, balancing dan nitrogen.',
      copyright: 'Bejo Ban: Toko Ban, Velg & Oli Mobil Batu dan Malang',
    },
  },
]

export const sectionByKey = (k: string) => SECTIONS.find((s) => s.key === k)
