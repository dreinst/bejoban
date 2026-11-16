'use client'
import { useEffect } from 'react'

/**
 * Memperingatkan kalau ada isian yang diubah di form `formId` lalu pengguna pindah halaman tanpa menyimpan.
 * Menutup tab atau memuat ulang ditangani browser, tautan di dalam aplikasi ditangani di sini.
 */
export function PeringatanUbah({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId)
    if (!form) return
    let kotor = false
    const tandai = () => {
      kotor = true
    }
    const bersih = () => {
      kotor = false
    }
    const tutup = (e: BeforeUnloadEvent) => {
      if (kotor) e.preventDefault()
    }
    const klik = (e: MouseEvent) => {
      if (!kotor || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
      const a = (e.target as Element | null)?.closest('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.origin !== location.origin || a.pathname + a.search === location.pathname + location.search) return
      if (!window.confirm('Ada perubahan yang belum disimpan. Tinggalkan halaman ini?')) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    form.addEventListener('input', tandai)
    form.addEventListener('change', tandai)
    form.addEventListener('submit', bersih)
    window.addEventListener('beforeunload', tutup)
    document.addEventListener('click', klik, true)
    return () => {
      form.removeEventListener('input', tandai)
      form.removeEventListener('change', tandai)
      form.removeEventListener('submit', bersih)
      window.removeEventListener('beforeunload', tutup)
      document.removeEventListener('click', klik, true)
    }
  }, [formId])
  return null
}
