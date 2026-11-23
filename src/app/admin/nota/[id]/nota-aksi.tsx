'use client'
import { useEffect } from 'react'
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

// Kertas gulung (58 dan 80 mm): tinggi halaman cetak = tinggi isi nota ditambah margin atas dan bawah, supaya printer
// thermal memakai lebar kertas yang benar dan tidak menyisakan kertas kosong. Diukur ulang tepat sebelum mencetak.
export function UkuranKertas({ isiId, lebar, margin }: { isiId: string; lebar: string; margin: string }) {
  useEffect(() => {
    // Ditaruh di akhir body, sesudah <style> cadangan halaman nota, supaya aturan @page ini yang berlaku.
    const gaya = document.createElement('style')
    document.body.append(gaya)
    const vertikal = Number.parseFloat(margin) * 2
    const atur = () => {
      const isi = document.getElementById(isiId)
      if (!isi) return
      const tinggi = Math.ceil((isi.getBoundingClientRect().height * 25.4) / 96 + vertikal + 6)
      gaya.textContent = `@media print { @page { size: ${lebar} ${tinggi}mm; margin: ${margin}; } }`
    }
    atur()
    window.addEventListener('beforeprint', atur)
    window.addEventListener('resize', atur)
    return () => {
      window.removeEventListener('beforeprint', atur)
      window.removeEventListener('resize', atur)
      gaya.remove()
    }
  }, [isiId, lebar, margin])
  return null
}
