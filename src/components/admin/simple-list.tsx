import type { ReactNode } from 'react'

// Kartu form sederhana untuk halaman CRUD kecil (kategori, merek, cabang, pengguna).
export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <p className="mb-4 font-semibold text-ink">{title}</p>
      {children}
    </section>
  )
}
export const labelCls = 'block text-xs font-semibold text-neutral-700'
