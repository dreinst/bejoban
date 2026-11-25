'use client'
import { useRouter } from 'next/navigation'

// Saringan satu pilihan untuk daftar yang opsinya banyak (mis. cabang), pengganti deretan chip.
// Tiap opsi membawa alamat tujuannya; memilih langsung berpindah halaman.
export function SaringSelect({ label, value, options }: { label: string; value: string; options: { href: string; label: string; value: string }[] }) {
  const router = useRouter()
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-mute">
      {label}
      <select
        value={value}
        onChange={(e) => {
          const o = options.find((x) => x.value === e.target.value)
          if (o) router.push(o.href)
        }}
        className="min-h-10 rounded-lg border border-[#cfcfcf] bg-white px-3 py-2 text-sm font-normal text-ink outline-none focus:border-accent-deep focus:ring-2 focus:ring-accent/30 max-md:min-h-11"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}
