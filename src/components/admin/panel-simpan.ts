// Ingatan singkat untuk panel samping yang gagal disimpan.
//
// Kenapa perlu: aksi server yang gagal mengalihkan ke alamat yang sama dengan ?err=pesan. Next memberi kunci
// segmen halaman berdasarkan query, jadi seluruh isi halaman dipasang ulang dan panel yang terbuka ikut hilang
// beserta ketikan di dalamnya. Di sini isian dicatat saat form dikirim, lalu panel yang sama dibuka lagi
// dengan isian yang sama dan galat tampil di dalamnya. Berkas ini sengaja bukan 'use client' supaya dipakai
// bersama oleh overlay.tsx dan toast.tsx.
//
// Tempat penyimpanan: satu variabel `catatan` di memori modul ini, artinya di memori tab peramban yang sedang
// terbuka. Tidak ada localStorage, sessionStorage, cookie, atau kiriman ke server, dan hilang saat tab dimuat ulang.
// Isian bertipe password tidak pernah dicatat. Catatan dihapus saat: simpan berhasil, panel ditutup, panel selesai
// dipulihkan, pindah ke halaman lain, keluar dari akun, atau lewat batas waktu.

export type Isian = [string, string][]
type Catatan = { path: string; judul: string; isian: Isian; form: number; err: string | null; waktu: number; diklaim: number }

/** Hasil `lanjutkanPanel`. Isian hanya bisa diambil sekali: setelah `ambil()` salinan di sini ikut hilang. */
export type Lanjutan = { err: string | null; form: number; ambil: () => Isian | null }

// Catatan hanya berlaku sebentar: sampai respons server tiba, lalu beberapa detik untuk pemasangan ulang halaman.
const BATAS_MS = 60_000
const JENDELA_MS = 5_000
let catatan: Catatan | null = null
let pengatur: ReturnType<typeof setTimeout> | null = null
const basi = (c: Catatan) => Date.now() - c.waktu >= BATAS_MS

const jadwalHapus = (ms: number) => {
  if (pengatur) clearTimeout(pengatur)
  pengatur = setTimeout(hapusCatatan, ms)
}

/** Kolom yang tidak boleh dicatat sama sekali: tipe password atau kolom yang mengaku kata sandi lewat autocomplete. */
const rahasia = (el: Element) => el instanceof HTMLInputElement && (el.type === 'password' || /password/i.test(el.autocomplete))

/** Dipanggil saat form di panel dikirim. */
export function catatKirim(path: string, judul: string, form: HTMLFormElement, akar?: Element | null) {
  const sandi = new Set(Array.from(form.elements).filter(rahasia).map((el) => (el as HTMLInputElement).name))
  const isian = [...new FormData(form)].filter((e): e is [string, string] => typeof e[1] === 'string' && !sandi.has(e[0]))
  // Panel boleh berisi lebih dari satu form (mis. ubah pengguna dan ganti kata sandi). Yang dicatat urutan form yang dikirim.
  const form_ = [...((akar ?? form.closest('dialog'))?.querySelectorAll('form') ?? [])].indexOf(form)
  catatan = { path, judul, isian, form: Math.max(form_, 0), err: null, waktu: Date.now(), diklaim: 0 }
  jadwalHapus(BATAS_MS)
}

export function hapusCatatan() {
  catatan = null
  if (pengatur) clearTimeout(pengatur)
  pengatur = null
}

/**
 * Dipanggil saat panel dipasang. Mengembalikan catatan bila panel ini harus terbuka lagi karena simpan ditolak.
 * Simpan berhasil (?ok=) menghapus catatan, jadi panel tertutup seperti biasa.
 * Halaman dipasang dua kali berturut-turut: pertama saat alamat memuat ?err=, kedua setelah Toast membersihkan
 * alamatnya. Pemasangan kedua (tanpa ?err=) adalah pemakaian terakhir, jadi catatan langsung dihapus.
 */
