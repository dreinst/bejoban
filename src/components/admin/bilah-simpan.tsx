'use client'
import { useEffect, useState } from 'react'
import { SubmitButton } from './overlay'

// Kolom tabel sunting cepat diberi nama p<id>_<kolom>. Yang dihitung satu baris adalah satu <id>.
const POLA = /^p(\d+)_/

const nilai = (el: HTMLInputElement) => (el.type === 'checkbox' ? String(el.checked) : el.value.trim())

/**
 * Bilah simpan yang menempel di dasar area konten untuk form tabel sunting cepat. Hanya muncul kalau ada isian
 * yang berbeda dari keadaan saat halaman dimuat, dan menyebut berapa baris yang berubah. Harus berada di dalam
 * form-nya. Halaman diberi ruang kosong di bawah tabel supaya tidak ada baris yang tertutup bilah.
 */
export function BilahSimpan({ formId, children }: { formId: string; children: string }) {
  const [berubah, setBerubah] = useState(0)

  useEffect(() => {
    const form = document.getElementById(formId)
    if (!form) return
    const kolom = () => Array.from(form.querySelectorAll<HTMLInputElement>('input[name]')).filter((el) => POLA.test(el.name))
    const awal = new Map(kolom().map((el) => [el.name, nilai(el)]))
    const hitung = () => {
      const baris = new Set<string>()
      for (const el of kolom()) if (awal.get(el.name) !== nilai(el)) baris.add(el.name.match(POLA)![1])
      setBerubah(baris.size)
    }
    form.addEventListener('input', hitung)
    form.addEventListener('change', hitung)
    return () => {
      form.removeEventListener('input', hitung)
      form.removeEventListener('change', hitung)
    }
  }, [formId])

  return (
    <div
      hidden={berubah === 0}
      className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-line bg-white px-4 py-3 shadow-[0_-6px_16px_-10px_rgba(0,0,0,.25)] md:left-60 md:px-8"
    >
      <p role="status" className="min-w-0 text-sm text-ink">
        {berubah > 0 && <><b>{berubah.toLocaleString('id-ID')} baris</b> diubah, belum disimpan.</>}
      </p>
      <SubmitButton className="adm-btn shrink-0">{children}</SubmitButton>
    </div>
  )
}
