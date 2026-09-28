import { PRESETS } from '@/lib/images-presets'

export default function Panduan() {
  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="text-2xl font-bold text-ink">Panduan Ukuran Foto</h1>
      <div className="rounded-xl bg-white p-5 text-sm leading-relaxed shadow-sm">
        <p className="font-semibold text-ink">Aturan umum</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Format: <b>JPG</b> untuk foto, <b>PNG transparan</b> atau <b>SVG</b> untuk logo dan ikon. WebP juga bisa. Foto HEIC dari iPhone ubah dulu ke JPG (di iPhone: Pengaturan, Kamera, Format, pilih Paling Kompatibel).</li>
          <li>Ukuran file maksimal 15 MB. Sistem otomatis memotong ke rasio yang benar, mengecilkan, lalu menyimpan sebagai WebP supaya web tetap cepat.</li>
          <li>Upload foto yang sama atau lebih besar dari ukuran di tabel. Foto kecil tetap bisa dipakai, tapi akan terlihat buram.</li>
          <li>Foto yang dipotong otomatis diarahkan ke bagian yang paling menarik. Kalau hasilnya kurang pas, potong dulu di HP sesuai rasio di tabel.</li>
          <li>Jangan taruh teks penting di foto produk. Nama, ukuran dan harga sudah ditulis otomatis oleh web.</li>
        </ul>
      </div>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr><th className="p-3">Dipakai untuk</th><th className="p-3">Ukuran ideal</th><th className="p-3">Rasio</th><th className="p-3">Cara upload</th><th className="p-3">Tips</th></tr>
          </thead>
          <tbody>
            {Object.values(PRESETS).map((p) => (
              <tr key={p.label} className="border-t border-neutral-100">
                <td className="p-3 font-semibold text-ink">{p.label}</td>
                <td className="p-3">{p.w} × {p.h} px</td>
                <td className="p-3">{p.ratio}</td>
                <td className="p-3">{p.fit === 'cover' ? 'Dipotong penuh' : p.fit === 'contain' ? 'Utuh, sisa diberi latar' : 'Utuh, diperkecil'}</td>
                <td className="p-3 text-neutral-600">{p.tip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
