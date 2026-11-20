'use client'
// Penerima siaran kasir (Server-Sent Events dari /api/kasir/siaran). Satu koneksi per tab, dibagi semua pendengar.
// - SiaranAdmin (dipasang di layout admin): toast untuk pengajuan diskon, keputusan owner, dan peringatan stok.
// - SegarkanSaatSiaran: muat ulang data halaman saat ada perubahan yang relevan, dan saat tab aktif kembali
//   (koneksi bisa putus selama tab tersembunyi atau HP terkunci).
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { toast } from './toast-bus'

type Jenis = 'stok' | 'transaksi' | 'pengajuan' | 'keputusan' | 'peringatan'
type Data = { cabangId: number | null; pesan: string | null }
type Fn = (jenis: Jenis, d: Data) => void

const JENIS: Jenis[] = ['stok', 'transaksi', 'pengajuan', 'keputusan', 'peringatan']
const pendengar = new Set<Fn>()
let es: EventSource | null = null

function sambung() {
  if (es || typeof window === 'undefined') return
  es = new EventSource('/api/kasir/siaran')
  for (const j of JENIS)
    es.addEventListener(j, (e) => {
      let d: Data = { cabangId: null, pesan: null }
      try {
        d = JSON.parse((e as MessageEvent).data)
      } catch {}
      for (const fn of pendengar) fn(j, d)
    })
}

function pasang(fn: Fn) {
  pendengar.add(fn)
  sambung()
  return () => {
    pendengar.delete(fn)
    if (!pendengar.size && es) {
      es.close()
      es = null
    }
  }
}

export function SiaranAdmin({ owner }: { owner: boolean }) {
  useEffect(
    () =>
      pasang((j, d) => {
        if (!d.pesan) return
        if (j === 'keputusan' || j === 'peringatan' || (j === 'pengajuan' && owner)) toast(d.pesan)
      }),
    [owner],
  )
  return null
}

export function SegarkanSaatSiaran({ jenis, cabangId }: { jenis: Jenis[]; cabangId?: number | null }) {
  const router = useRouter()
  const jeda = useRef<ReturnType<typeof setTimeout> | null>(null)
  const kunci = jenis.join(',')
  useEffect(() => {
    const daftar = kunci.split(',') as Jenis[]
    // Beberapa siaran berdekatan digabung jadi satu muat ulang.
    const segarkan = () => {
      if (jeda.current) clearTimeout(jeda.current)
      jeda.current = setTimeout(() => router.refresh(), 250)
    }
    const lepas = pasang((j, d) => {
      if (daftar.includes(j) && (cabangId === undefined || cabangId === null || d.cabangId === null || d.cabangId === cabangId)) segarkan()
    })
    const tampil = () => {
      if (document.visibilityState === 'visible') segarkan()
    }
    document.addEventListener('visibilitychange', tampil)
    return () => {
      lepas()
      document.removeEventListener('visibilitychange', tampil)
      if (jeda.current) clearTimeout(jeda.current)
    }
  }, [kunci, cabangId, router])
  return null
}
