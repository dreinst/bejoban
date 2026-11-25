import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

// Komponen tata letak bersama halaman admin (komponen server). Aturan lengkap: docs/STANDAR-UI-ADMIN.md.
// Tabel: data-table.tsx. Kolom form: field.tsx. Panel samping dan dialog: overlay.tsx. Sunting cepat: row-controls.tsx.

/** Judul halaman, satu kalimat penjelas, dan tombol utama di kanan atas. */
export function PageHeader({ title, note, actions }: { title: string; note?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 basis-80">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
        {note && <p className="mt-1 max-w-3xl text-sm text-mute">{note}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/**
 * Pembatas lebar halaman. list: isi memakai seluruh lebar area kanan, tanpa ruang kosong di layar lebar.
 * form: satu form dibatasi 640 px supaya isian tidak terlalu panjang.
 * Halaman pengaturan dengan beberapa bagian memakai SettingsGrid supaya layar lebar tidak separuh kosong.
 */
export function PageBody({ width = 'list', children }: { width?: 'list' | 'form'; children: ReactNode }) {
  return <div className={`${width === 'form' ? 'max-w-[640px]' : 'w-full'} space-y-5`}>{children}</div>
}

/** Bagian-bagian form pengaturan: satu kolom, dua kolom mulai 1280 px. Tiap bagian sekitar 560 sampai 640 px. */
export function SettingsGrid({ children }: { children: ReactNode }) {
  return <div className="grid items-start gap-5 xl:grid-cols-2 [&>*]:min-w-0">{children}</div>
}

/** Kartu satu bagian: judul, penjelas singkat, isi. `wide` membuat bagian memakai dua kolom SettingsGrid. */
export function Section({ title, description, id, wide, actions, children }: { title: string; description?: ReactNode; id?: string; wide?: boolean; actions?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-judul` : undefined} className={`adm-card scroll-mt-20 p-5 ${wide ? 'xl:col-span-2' : ''}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
          <h2 id={id ? `${id}-judul` : undefined} className="font-display text-base font-extrabold text-ink">{title}</h2>
          {description && <p className="mt-1 text-sm text-mute">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

export function StatCard({ label, value, href, hint, warn }: { label: string; value: ReactNode; href?: string; hint?: string; warn?: boolean }) {
  const body = (
    <>
      <p className="font-display text-3xl font-extrabold leading-none text-ink">{value}</p>
      <p className="mt-2 text-sm font-medium text-ink">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-mute">{hint}</p>}
      {href && <ChevronRight aria-hidden className="absolute right-3 top-3 size-4 text-mute" />}
    </>
  )
  const cls = `adm-card relative block p-5 ${warn ? 'border-l-4 !border-l-danger' : ''} ${href ? 'transition hover:-translate-y-px hover:shadow-md' : ''}`
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}

/**
 * Lencana. dark, light, outline untuk keterangan biasa. accent (oranye) hanya untuk penanda, bukan status.
 * danger untuk galat, void, dan stok habis; ok untuk sukses. Keduanya sengaja merah dan hijau supaya beda dari aksen.
 */
const NADA_BADGE = {
  dark: 'bg-ink text-white',
  light: 'bg-soft text-ink',
  outline: 'border border-ink text-ink',
  accent: 'bg-accent text-ink',
  danger: 'border border-danger-line bg-danger-soft text-danger',
  ok: 'border border-ok-line bg-ok-soft text-ok',
} as const

export function Badge({ children, tone = 'dark' }: { children: ReactNode; tone?: keyof typeof NADA_BADGE }) {
  const t = NADA_BADGE[tone]
  return <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold ${t}`}>{children}</span>
}

/** Keadaan kosong: apa yang terjadi dan langkah pertamanya. `action` boleh berisi tombol Tambah. */
export function Empty({ title, children, action }: { title?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-dashed border-[#cfcfcf] bg-white px-5 py-10 text-center">
      {title && <p className="font-display text-base font-extrabold text-ink">{title}</p>}
      {children && <div className={`text-sm text-mute ${title ? 'mt-1' : ''}`}>{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