export function lanjutkanPanel(path: string, judul: string, ok: string | null, err: string | null): Lanjutan | null {
  // Catatan dari halaman lain (mis. sesi habis lalu dialihkan ke login) tidak berguna lagi.
  if (catatan && (basi(catatan) || catatan.path !== path)) hapusCatatan()
  if (!catatan) return null
  if (ok) {
    hapusCatatan()
    return null
  }
  if (catatan.judul !== judul) return null
  if (err && !catatan.diklaim) {
    catatan.err = err
    catatan.diklaim = Date.now()
    jadwalHapus(JENDELA_MS)
  }
  if (!catatan.diklaim || Date.now() - catatan.diklaim >= JENDELA_MS) return null
  let isian: Isian | null = catatan.isian
  const hasil: Lanjutan = {
    err: catatan.err,
    form: catatan.form,
    ambil: () => {
      const x = isian
      isian = null
      return x
    },
  }
  if (!err) setTimeout(hapusCatatan, 0)
  return hasil
}

/** Toast galat tidak perlu muncul bila panel sudah menampilkannya di dalam panel. */
export const galatSudahDiPanel = (path: string, err: string) => !!catatan && !basi(catatan) && catatan.path === path && catatan.err === err

// ---- Memulihkan isian ----

export type Kontrol = { name: string; type: string; value: string; checked: boolean; disabled: boolean }
export type Langkah = { i: number; aksi: 'klik' } | { i: number; aksi: 'isi'; nilai: string }

const DILEWATI = ['hidden', 'file', 'submit', 'button', 'reset', 'image', 'password', 'select-multiple']

/**
 * Menentukan apa yang perlu dilakukan supaya tiap kolom kembali persis seperti saat form dikirim.
 * Kotak centang dan pilihan hanya diklik kalau keadaannya berbeda: yang tercentang waktu dikirim tercentang,
 * yang tidak (tidak ada di data kiriman) tidak tercentang. Kolom tersembunyi, berkas, dan password dilewati.
 */
export function rencanaPulih(kontrol: Kontrol[], isian: Isian): Langkah[] {
  const per = new Map<string, string[]>()
  for (const [k, v] of isian) per.set(k, [...(per.get(k) ?? []), v])
  const langkah: Langkah[] = []
  kontrol.forEach((el, i) => {
    if (!el.name || el.disabled || DILEWATI.includes(el.type)) return
    const nilai = per.get(el.name)
    if (el.type === 'checkbox') {
      if (el.checked !== (nilai?.includes(el.value) ?? false)) langkah.push({ i, aksi: 'klik' })
    } else if (el.type === 'radio') {
      if (nilai?.[0] === el.value && !el.checked) langkah.push({ i, aksi: 'klik' })
    } else if (el.value !== (nilai?.[0] ?? '')) {
      langkah.push({ i, aksi: 'isi', nilai: nilai?.[0] ?? '' })
    }
  })
  return langkah
}

type Elemen = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

function isi(el: Elemen, nilai: string) {
  const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLSelectElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, nilai)
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
}

/** Mengisi ulang kolom form di dalam `akar` dari catatan. */
export function pulihkan(akar: HTMLElement, isian: Isian, urutanForm = 0) {
  const form = akar.querySelectorAll('form')[urutanForm]
  if (!form) return
  const el = Array.from(form.elements).filter((x): x is Elemen => x instanceof HTMLInputElement || x instanceof HTMLTextAreaElement || x instanceof HTMLSelectElement)
  const kontrol: Kontrol[] = el.map((x) => ({ name: x.name, type: x.type, value: x.value, checked: x instanceof HTMLInputElement && x.checked, disabled: x.disabled }))
  for (const l of rencanaPulih(kontrol, isian)) {
    if (l.aksi === 'klik') el[l.i].click()
    else isi(el[l.i], l.nilai)
  }
}

// ---- Galat di dekat tombol simpan ----

/**
 * Menaruh pesan galat di slot `[data-galat-slot]` di atas baris tombol form nomor `urutanForm` di dalam `akar`
 * (slot ada di FormActions dan TemplateForm). Pesan kosong membersihkan semua slot di `akar`.
 * Mengembalikan true bila ada slot yang dipakai; kalau false, pemanggil menampilkan galat di tempat cadangan.
 */
export function tampilkanGalat(akar: HTMLElement, urutanForm: number, pesan: string | null): boolean {
  akar.querySelectorAll<HTMLElement>('[data-galat-slot]').forEach((s) => {
    s.textContent = ''
  })
  if (!pesan) return false
  const slot = akar.querySelectorAll('form')[urutanForm]?.querySelector<HTMLElement>('[data-galat-slot]')
  if (!slot) return false
  slot.textContent = pesan
  return true
}
