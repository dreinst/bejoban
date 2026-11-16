// Pengaturan situs publik: nomor WhatsApp utama, kalimat pembuka, dan tampil atau tidaknya harga.
import { renderTemplate } from './text/template'
import { waLink } from './format'

export type Situs = {
  mainWhatsapp: string // satu nomor untuk semua cabang; kosong = pakai nomor tiap cabang
  showPrices: boolean // bawaan mati
  openers: { umum: string; produk: string }
}

export const DEFAULT_SITUS: Situs = {
  mainWhatsapp: '',
  showPrices: false,
  openers: {
    umum: 'Halo kak {cabang}, saya mau tanya stok dan harga ban.',
    produk: 'Halo kak {cabang}, saya mau tanya {produk}.',
  },
}

export const mergeSitus = (saved: Partial<Situs> | null | undefined): Situs => ({
  ...DEFAULT_SITUS,
  ...saved,
  openers: { ...DEFAULT_SITUS.openers, ...saved?.openers },
})

// "Bejo Ban Batu (Hankook Masters)" menjadi "Bejo Ban Batu"
export const branchLabel = (name: string) => name.replace(/\s*\(.*\)\s*/, '').trim()

/**
 * Alamat situs untuk tautan pendek yang disalin ke bio dan balasan otomatis. `SITE_URL` menang kalau diisi
 * (tanpa garis miring di akhir), supaya teks tidak memuat alamat IP saat admin dibuka lewat IP.
 * Kalau kosong, dipakai alamat dari header permintaan.
 */
export function alamatSitusDari(siteUrl: string | undefined, proto: string | null, host: string | null) {
  const tetap = (siteUrl ?? '').trim().replace(/\/+$/, '')
  if (/^https?:\/\/\S+$/i.test(tetap)) return tetap
  return `${proto ?? 'http'}://${host ?? 'localhost'}`
}

/** Daftar tautan pendek per cabang, satu baris per cabang, untuk disalin ke aplikasi sosial media. */
export const daftarTautanWa = (cabang: { name: string; slug: string }[], origin: string) =>
  cabang.map((b) => `- ${branchLabel(b.name)}: ${origin}/wa/${b.slug}`).join('\n')

export type WaBranch = { name: string; whatsapp: string }

export const waNumber = (s: Situs, b: WaBranch) => s.mainWhatsapp.trim() || b.whatsapp

export function waHref(s: Situs, b: WaBranch, kind: keyof Situs['openers'], vars: Record<string, string> = {}, extra = '') {
  const text = renderTemplate(s.openers[kind], { cabang: branchLabel(b.name), ...vars }) + extra
  return waLink(waNumber(s, b), text)
}
