import { PRESETS, type PresetKey } from '@/lib/images-presets'
import { SECTIONS, type Field } from '@/lib/content'
import { PageBody, PageHeader, Section } from '@/components/admin/ui'
import { DataTable } from '@/components/admin/data-table'

// Hanya jenis foto yang benar-benar punya tempat unggah di admin: form produk, merek, kategori, cabang,
// dan kolom foto di bagian beranda yang tampil. Jenis yang tak dipakai form mana pun tidak ditampilkan.
const dariBagian = (fields: Field[]): PresetKey[] => fields.flatMap((f) => (f.type === 'image' || f.type === 'images' ? [f.preset] : f.type === 'list' ? dariBagian(f.fields) : []))
const DIPAKAI = new Set<PresetKey>(['product', 'brand', 'category', 'branch', ...SECTIONS.filter((s) => !s.hidden).flatMap((s) => dariBagian(s.fields))])

export default function Panduan() {
  return (
    <PageBody>
      <PageHeader title="Panduan ukuran foto" note="Ukuran dan rasio yang pas untuk tiap tempat foto di situs." />
      <Section title="Aturan umum">
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink">
          <li>Format: <b>JPG</b> untuk foto, <b>PNG transparan</b> atau <b>SVG</b> untuk logo dan ikon. WebP juga bisa. Foto HEIC dari iPhone ubah dulu ke JPG (di iPhone: Pengaturan, Kamera, Format, pilih Paling Kompatibel).</li>
          <li>Ukuran file maksimal 15 MB. Sistem otomatis memotong ke rasio yang benar, mengecilkan, lalu menyimpan sebagai WebP supaya web tetap cepat.</li>
          <li>Upload foto yang sama atau lebih besar dari ukuran di tabel. Foto kecil tetap bisa dipakai, tapi akan terlihat buram.</li>
          <li>Foto yang dipotong otomatis diarahkan ke bagian yang paling menarik. Kalau hasilnya kurang pas, potong dulu di HP sesuai rasio di tabel.</li>
          <li>Jangan taruh teks penting di foto produk. Nama, ukuran dan harga sudah ditulis otomatis oleh web.</li>
        </ul>
      </Section>
      <DataTable
        caption="Ukuran foto per tempat pemakaian"
        rows={(Object.keys(PRESETS) as PresetKey[]).filter((k) => DIPAKAI.has(k)).map((k) => PRESETS[k])}
        rowKey={(p) => p.label}
        columns={[
          { key: 'label', header: 'Dipakai untuk', className: 'w-56', cell: (p) => <span className="font-semibold text-ink">{p.label}</span> },
          { key: 'ukuran', header: 'Ukuran ideal', className: 'whitespace-nowrap', cell: (p) => `${p.w} × ${p.h} px` },
          { key: 'rasio', header: 'Rasio', className: 'whitespace-nowrap', cell: (p) => p.ratio },
          { key: 'cara', header: 'Cara dipotong', cell: (p) => (p.fit === 'cover' ? 'Dipotong penuh' : p.fit === 'contain' ? 'Utuh, sisa diberi latar' : 'Utuh, diperkecil') },
          { key: 'tips', header: 'Tips', cell: (p) => <span className="text-mute">{p.tip}</span> },
        ]}
      />
    </PageBody>
  )
}
