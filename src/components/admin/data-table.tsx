import Link from 'next/link'
import type { ReactNode } from 'react'
import { ImageOff } from 'lucide-react'

// Tabel data admin. Komponen server (tanpa 'use client'), jadi fungsi sel boleh dikirim dari halaman server.
// Di layar lebar tabel biasa. Di bawah 768 px tiap baris menjadi kartu ringkas satu item (gaya di globals.css, .adm-table):
// gambar kecil di kiri, kolom `title` sebagai judul, kolom `meta` sebagai baris keterangan "Label: isi", aksi di kanan.

export type Column<T> = {
  key: string
  header: string
  cell: (row: T) => ReactNode
  /** Peran di tampilan kartu: title (judul, satu per tabel), meta (bawaan), hide (disembunyikan di layar kecil). */
  mobile?: 'title' | 'meta' | 'hide'
  /** Tulis label kolom di depan isinya pada tampilan kartu. Bawaan true untuk meta. */
  mobileLabel?: boolean
  align?: 'left' | 'right' | 'center'
  /** Kelas tambahan untuk sel, mis. lebar 'w-32' atau 'whitespace-nowrap'. */
  className?: string
  /** Kolom ini hanya ada di tampilan kartu (HP). Dipakai untuk menggabungkan beberapa kontrol dalam satu baris kartu. */
  hanyaHp?: boolean
}

