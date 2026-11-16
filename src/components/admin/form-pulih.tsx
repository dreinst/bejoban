'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { catatKirim, lanjutkanPanel, pulihkan } from './panel-simpan'

/**
 * Pembungkus form di halaman (bukan di panel samping) supaya simpan yang ditolak server tidak menghapus ketikan.
 * Isian dicatat saat dikirim, lalu diisi ulang setelah halaman dipasang ulang, dan galatnya tampil di bawah form.
 * `nama` membedakan form kalau satu halaman punya beberapa.
 */
export function FormPulih({ nama, children }: { nama: string; children: ReactNode }) {
  const path = usePathname()
  const sp = useSearchParams()
  const [lanjut] = useState(() => lanjutkanPanel(path, `form:${nama}`, sp.get('ok'), sp.get('err')))
  const [galat, setGalat] = useState<string | null>(lanjut?.err ?? null)
  const akar = useRef<HTMLDivElement>(null)
  const sisa = useRef(lanjut)

  useEffect(() => {
    if (sisa.current && akar.current) pulihkan(akar.current, sisa.current.isian, sisa.current.form)
    sisa.current = null
  }, [])

  return (
    <div
      ref={akar}
      onSubmit={(e) => {
        if (!(e.target instanceof HTMLFormElement)) return
        // Cari urutan form di dalam pembungkus ini, bukan di dialog.
        catatKirim(path, `form:${nama}`, e.target, akar.current)
        setGalat(null)
      }}
    >
      {children}
      {galat && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{galat}</p>}
    </div>
  )
}
