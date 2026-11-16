'use client'
import { useId, useState } from 'react'

/** Pilih berkas dengan teks bahasa Indonesia (tombol bawaan browser tergantung bahasa perangkat). */
export function BerkasInput({ label, name, accept, hint }: { label: string; name: string; accept?: string; hint?: string }) {
  const id = useId()
  const [nama, setNama] = useState('')
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-neutral-700">{label}</label>
      <div className="flex flex-wrap items-center gap-3">
        <input id={id} type="file" name={name} accept={accept} className="peer sr-only" onChange={(e) => setNama(e.target.files?.[0]?.name ?? '')} />
        <label htmlFor={id} className="adm-btn-line adm-btn-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">Pilih berkas</label>
        <span className="min-w-0 text-sm text-mute [overflow-wrap:anywhere]">{nama || 'Belum ada berkas dipilih'}</span>
      </div>
      {hint && <p className="mt-1 text-xs leading-snug text-mute">{hint}</p>}
    </div>
  )
}
