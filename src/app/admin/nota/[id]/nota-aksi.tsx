'use client'
import { toast } from '@/components/admin/toast-bus'

// Tombol cetak dan bagikan nota. Bagikan memakai Web Share (HP); kalau tidak tersedia, teks nota disalin.
export function TombolCetak() {
  return (
    <button type="button" onClick={() => window.print()} className="adm-btn min-h-11">
      Cetak
    </button>
  )
}

export function TombolBagikan({ teks, judul }: { teks: string; judul: string }) {
  return (
    <button
      type="button"
      className="adm-btn-line min-h-11"
      onClick={async () => {
        if (navigator.share) {
          try {
            await navigator.share({ title: judul, text: teks })
          } catch {}
          return
        }
        try {
          await navigator.clipboard.writeText(teks)
          toast('Perangkat ini belum bisa berbagi langsung. Teks nota sudah disalin.')
        } catch {
          toast('Teks nota tidak bisa dibagikan dari perangkat ini. Pakai tombol Salin teks.', 'err')
        }
      }}
    >
      Bagikan
    </button>
  )
}
