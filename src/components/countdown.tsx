'use client'
import { useEffect, useState } from 'react'

export function Countdown({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const left = Math.max(0, (now === null ? 0 : new Date(endsAt).getTime() - now) / 1000)
  const parts: [number, string][] = [[Math.floor(left / 86400), 'hari'], [Math.floor((left % 86400) / 3600), 'jam'], [Math.floor((left % 3600) / 60), 'menit'], [Math.floor(left % 60), 'detik']]
  return (
    <div className="flex gap-5 font-mono tabular-nums" aria-label="Sisa waktu">
      {parts.map(([v, l]) => (
        <div key={l} className="text-center">
          <p className="text-4xl font-semibold md:text-5xl">{now === null ? '00' : String(v).padStart(2, '0')}</p>
          <p className="mt-1 font-sans text-[11px] uppercase tracking-widest text-paper/60">{l}</p>
        </div>
      ))}
    </div>
  )
}
