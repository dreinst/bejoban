// Ingatan singkat untuk panel samping yang gagal disimpan.
//
// Kenapa perlu: aksi server yang gagal mengalihkan ke alamat yang sama dengan ?err=pesan. Next memberi kunci
// segmen halaman berdasarkan query, jadi seluruh isi halaman dipasang ulang dan panel yang terbuka ikut hilang
// beserta ketikan di dalamnya. Di sini isian dicatat saat form dikirim, lalu panel yang sama dibuka lagi
// dengan isian yang sama dan galat tampil di dalamnya. Berkas ini sengaja bukan 'use client' supaya dipakai
// bersama oleh overlay.tsx dan toast.tsx. Isinya hanya hidup di memori tab, tidak disimpan ke mana pun.

export type Isian = [string, string][]
type Catatan = { path: string; judul: string; isian: Isian; form: number; err: string | null; waktu: number; diklaim: number }

// Catatan hanya berlaku sebentar: sampai respons server tiba, lalu beberapa detik untuk pemasangan ulang halaman.
const BATAS_MS = 60_000
const JENDELA_MS = 5_000
let catatan: Catatan | null = null
const basi = (c: Catatan) => Date.now() - c.waktu >= BATAS_MS

/** Dipanggil saat form di panel dikirim. */
export function catatKirim(path: string, judul: string, form: HTMLFormElement, akar?: Element | null) {
  const isian = [...new FormData(form)].filter((e): e is [string, string] => typeof e[1] === 'string')
  // Panel boleh berisi lebih dari satu form (mis. ubah pengguna dan ganti kata sandi). Yang dicatat urutan form yang dikirim.
  const form_ = [...((akar ?? form.closest('dialog'))?.querySelectorAll('form') ?? [])].indexOf(form)
  catatan = { path, judul, isian, form: Math.max(form_, 0), err: null, waktu: Date.now(), diklaim: 0 }
}

export const hapusCatatan = () => {
  catatan = null
}

/**
 * Dipanggil saat panel dipasang. Mengembalikan catatan bila panel ini harus terbuka lagi karena simpan ditolak.
 * Simpan berhasil (?ok=) menghapus catatan, jadi panel tertutup seperti biasa.
 */
export function lanjutkanPanel(path: string, judul: string, ok: string | null, err: string | null): Catatan | null {
  if (catatan && basi(catatan)) catatan = null
  if (!catatan || catatan.path !== path) return null
  if (ok) {
    catatan = null
    return null
  }
  if (catatan.judul !== judul) return null
  if (err && !catatan.diklaim) {
    catatan.err = err
    catatan.diklaim = Date.now()
  }
  // Halaman dipasang ulang dua kali berturut-turut (alamat ?err= muncul, lalu dibersihkan Toast), jadi jendela pendek.
  return catatan.diklaim && Date.now() - catatan.diklaim < JENDELA_MS ? catatan : null
}

/** Toast galat tidak perlu muncul bila panel sudah menampilkannya di dalam panel. */
export const galatSudahDiPanel = (path: string, err: string) => !!catatan && !basi(catatan) && catatan.path === path && catatan.err === err

function isi(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, nilai: string) {
  const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLSelectElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, nilai)
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
}

/** Mengisi ulang kolom form di dalam `akar` dari catatan. Kolom tersembunyi dan berkas dilewati. */
export function pulihkan(akar: HTMLElement, isian: Isian, urutanForm = 0) {
  const form = akar.querySelectorAll('form')[urutanForm]
  if (!form) return
  const per = new Map<string, string[]>()
  for (const [k, v] of isian) per.set(k, [...(per.get(k) ?? []), v])
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) continue
    if (!el.name || el.disabled) continue
    if (el instanceof HTMLInputElement && ['hidden', 'file', 'submit', 'button', 'reset', 'image'].includes(el.type)) continue
    const nilai = per.get(el.name)
    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      if (el.checked !== (nilai?.includes(el.value) ?? false)) el.click()
    } else if (el instanceof HTMLInputElement && el.type === 'radio') {
      if (nilai?.[0] === el.value && !el.checked) el.click()
    } else if (el.value !== (nilai?.[0] ?? '')) {
      isi(el, nilai?.[0] ?? '')
    }
  }
}
