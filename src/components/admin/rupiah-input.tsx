'use client'
import { useState } from 'react'
import { inputCls } from './form-cls'

/** Kolom angka rupiah di tabel sunting cepat: nilai tetap angka polos, pratinjau "Rp 3.100.000" di bawahnya. */
export function RupiahInput({ name, label, defaultValue = '' }: { name: string; label: string; defaultValue?: string | number }) {
  const [v, setV] = useState(String(defaultValue))
  const n = Number(v.replace(/\D/g, '')) || 0
  return (
    <span className="inline-block w-32 align-middle">
      <input name={name} inputMode="numeric" aria-label={label} value={v} onChange={(e) => setV(e.target.value)} className={`${inputCls} min-h-10 text-right max-md:min-h-11`} />
      <span aria-hidden className="mt-0.5 block h-4 text-right text-[11px] leading-4 text-mute">{n > 0 ? `Rp ${n.toLocaleString('id-ID')}` : ''}</span>
    </span>
  )
}
