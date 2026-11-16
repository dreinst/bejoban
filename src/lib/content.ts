import type { PresetKey } from './images-presets'

export type Pilihan = { value: string; label: string }
export type Field =
  | { key: string; label: string; type: 'text' | 'textarea' | 'datetime'; hint?: string }
  // Pilihan tetap berlabel awam. `izinkanLain`: nilai tersimpan di luar daftar (mis. tautan lama) tetap dipertahankan.
  | { key: string; label: string; type: 'select'; options: Pilihan[]; hint?: string; izinkanLain?: boolean }
  | { key: string; label: string; type: 'image'; preset: PresetKey }
  | { key: string; label: string; type: 'images'; preset: PresetKey; max: number }
  | { key: string; label: string; type: 'products'; max: number }
  | { key: string; label: string; type: 'list'; max: number; fields: Field[] }

// hidden: bagian yang tidak tampil di beranda saat ini; isinya tetap disimpan dan diberi tanda di admin.
export type Section = { key: string; title: string; note?: string; hidden?: boolean; fields: Field[]; defaults: Record<string, unknown> }

// Ikon yang dikenal beranda, dengan nama yang dipahami admin. Kosong: beranda memilih ikon bawaan.
const ICON_OPTIONS: Pilihan[] = [
  { value: '', label: 'Otomatis' },
  { value: 'shield', label: 'Perisai (keaslian)' },
  { value: 'spooring', label: 'Spooring' },
  { value: 'balancing', label: 'Balancing' },
  { value: 'nitrogen', label: 'Nitrogen' },
  { value: 'tire', label: 'Ban' },
  { value: 'velg', label: 'Velg' },
  { value: 'oli', label: 'Oli' },
  { value: 'pin', label: 'Lokasi' },
  { value: 'clock', label: 'Jam' },
]
// Tujuan tombol di beranda. Alamat lain yang sudah tersimpan tetap dipertahankan.
const LINK_OPTIONS: Pilihan[] = [
  { value: '/produk', label: 'Daftar produk' },
  { value: '/galeri', label: 'Galeri karya' },
  { value: '/kalkulator-ban', label: 'Kalkulator ban' },
  { value: '/#layanan', label: 'Layanan bengkel (bagian di beranda)' },
  { value: '/#cara-pesan', label: 'Alur pesan (bagian di beranda)' },
  { value: '/#cabang', label: 'Lokasi cabang (bagian di beranda)' },
]
const txt = (key: string, label: string, hint?: string): Field => ({ key, label, type: 'text', hint })
const ikon = (): Field => ({ key: 'icon', label: 'Ikon', type: 'select', options: ICON_OPTIONS })
const area = (key: string, label: string): Field => ({ key, label, type: 'textarea' })

