'use client'
import { useRouter } from 'next/navigation'

// Saringan ringkas untuk HP: satu baris pilihan berlabel (mis. Ring, Cabang, Keadaan) pengganti deretan chip.
// Tiap pilihan membawa alamat tujuannya, jadi memilih langsung berpindah halaman. Chip tetap dipakai di layar lebar.
export type KelompokSaring = { label: string; options: { href: string; label: string; active: boolean }[] }

export function SaringHp({ kelompok }: { kelompok: KelompokSaring[] }) {
  const router = useRouter()
  return (
    <div className="grid gap-2 md:hidden" style={{ gridTemplateColumns: `repeat(${kelompok.length}, minmax(0, 1fr))` }}>
      {kelompok.map((k) => (
        <label key={k.label} className="block min-w-0">
          <span className="mb-0.5 block text-xs font-semibold text-mute">{k.label}</span>
          <select
            aria-label={k.label}
            value={k.options.find((o) => o.active)?.href ?? ''}
            onChange={(e) => router.push(e.target.value)}
            className="min-h-11 w-full min-w-0 rounded-lg border border-[#cfcfcf] bg-white px-2 text-sm text-ink"
          >
            {k.options.map((o) => <option key={o.href} value={o.href}>{o.label}</option>)}
          </select>
        </label>
      ))}
    </div>
  )
}
