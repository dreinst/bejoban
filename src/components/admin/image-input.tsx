'use client'
import { useId, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from 'lucide-react'
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

// Satu baris keterangan ukuran plus tautan ke panduan lengkap (tab baru supaya isian form tidak hilang).
export function SizeHint({ preset, id }: { preset: PresetKey; id?: string }) {
  const p = PRESETS[preset]
  return (
    <p id={id} className="text-xs leading-snug text-mute">
      Disarankan {p.w}×{p.h} px, rasio {p.ratio}.{' '}
      <a href="/admin/panduan-foto" target="_blank" rel="noopener" className="font-semibold text-ink underline underline-offset-2">
        Panduan ukuran<span className="sr-only"> (tab baru)</span>
      </a>
    </p>
  )
}

const kotak = 'grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:12px_12px]'

/**
 * Kolom gambar ringkas. max 1: pratinjau 56 px dengan tombol Ganti dan Hapus.
 * max lebih dari 1: daftar foto dengan tombol naik, turun, dan hapus; foto pertama jadi foto utama.
 * `name` mengisi input tersembunyi (satu URL, atau JSON daftar URL bila max lebih dari 1). `onChange` untuk editor klien.
 */
export function ImagesInput({ value, onChange, preset, max, name, label }: { value: string[]; onChange?: (v: string[]) => void; preset: PresetKey; max: number; name?: string; label?: string }) {
  const [list, setList] = useState(value)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const set = (v: string[]) => {
    setList(v)
    onChange?.(v)
  }
  const pick = async (files: FileList | null, ganti = false) => {
    if (!files?.length) return
    setBusy(true)
    setErr('')
    try {
      const urls: string[] = []
      const sisa = ganti ? 1 : max - list.length
      for (const f of [...files].slice(0, sisa)) urls.push(await upload(f, preset))
      set(ganti ? urls : [...list, ...urls])
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
  const nama = label ?? PRESETS[preset].label
  const tunggal = max === 1
  return (
    <div className="space-y-2" role="group" aria-label={nama} aria-describedby={hintId}>
      {name && <input type="hidden" name={name} value={tunggal ? (list[0] ?? '') : JSON.stringify(list)} />}
      {/* Selama upload berjalan, form tidak bisa dikirim (lihat globals.css). */}
      {busy && <input required data-uploading aria-hidden tabIndex={-1} className="sr-only" />}
      <input ref={ref} type="file" accept="image/*" multiple={!tunggal} hidden onChange={(e) => pick(e.target.files, tunggal && list.length > 0)} />

      {tunggal ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className={`${kotak} ${list[0] ? 'border-line' : 'border-dashed border-[#cfcfcf]'}`}>
            {list[0] ? <img src={list[0]} alt={`Pratinjau ${nama}`} className="max-h-full max-w-full object-contain" /> : <ImagePlus className="size-5 text-mute" aria-hidden />}
          </span>
          <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="adm-btn-line adm-btn-sm">
            {busy ? 'Mengunggah...' : list[0] ? 'Ganti' : 'Pilih gambar'}
          </button>
          {list[0] && !busy && (
            <button type="button" onClick={() => set([])} className="adm-btn-ghost adm-btn-sm">Hapus</button>
          )}
        </div>
      ) : (
        <>
          {list.length > 0 && (
            <ol className="divide-y divide-line rounded-lg border border-line">
              {list.map((src, i) => (
                <li key={src} className="flex items-center gap-3 px-2 py-1.5">
                  <span className={`${kotak} border-line`}><img src={src} alt={`Foto ${i + 1}`} className="max-h-full max-w-full object-contain" /></span>
                  <span className="min-w-0 flex-1 text-sm">Foto {i + 1}{i === 0 && <span className="text-mute"> (utama)</span>}</span>
                  <button type="button" className="adm-icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Naikkan foto ${i + 1}`}><ArrowUp className="size-4" aria-hidden /></button>
                  <button type="button" className="adm-icon-btn" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={`Turunkan foto ${i + 1}`}><ArrowDown className="size-4" aria-hidden /></button>
                  <button type="button" className="adm-icon-btn" onClick={() => set(list.filter((x) => x !== src))} aria-label={`Hapus foto ${i + 1}`}><Trash2 className="size-4" aria-hidden /></button>
                </li>
              ))}
            </ol>
          )}
          {list.length < max && (
            <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="adm-btn-line adm-btn-sm">
              <ImagePlus className="size-4" aria-hidden />
              {busy ? 'Mengunggah...' : list.length ? 'Tambah foto' : 'Pilih foto'}
            </button>
          )}
        </>
      )}
      <div id={hintId}>
        <SizeHint preset={preset} />
        {!tunggal && <p className="text-xs text-mute">Maksimal {max} foto. Foto pertama jadi foto utama.</p>}
      </div>
      {err && <p role="alert" className="text-xs font-semibold text-red-700">{err}</p>}
    </div>
  )
}

/** Kolom satu gambar dengan label, untuk form server (mis. logo merek). Nilai dikirim lewat `name`. */
export function ImageField({ name, value, preset, label }: { name: string; value?: string | null; preset: PresetKey; label: string }) {
  return (
    <div>
      <p className="mb-1 block text-xs font-semibold text-neutral-700">{label}</p>
      <ImagesInput name={name} value={value ? [value] : []} preset={preset} max={1} label={label} />
    </div>
  )
}
