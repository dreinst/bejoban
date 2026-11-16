// Templat pesan bot. Semua kalimat bot berasal dari sini dan bisa diedit admin.
import { renderTemplate } from '../text/template'

export const TEMPLATE_KEYS = [
  'sapaan',
  'tanyaUkuran',
  'stokAda',
  'jasaAda',
  'tanyaCabang',
  'cabangDiganti',
  'serahAdmin',
  'tersediaCabangLain',
  'merekByOrder',
  'ringkasanAdmin',
  'penutupTidakTersedia',
  'diLuarJam',
] as const
export type TemplateKey = (typeof TEMPLATE_KEYS)[number]
export type Templates = Record<TemplateKey, string>

export const TEMPLATE_INFO: Record<TemplateKey, { label: string; when: string; vars: string[] }> = {
  sapaan: { label: 'Sapaan', when: 'Pesan pembuka dari tombol situs, belum menyebut ukuran.', vars: ['cabang'] },
  tanyaUkuran: { label: 'Minta ukuran', when: 'Pelanggan bertanya stok atau harga tanpa ukuran yang jelas.', vars: ['cabang'] },
  stokAda: { label: 'Jawaban stok ada', when: 'Ukuran ada di data dan stoknya lebih dari 0. Harga dan stok dari database.', vars: ['cabang', 'ukuran', 'daftar'] },
  jasaAda: { label: 'Jawaban harga jasa', when: 'Jasa (spooring, balance, nitrogen, dan lain-lain) ada di tabel harga jasa.', vars: ['cabang', 'jasa', 'daftar'] },
  tanyaCabang: { label: 'Tanya cabang', when: 'Dikirim kalau cabang belum diketahui, sebelum menyebut stok yang tercatat per cabang atau sebelum serah terima. Jawaban berupa angka.', vars: ['pilihan'] },
  cabangDiganti: { label: 'Cabang diganti', when: 'Pelanggan memilih atau mengganti cabang.', vars: ['cabang'] },
  serahAdmin: { label: 'Serah ke admin', when: 'Tidak ada, stok 0, harga kosong, atau pesan tidak dikenali. Dikirim ke pelanggan.', vars: ['cabang', 'ukuran', 'nomorAdmin', 'kontakAdmin'] },
  tersediaCabangLain: {
    label: 'Tersedia di cabang lain',
    when: 'Stok per cabang menyala, stok di cabang pelanggan kosong tapi cabang lain punya. Tidak menyebut angka stok atau harga cabang lain, lalu diserahkan ke admin cabang pelanggan.',
    vars: ['cabang', 'cabangLain', 'ukuran', 'nomorAdmin', 'kontakAdmin'],
  },
  merekByOrder: {
    label: 'Merek by order',
    when: 'Pelanggan menanyakan merek berstatus by order (diatur di menu Merek) dan stoknya kosong. Lalu diserahkan ke admin cabang.',
    vars: ['merek', 'cabang', 'ukuran', 'nomorAdmin', 'kontakAdmin'],
  },
  ringkasanAdmin: { label: 'Ringkasan untuk admin', when: 'Dikirim ke nomor admin atau owner saat percakapan diserahkan.', vars: ['cabang', 'pelanggan', 'pertanyaan', 'hasil'] },
  penutupTidakTersedia: { label: 'Penutup tidak tersedia', when: 'Dikirim saat admin menandai barang tidak tersedia.', vars: ['cabang', 'ukuran'] },
  diLuarJam: { label: 'Di luar jam aktif', when: 'Pesan masuk di luar jam aktif bot.', vars: ['cabang', 'jamBuka'] },
}

