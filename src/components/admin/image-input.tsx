'use client'
import { useRef, useState } from 'react'
import { PRESETS, type PresetKey } from '@/lib/images-presets'

/* eslint-disable @next/next/no-img-element */
async function upload(file: File, preset: PresetKey) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('preset', preset)
  const r = await fetch('/admin/upload', { method: 'POST', body: fd })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || 'Upload gagal')
  return j.url as string
}

export function SizeHint({ preset }: { preset: PresetKey }) {
  const p = PRESETS[preset]
  return (
    <p className="text-[11px] leading-snug text-neutral-500">
      Disarankan <b>{p.w}×{p.h} px</b> (rasio {p.ratio}). {p.tip}
    </p>
  )
}

export function ImagesInput({ value, onChange, preset, max, name }: { value: string[]; onChange?: (v: string[]) => void; preset: PresetKey; max: number; name?: string }) {
  const [list, setList] = useState(value)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  const p = PRESETS[preset]
  const set = (v: string[]) => {
    setList(v)
    onChange?.(v)
  }
  const pick = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setErr('')
    try {
      const urls: string[] = []
      for (const f of [...files].slice(0, max - list.length)) urls.push(await upload(f, preset))
      set([...list, ...urls])
    } catch (e) {
      setErr((e as Error).message)
    }
    setBusy(false)
    if (ref.current) ref.current.value = ''
  }
  const move = (i: number, d: number) => {
    const n = [...list]
    ;[n[i], n[i + d]] = [n[i + d], n[i]]
    set(n)
  }
  const thumbH = 96
  const thumbW = Math.round((thumbH * p.w) / p.h)
  return (
    <div className="space-y-2">
      {name && <input type="hidden" name={name} value={max === 1 ? (list[0] ?? '') : JSON.stringify(list)} />}
      {/* Selama upload berjalan, form tidak bisa dikirim (lihat globals.css). */}
      {busy && <input required data-uploading aria-hidden tabIndex={-1} className="sr-only" />}
      <div className="flex flex-wrap gap-2">
        {list.map((src, i) => (
          <div key={src} className="group relative overflow-hidden rounded-lg border border-neutral-200 bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px]" style={{ width: Math.min(thumbW, 260), height: thumbH }}>
            <img src={src} alt="" className="size-full object-contain" />
            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-black/60 p-1 text-xs text-white opacity-100 md:opacity-0 md:group-hover:opacity-100">
              {i > 0 && <button type="button" onClick={() => move(i, -1)} className="px-1.5" aria-label="Geser kiri">◀</button>}
              <button type="button" onClick={() => set(list.filter((x) => x !== src))} className="px-1.5 text-red-300">Hapus</button>
              {i < list.length - 1 && <button type="button" onClick={() => move(i, 1)} className="px-1.5" aria-label="Geser kanan">▶</button>}
            </div>
          </div>
        ))}
        {list.length < max && (
          <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="grid place-items-center rounded-lg border-2 border-dashed border-neutral-300 px-4 text-xs font-semibold text-neutral-600 hover:border-ink" style={{ minWidth: Math.min(thumbW, 160), height: thumbH }}>
            {busy ? 'Mengunggah…' : list.length ? '+ Tambah foto' : '+ Pilih foto'}
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" multiple={max > 1} hidden onChange={(e) => pick(e.target.files)} />
      <SizeHint preset={preset} />
      {max > 1 && <p className="text-[11px] text-neutral-500">Maksimal {max} foto. Foto pertama dipakai sebagai foto utama.</p>}
      {err && <p className="text-xs font-semibold text-red-600">{err}</p>}
    </div>
  )
}
