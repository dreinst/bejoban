'use client'
import { useOptimistic, useTransition } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { toast } from './toast-bus'

// Kontrol sunting cepat di baris tabel. Aksi server dipanggil langsung tanpa pindah halaman,
// lalu halaman diperbarui oleh revalidatePath di aksi. Aksi mengembalikan { ok } atau { err } untuk toast.
export type HasilAksi = { ok?: string; err?: string } | void
type Aksi = (fd: FormData) => Promise<HasilAksi>

const kirim = async (action: Aksi, fields: Record<string, string | number>) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, String(v))
  try {
    const r = await action(fd)
    if (r?.err) toast(r.err, 'err')
    else if (r?.ok) toast(r.ok)
  } catch {
    toast('Gagal menyimpan. Muat ulang halaman lalu coba lagi.', 'err')
  }
}

/**
 * Tombol naik dan turun untuk mengatur urutan. Aksi menerima `id` dan `arah` (naik | turun).
 * `label` dipakai untuk aria-label, mis. "Naikkan Hankook".
 */
export function ReorderButtons({ action, id, label, first, last }: { action: Aksi; id: number; label: string; first: boolean; last: boolean }) {
  const [pending, start] = useTransition()
  const go = (arah: 'naik' | 'turun') => start(() => kirim(action, { id, arah }))
  return (
    <span className="inline-flex gap-1" aria-busy={pending}>
      <button type="button" className="adm-icon-btn" onClick={() => go('naik')} disabled={first || pending} aria-label={`Naikkan ${label}`} title="Naikkan">
        <ArrowUp className="size-4" aria-hidden />
      </button>
      <button type="button" className="adm-icon-btn" onClick={() => go('turun')} disabled={last || pending} aria-label={`Turunkan ${label}`} title="Turunkan">
        <ArrowDown className="size-4" aria-hidden />
      </button>
    </span>
  )
}

/**
 * Sakelar yang langsung menyimpan (mis. by order, aktif). Aksi menerima `fields` plus `value` = 1 atau 0.
 * Tampilan berubah seketika dan kembali kalau aksi gagal.
 */
export function QuickToggle({ action, fields, checked, label, onText = 'Ya', offText = 'Tidak' }: { action: Aksi; fields: Record<string, string | number>; checked: boolean; label: string; onText?: string; offText?: string }) {
  const [pending, start] = useTransition()
  const [nyala, setNyala] = useOptimistic(checked)
  const ubah = () =>
    start(async () => {
      setNyala(!nyala)
      await kirim(action, { ...fields, value: nyala ? 0 : 1 })
    })
  return (
    <button type="button" role="switch" aria-checked={nyala} aria-label={label} onClick={ubah} disabled={pending} className="group inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-sm max-md:min-h-11">
      <span aria-hidden className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors ${nyala ? 'bg-ink' : 'bg-[#cfcfcf]'}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left] ${nyala ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      <span className={nyala ? 'font-semibold text-ink' : 'text-mute'}>{nyala ? onText : offText}</span>
    </button>
  )
}
