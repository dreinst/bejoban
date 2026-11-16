import type { ReactNode } from 'react'

// Pola lama. Halaman baru memakai Section di ui.tsx dan kolom di field.tsx (docs/STANDAR-UI-ADMIN.md).
export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="adm-card p-5">
      <p className="mb-4 font-display text-base font-extrabold text-ink">{title}</p>
      {children}
    </section>
  )
}
export const labelCls = 'block text-xs font-semibold text-neutral-700'