export function DataTable<T>({
  rows,
  rowKey,
  columns,
  thumb,
  actions,
  caption,
  empty,
  muted,
  actionsBelow,
}: {
  rows: T[]
  rowKey: (row: T) => string | number
  columns: Column<T>[]
  /** Gambar kecil 40 sampai 56 px di awal baris. Pakai <Thumb>. */
  thumb?: (row: T) => ReactNode
  /** Tombol di ujung baris: Ubah (Drawer), Hapus (ConfirmDialog), atau tautan. */
  actions?: (row: T) => ReactNode
  /** Nama tabel untuk pembaca layar, mis. "Daftar merek". */
  caption: string
  /** Isi saat tidak ada baris. Pakai <Empty>. */
  empty?: ReactNode
  /** Baris diredupkan, mis. item nonaktif. */
  muted?: (row: T) => boolean
  /** Di layar kecil aksi turun ke baris sendiri di bawah kartu (untuk tombol panjang). */
  actionsBelow?: boolean
}) {
  if (!rows.length) return <>{empty}</>
  return (
    <div className="adm-card overflow-hidden">
      <table className="adm-table" data-thumb={thumb ? '' : undefined} data-actions={actionsBelow ? 'below' : undefined}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {thumb && <th scope="col" className="w-16"><span className="sr-only">Gambar</span></th>}
            {columns.map((c) => (
              <th key={c.key} scope="col" data-align={c.align} className={c.hanyaHp ? 'hidden' : undefined}>{c.header}</th>
            ))}
            {actions && <th scope="col" data-align="right"><span className="sr-only">Aksi</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} data-muted={muted?.(r) ? '' : undefined}>
              {thumb && <td data-role="thumb">{thumb(r)}</td>}
              {columns.map((c, i) => {
                const role = c.mobile ?? (i === 0 ? 'title' : 'meta')
                const label = role === 'meta' && c.mobileLabel !== false ? c.header : undefined
                return (
                  <td key={c.key} data-role={role} data-label={label} data-align={c.align} className={[c.className, c.hanyaHp && 'md:hidden'].filter(Boolean).join(' ') || undefined}>
                    {c.cell(r)}
                  </td>
                )
              })}
              {actions && (
                <td data-role="actions" className="w-px whitespace-nowrap">
                  <div className="adm-row-actions">{actions(r)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* eslint-disable @next/next/no-img-element */
/**
 * Gambar kecil di baris tabel. `logo`: siluet gelap di latar abu (logo merek tampil satu warna di situs).
 * Tanpa gambar: kotak abu dengan ikon, plus teks pembaca layar.
 */
export function Thumb({ src, alt = '', size = 48, variant = 'photo' }: { src?: string | null; alt?: string; size?: 40 | 48 | 56; variant?: 'photo' | 'logo' }) {
  const box = { width: size, height: size }
  if (!src)
    return (
      <span style={box} className="grid shrink-0 place-items-center rounded-lg border border-dashed border-[#cfcfcf] bg-soft text-mute">
        <ImageOff className="size-4" aria-hidden />
        <span className="sr-only">Tanpa gambar</span>
      </span>
    )
  return (
    <span style={box} className="grid shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-soft p-1">
      <img data-thumb-img src={src} alt={alt} className={`max-h-full max-w-full object-contain ${variant === 'logo' ? '[filter:brightness(0)]' : ''}`} />
    </span>
  )
}

/**
 * Baris di atas tabel: jumlah item, pencarian (GET ?q=), dan saringan.
 * `keep`: parameter lain yang ikut dikirim saat mencari (mis. cabang yang sedang dipilih).
 */
export function ListToolbar({
  count,
  noun,
  total,
  search,
  children,
}: {
  count: number
  noun: string
  /** Jumlah keseluruhan bila yang tampil hanya sebagian (hasil cari atau batas tampil). */
  total?: number
  search?: { placeholder: string; value?: string; keep?: Record<string, string | number | undefined>; label?: string }
  children?: ReactNode
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="text-sm text-mute" aria-live="polite">
        <b className="text-ink">{count.toLocaleString('id-ID')}</b> {noun}
        {total !== undefined && total !== count && <> dari {total.toLocaleString('id-ID')}</>}
      </p>
      {search && (
        <form role="search" className="flex min-w-[min(100%,16rem)] flex-1 items-center gap-2 sm:max-w-md">
          {Object.entries(search.keep ?? {}).map(([k, v]) => (v === undefined || v === '' ? null : <input key={k} type="hidden" name={k} value={v} />))}
          <label className="sr-only" htmlFor="cari-daftar">{search.label ?? search.placeholder}</label>
          <input id="cari-daftar" type="search" name="q" defaultValue={search.value} placeholder={search.placeholder} className="min-h-10 w-full min-w-0 rounded-lg border border-[#cfcfcf] bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10" />
          <button className="adm-btn-line adm-btn-sm">Cari</button>
        </form>
      )}
      {children && <div className="flex flex-wrap items-center gap-2 max-sm:basis-full">{children}</div>}
    </div>
  )
}

/** Saringan berbentuk chip. Tiap chip tautan dengan aria-current, jadi tetap jalan tanpa JavaScript. */
export function FilterChips({ label, items }: { label: string; items: { href: string; label: ReactNode; active: boolean; count?: number }[] }) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={it.active ? 'true' : undefined}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold max-md:min-h-11 ${it.active ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-[#cfcfcf] hover:ring-ink'}`}
        >
          {it.label}
          {it.count !== undefined && <span className={it.active ? 'text-white/70' : 'text-mute'}>{it.count.toLocaleString('id-ID')}</span>}
        </Link>
      ))}
    </nav>
  )
}

/**
 * Navigasi halaman untuk daftar panjang. `href(n)` memberi alamat halaman n lengkap dengan saringan yang aktif.
 * Tidak tampil kalau hanya ada satu halaman.
 */
export function Halaman({ hal, total, per, href }: { hal: number; total: number; per: number; href: (n: number) => string }) {
  const jumlah = Math.max(1, Math.ceil(total / per))
  if (jumlah < 2) return null
  const dari = (hal - 1) * per + 1
  const sampai = Math.min(total, hal * per)
  const tombol = 'adm-btn-line adm-btn-sm'
  return (
    <nav aria-label="Halaman daftar" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-mute" aria-live="polite">
        Baris {dari.toLocaleString('id-ID')} sampai {sampai.toLocaleString('id-ID')} dari {total.toLocaleString('id-ID')}. Halaman {hal} dari {jumlah}.
      </p>
      <div className="flex gap-2">
        {hal > 1 ? <Link href={href(hal - 1)} rel="prev" className={tombol}>Sebelumnya</Link> : <span aria-disabled className={`${tombol} opacity-45`}>Sebelumnya</span>}
        {hal < jumlah ? <Link href={href(hal + 1)} rel="next" className={tombol}>Berikutnya</Link> : <span aria-disabled className={`${tombol} opacity-45`}>Berikutnya</span>}
      </div>
    </nav>
  )
}
