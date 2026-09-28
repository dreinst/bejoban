'use client'
import { useRouter } from 'next/navigation'
import { MapPin } from 'lucide-react'

export function BranchPicker({ branches, current }: { branches: { slug: string; name: string }[]; current: string }) {
  const router = useRouter()
  return (
    <label className="flex items-center gap-1.5 text-sm">
      <MapPin className="size-4 shrink-0" />
      <select
        value={current}
        aria-label="Pilih cabang"
        onChange={(e) => {
          document.cookie = `bejo_branch=${e.target.value}; path=/; max-age=31536000; samesite=lax`
          router.refresh()
        }}
        className="cursor-pointer bg-transparent font-medium outline-none"
      >
        {branches.map((b) => (
          <option key={b.slug} value={b.slug}>
            {b.name.replace(/^Bejo Ban /, '').replace(/ \(.*\)/, '')}
          </option>
        ))}
      </select>
    </label>
  )
}