export const DEFAULT_TEMPLATES: Templates = {
  sapaan: 'Halo kak, selamat datang di {cabang}. Kakak cari ban ukuran berapa? Contohnya 185/65 R15, nanti saya cek stok dan harganya.',
  tanyaUkuran: 'Boleh tahu ukuran bannya, kak? Contohnya 185/65 R15 atau 165-13, nanti saya cek stok dan harganya.',
  stokAda: 'Ini yang tersedia untuk ukuran {ukuran}, kak:\n{daftar}\nStok bisa berubah mengikuti kiriman distributor, jadi nanti dikonfirmasi lagi saat kakak pesan ya.',
  jasaAda: 'Untuk {jasa}, kak:\n{daftar}\nMau dijadwalkan ke {cabang}, kak?',
  tanyaCabang: 'Supaya admin yang membalas sesuai, kakak pilih cabangnya ya:\n{pilihan}\nBalas dengan angka saja, misalnya 1.',
  cabangDiganti: 'Siap kak, cabang kakak sekarang {cabang}.',
  serahAdmin: 'Terima kasih kak, pertanyaannya kami teruskan ke admin {cabang} untuk dicek langsung. Admin akan membalas di chat ini. {kontakAdmin}',
  tersediaCabangLain: 'Mohon maaf kak, {ukuran} sedang kosong di {cabang}, tapi tersedia di cabang {cabangLain}. Pertanyaannya kami teruskan ke admin {cabang} supaya bisa dibantu, admin akan membalas di chat ini ya. {kontakAdmin}',
  merekByOrder: 'Untuk {merek} ukuran {ukuran}, stoknya belum ada di {cabang}, kak, tapi bisa dipesan dulu. Pertanyaannya kami teruskan ke admin {cabang} untuk info harga dan perkiraan waktu datangnya, admin akan membalas di chat ini ya. {kontakAdmin}',
  ringkasanAdmin: 'Ada pertanyaan yang perlu dijawab.\nCabang: {cabang}\nPelanggan: {pelanggan}\nPertanyaan: {pertanyaan}\nHasil pencarian: {hasil}',
  penutupTidakTersedia: 'Mohon maaf kak, {ukuran} belum tersedia di {cabang} saat ini. Terima kasih sudah menghubungi kami, kabari saja kalau butuh ukuran lain ya.',
  diLuarJam: 'Halo kak, terima kasih sudah menghubungi {cabang}. Saat ini kami di luar jam layanan ({jamBuka}). Pesan kakak sudah kami terima dan akan dibalas pada jam buka ya.',
}

export const mergeTemplates = (saved: Partial<Templates> | null | undefined): Templates => {
  const out = { ...DEFAULT_TEMPLATES }
  for (const k of TEMPLATE_KEYS) if (typeof saved?.[k] === 'string' && saved[k]!.trim()) out[k] = saved[k]!.slice(0, 1000)
  return out
}

// Contoh isi variabel untuk pratinjau.
export const SAMPLE_VARS: Record<string, string> = {
  cabang: 'Bejo Ban Batu',
  ukuran: '185/65 R15',
  jasa: 'spooring',
  pilihan: '1. Bejo Ban Batu\n2. Bejo Ban Karanglo',
  daftar: '- Merek Contoh A: Rp 600.000, stok 5\n- Merek Contoh B: Rp 650.000 (harga asal Rp 700.000, potongan Rp 50.000), stok 2',
  nomorAdmin: '0812 0000 0000',
  kontakAdmin: 'Kalau perlu cepat, kakak bisa hubungi admin di 0812 0000 0000.',
  pelanggan: '0857 0000 0000',
  pertanyaan: 'Halo kak Bejo Ban Batu, ada ban 185/65 R15?',
  hasil: 'Ukuran 185/65R15: stok 0 di semua baris (3 baris)',
  jamBuka: '08.00 sampai 17.00',
  cabangLain: 'Bejo Ban Karanglo',
  merek: 'Merek Contoh',
}

export const preview = (tpl: string) => renderTemplate(tpl, SAMPLE_VARS)

// ---- Templat balasan otomatis media sosial (disalin admin, tanpa integrasi API) ----
export const CHANNELS = ['instagram', 'facebook', 'tiktok'] as const
export type Channel = (typeof CHANNELS)[number]
export const CHANNEL_LABEL: Record<Channel, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' }
export type Sosmed = Record<Channel, string>

export const DEFAULT_SOSMED: Sosmed = {
  instagram: 'Halo kak, terima kasih sudah menghubungi Bejo Ban. Untuk stok dan harga ban, silakan chat WhatsApp kami ya, pilih cabang yang terdekat:\n{tautanWa}',
  facebook: 'Halo kak, terima kasih sudah menghubungi Bejo Ban. Untuk stok dan harga ban, silakan chat WhatsApp kami ya, pilih cabang yang terdekat:\n{tautanWa}',
  tiktok: 'Halo kak, terima kasih sudah menghubungi Bejo Ban. Stok dan harga ban kami jawab lewat WhatsApp ya, pilih cabangnya:\n{tautanWa}',
}

export const mergeSosmed = (saved: Partial<Sosmed> | null | undefined): Sosmed => {
  const out = { ...DEFAULT_SOSMED }
  for (const k of CHANNELS) if (typeof saved?.[k] === 'string' && saved[k]!.trim()) out[k] = saved[k]!.slice(0, 1000)
  return out
}
