import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { inputCls } from './form-cls'

// Kolom form seragam. Komponen server (tanpa 'use client'), boleh dipakai di halaman server dan di dalam Drawer.
// Label terhubung ke kolom lewat id, bantuan satu baris lewat aria-describedby, galat per kolom lewat aria-invalid.
// id bawaan "f-<name>". Kalau satu halaman punya dua kolom bernama sama yang tampil bersamaan, isi `id` sendiri.

type Meta = { label: ReactNode; hint?: ReactNode; error?: string; id?: string; className?: string }

const ids = (name: string | undefined, id: string | undefined, hint: unknown, error: unknown) => {
  const fid = id ?? `f-${name ?? 'kolom'}`
  const desc = [hint ? `${fid}-hint` : '', error ? `${fid}-err` : ''].filter(Boolean).join(' ') || undefined
  return { fid, desc }
}

function Wrap({ fid, label, hint, error, className, children }: { fid: string; label: ReactNode; hint?: ReactNode; error?: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={fid} className="mb-1 block text-xs font-semibold text-neutral-700">{label}</label>
      {children}
      {hint && <p id={`${fid}-hint`} className="mt-1 text-xs leading-snug text-mute">{hint}</p>}
      {error && <p id={`${fid}-err`} className="mt-1 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  )
}

export function TextField({ label, hint, error, id, className, ...input }: Meta & InputHTMLAttributes<HTMLInputElement>) {
  const { fid, desc } = ids(input.name, id, hint, error)
  return (
    <Wrap fid={fid} label={label} hint={hint} error={error} className={className}>
      <input id={fid} aria-describedby={desc} aria-invalid={error ? true : undefined} className={`${inputCls} min-h-10 max-md:min-h-11`} {...input} />
    </Wrap>
  )
}

export function SelectField({ label, hint, error, id, className, children, ...select }: Meta & SelectHTMLAttributes<HTMLSelectElement>) {
  const { fid, desc } = ids(select.name, id, hint, error)
  return (
    <Wrap fid={fid} label={label} hint={hint} error={error} className={className}>
      <select id={fid} aria-describedby={desc} aria-invalid={error ? true : undefined} className={`${inputCls} min-h-10 max-md:min-h-11`} {...select}>
        {children}
      </select>
    </Wrap>
  )
}

export function TextAreaField({ label, hint, error, id, className, ...area }: Meta & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { fid, desc } = ids(area.name, id, hint, error)
  return (
    <Wrap fid={fid} label={label} hint={hint} error={error} className={className}>
      <textarea id={fid} aria-describedby={desc} aria-invalid={error ? true : undefined} className={inputCls} {...area} />
    </Wrap>
  )
}

/** Kotak centang dengan label di kanan dan bantuan di bawahnya. Seluruh baris bisa diklik (target 44 px). */
export function CheckField({ label, hint, id, className, ...input }: Omit<Meta, 'error'> & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const { fid, desc } = ids(input.name, id, hint, null)
  return (
    <div className={`flex items-start gap-3 ${className ?? ''}`}>
      <input id={fid} type="checkbox" aria-describedby={desc} className="mt-3 size-4 shrink-0 accent-ink max-md:mt-3.5" {...input} />
      <div className="min-w-0">
        <label htmlFor={fid} className="flex min-h-10 items-center text-sm font-semibold text-ink max-md:min-h-11">{label}</label>
        {hint && <p id={`${fid}-hint`} className="-mt-1 text-xs leading-snug text-mute">{hint}</p>}
      </div>
    </div>
  )
}

/** Susunan kolom form: satu kolom di layar kecil, dua kolom mulai 640 px. Kolom lebar pakai className="sm:col-span-2". */
export function FormGrid({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  const c = cols === 1 ? '' : cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
  return <div className={`grid gap-4 ${c}`}>{children}</div>
}

/** Baris tombol di bawah form. Di dalam Drawer menempel di bawah panel. Tombol utama di kanan. */
export function FormActions({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="adm-form-actions mt-5 flex flex-wrap items-center justify-end gap-2">
      {note && <p className="mr-auto text-xs text-mute">{note}</p>}
      {children}
    </div>
  )
}
