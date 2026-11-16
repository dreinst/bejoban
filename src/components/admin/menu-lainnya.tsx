'use client'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'

// Menu "Lainnya" di ujung kartu HP: tombol 44 x 44 yang membuka daftar kecil berisi aksi yang jarang dipakai.
// Isi menu baru dipasang saat terbuka. Menu tetap terbuka selama dialog dari dalamnya tampil (dialog hidup di <body>),
// supaya fokus bisa kembali ke tombol pemicunya. Escape dan ketuk di luar menutup. Tidak tampil di layar lebar.
export function MenuLainnya({ children }: { children: ReactNode }) {
  const [buka, setBuka] = useState(false)
  const id = useId()
  const kotak = useRef<HTMLDivElement>(null)
  const tombol = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!buka) return
    const dalamDialog = (t: EventTarget | null) => t instanceof Element && !!t.closest('dialog')
    const klik = (e: MouseEvent) => {
      if (kotak.current?.contains(e.target as Node) || dalamDialog(e.target)) return
      setBuka(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || dalamDialog(e.target) || document.querySelector('dialog[open]')) return
      setBuka(false)
      tombol.current?.focus()
    }
    document.addEventListener('mousedown', klik)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', klik)
      document.removeEventListener('keydown', key)
    }
  }, [buka])

  return (
    <div ref={kotak} className="adm-lainnya relative md:hidden">
      <button ref={tombol} type="button" className="adm-icon-btn" aria-label="Lainnya" aria-expanded={buka} aria-controls={id} onClick={() => setBuka(!buka)}>
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      {buka && (
        <div id={id} className="adm-lainnya-isi">
          {children}
        </div>
      )}
    </div>
  )
}
