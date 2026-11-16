'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { catatKirim, lanjutkanPanel, pulihkan, tampilkanGalat } from './panel-simpan'

/**
 * Pembungkus form di halaman (bukan di panel samping) supaya simpan yang ditolak server tidak menghapus ketikan.
 * Isian dicatat saat dikirim, lalu diisi ulang setelah halaman dipasang ulang, dan galatnya tampil tepat di atas baris tombol.
 * `nama` membedakan form kalau satu halaman punya beberapa.
 */
export function FormPulih({ nama, children }: { nama: string; children: ReactNode }) {
  const path = usePathname()
  const sp = useSearchParams()
  const [lanjut] = useState(() => lanjutkanPanel(path, `form:${nama}`, sp.get('ok'), sp.get('err')))
  const [galat, setGalat] = useState<string | null>(lanjut?.err ?? null)
  const [formGalat, setFormGalat] = useState(lanjut?.form ?? 0)
  const akar = useRef<HTMLDivElement>(null)
  const cadangan = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const isian = lanjut?.ambil()
    if (isian && akar.current) pulihkan(akar.current, isian, lanjut?.form)
  }, [lanjut])

  // Galat di slot dekat tombol simpan; di bawah form hanya kalau form tidak punya slot.
  useEffect(() => {
    if (!akar.current) return
    const dipakai = tampilkanGalat(akar.current, formGalat, galat)
    if (cadangan.current) cadangan.current.textContent = galat && !dipakai ? galat : ''
  }, [galat, formGalat])

  return (
    <div
      ref={akar}
      onSubmit={(e) => {
        if (!(e.target instanceof HTMLFormElement)) return
        // Cari urutan form di dalam pembungkus ini, bukan di dialog.
        catatKirim(path, `form:${nama}`, e.target, akar.current)
        setFormGalat(Math.max(Array.from(akar.current?.querySelectorAll('form') ?? []).indexOf(e.target), 0))
        setGalat(null)
      }}
    >
      {children}
      <p ref={cadangan} role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 empty:hidden" />
    </div>
  )
}