// Urutan sama dengan beranda dari atas ke bawah (Identitas & SEO di akhir karena tidak tampil sebagai bagian).
// Bagian yang tidak tampil di beranda sekarang (hidden) ada di paling akhir.
export const SECTIONS: Section[] = [
  {
    key: 'hero',
    title: 'Hero (banner utama)',
    fields: [
      txt('eyebrow', 'Label kecil di atas judul'),
      txt('title', 'Judul baris 1'),
      txt('highlight', 'Judul baris 2 (abu-abu)'),
      area('text', 'Paragraf'),
      txt('cta1', 'Tombol 1'),
      { key: 'cta1Href', label: 'Tombol 1 menuju', type: 'select', options: LINK_OPTIONS, izinkanLain: true },
      txt('cta2', 'Tombol 2 (WhatsApp)'),
      { key: 'image', label: 'Foto mobil di hero (PNG potongan latar transparan)', type: 'image', preset: 'heroCar' },
    ],
    defaults: {
      eyebrow: 'Authorized Hankook & Michelin Dealer',
      title: 'Pilih Ban Terbaik',
      highlight: 'Pasang Langsung di Bejo Ban',
      text: 'Ban, velg dan oli original untuk mobil Anda. Sekalian spooring, balancing dan isi nitrogen di bengkel kami.',
      cta1: 'Lihat Produk',
      cta1Href: '/produk',
      cta2: 'Booking via WhatsApp',
      image: '',
    },
  },
  {
    key: 'trust',
    title: 'Bar keunggulan (di bawah header)',
    fields: [{ key: 'items', label: 'Poin', type: 'list', max: 5, fields: [txt('title', 'Judul'), txt('sub', 'Keterangan'), ikon()] }],
    defaults: {
      items: [
        { title: '100% Original', sub: 'Dealer resmi Hankook & Michelin', icon: 'shield' },
        { title: 'Spooring & Balancing', sub: 'Dikerjakan di bengkel kami', icon: 'balancing' },
        { title: 'Isi Nitrogen', sub: 'Tersedia di semua cabang', icon: 'nitrogen' },
        { title: '2 Cabang', sub: 'Batu dan Karanglo', icon: 'pin' },
        { title: 'Jam Buka', sub: 'Pukul 08.00 sampai 17.00', icon: 'clock' },
      ],
    },
  },
  {
    key: 'services',
    title: 'Layanan bengkel (enam kartu bernomor)',
    fields: [
      txt('title', 'Judul'),
      txt('sub', 'Keterangan'),
      { key: 'items', label: 'Layanan', type: 'list', max: 6, fields: [txt('title', 'Nama layanan'), ikon(), txt('sub', 'Kalimat singkat')] },
    ],
    defaults: {
      title: 'Layanan Bengkel',
      sub: 'Pasang ban dan velg langsung di cabang Bejo Ban',
      items: [
        { title: 'Spooring', icon: 'spooring', sub: 'Atur sudut roda supaya mobil lurus dan stabil.' },
        { title: 'Balancing', icon: 'balancing', sub: 'Seimbangkan putaran roda supaya tidak bergetar.' },
        { title: 'Isi Nitrogen', icon: 'nitrogen', sub: 'Tersedia di semua cabang.' },
        { title: 'Pasang Ban', icon: 'tire', sub: 'Ban baru dipasang mekanik kami di tempat.' },
        { title: 'Ganti Velg', icon: 'velg', sub: 'Velg baru dipasang langsung di bengkel.' },
        { title: 'Ganti Oli', icon: 'oli', sub: 'Oli mesin diganti di bengkel.' },
      ],
    },
  },
  {
    key: 'newest',
    title: 'Produk terbaru',
    note: 'Maksimal enam produk. Kalau kosong, yang tampil enam produk terbaru.',
    fields: [txt('title', 'Judul'), txt('sub', 'Keterangan'), txt('button', 'Teks tombol'), { key: 'products', label: 'Produk yang ditampilkan', type: 'products', max: 6 }],
    defaults: { title: 'Produk Terbaru', sub: 'Harga dan stok kami kirim lewat WhatsApp.', button: 'Tanya harga via WhatsApp', products: [] },
  },
  {
    key: 'steps',
    title: 'Alur pesan',
    fields: [txt('title', 'Judul'), txt('sub', 'Keterangan'), { key: 'items', label: 'Langkah', type: 'list', max: 5, fields: [txt('title', 'Judul'), txt('sub', 'Keterangan')] }],
    defaults: {
      title: 'Alur Belanja',
      sub: 'Tanya lewat WhatsApp, datang, dan kendaraan siap jalan',
      items: [
        { title: 'Pilih Produk', sub: 'di situs Bejo Ban' },
        { title: 'Pilih Cabang', sub: 'Batu atau Karanglo' },
        { title: 'Chat WhatsApp', sub: 'tanya stok dan harga' },
        { title: 'Datang & Pasang', sub: 'dikerjakan mekanik kami' },
        { title: 'Selesai', sub: 'kendaraan siap jalan' },
      ],
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
          { key: 'tone', label: 'Latar foto', type: 'select', options: [{ value: '', label: 'Terang' }, { value: 'gelap', label: 'Gelap' }], hint: 'Pilih Gelap kalau mobilnya berwarna terang.' },
          { key: 'image', label: 'Foto mobil (PNG potongan latar transparan)', type: 'image', preset: 'carCut' },
        ],
      },
    ],
    defaults: { title: 'REKOMENDASI BERDASARKAN MOBIL', sub: 'Temukan Velg & Ban yang Tepat untuk Mobil Anda', items: [] },
  },
  {
    key: 'brands',
    title: 'Judul bagian merek',
    note: 'Daftar merek, urutan, dan status by order diatur di tab Merek.',
    fields: [txt('title', 'Judul'), txt('sub', 'Sub judul')],
    defaults: { title: 'Our Brand', sub: 'Brand Terpercaya untuk Performa Maksimal' },
  },
  {
    key: 'gallery',
    title: 'Galeri',
    fields: [txt('title', 'Judul'), txt('sub', 'Keterangan'), { key: 'images', label: 'Foto galeri (empat pertama tampil di beranda)', type: 'images', preset: 'gallery', max: 40 }],
    defaults: { title: 'Galeri Bengkel', sub: 'Pekerjaan terbaru dari Bejo Ban Batu dan Karanglo', images: [] },
  },
  {
    key: 'locations',
    title: 'Judul bagian lokasi',
    note: 'Alamat, foto, dan WhatsApp tiap cabang diatur di Pengaturan, tab Cabang.',
    fields: [txt('eyebrow', 'Label kecil'), txt('title', 'Judul')],
    defaults: { eyebrow: 'KUNJUNGI BENGKEL KAMI', title: 'Lokasi Bejo Ban' },
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
  {
    key: 'site',
    title: 'Identitas & SEO',
    fields: [
      txt('name', 'Nama toko'),
      { key: 'logo', label: 'Logo putih (tampil di header dan footer hitam, kosong = logo Bejo Ban bawaan)', type: 'image', preset: 'logo' },
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
    key: 'panel',
    hidden: true,
    note: 'Bagian ini tidak tampil di beranda sekarang. Isinya tetap disimpan.',
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
    key: 'payment',
    hidden: true,
    note: 'Bagian ini tidak tampil di beranda sekarang. Isinya tetap disimpan.',
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
    hidden: true,
    note: 'Bagian ini tidak tampil di beranda sekarang. Isinya tetap disimpan.',
    fields: [txt('title', 'Judul'), txt('sub', 'Keterangan'), { key: 'endsAt', label: 'Berakhir pada', type: 'datetime' }],
    defaults: { title: 'FLASH SALE', sub: 'Harga spesial, stok terbatas! Buruan sebelum kehabisan.', endsAt: '' },
  },
  {
    key: 'promo',
    title: 'Banner promo + Shop the look',
    hidden: true,
    note: 'Bagian ini tidak tampil di beranda sekarang. Isinya tetap disimpan.',
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
]

export const sectionByKey = (k: string) => SECTIONS.find((s) => s.key === k)
