import Link from 'next/link'
import type { ReactNode } from 'react'

// Komponen bersama halaman admin: judul halaman, angka ringkas, lencana status, dan pesan kosong.
// Tombol memakai kelas .adm-btn, .adm-btn-line, .adm-btn-sm di globals.css. Kartu dan form: simple-list.tsx dan section-editor.tsx.

export function PageHeader({ title, note, actions }: { title: string; note?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
        {note && <p className="mt-1 max-w-2xl text-sm text-mute">{note}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ label, value, href, hint, warn }: { label: string; value: ReactNode; href?: string; hint?: string; warn?: boolean }) {
  const body = (
    <>
      <p className="font-display text-3xl font-extrabold leading-none text-ink">{value}</p>
      <p className="mt-2 text-sm font-medium text-ink">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-mute">{hint}</p>}
    </>
  )
  const cls = `adm-card block p-5 ${warn ? 'border-l-4 !border-l-ink' : ''} ${href ? 'transition hover:-translate-y-px hover:shadow-md' : ''}`
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}

export function Badge({ children, tone = 'dark' }: { children: ReactNode; tone?: 'dark' | 'light' | 'outline' }) {
  const t = tone === 'dark' ? 'bg-ink text-white' : tone === 'light' ? 'bg-soft text-ink' : 'border border-ink text-ink'
  return <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold ${t}`}>{children}</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-mute">{children}</p>
}
