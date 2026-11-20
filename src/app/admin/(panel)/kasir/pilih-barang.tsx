'use client'
// Pencari ban dan produk situs satu cabang, dipakai formulir barang masuk dan opname.
// Pencariannya sama dengan layar kasir (src/lib/kasir/cari.ts): ukuran dinormalkan, Enter memilih hasil pertama,
// dan teks yang sama persis dengan kode atau barcode langsung dipilih.
import { useMemo, useRef, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { inputCls } from '@/components/admin/form-cls'
import { cariKatalog, cocokPersis } from '@/lib/kasir/cari'
import { SUMBER_LABEL } from '@/lib/kasir/logika'

export type BarangPilih = {
  key: string
  sumber: 'ban' | 'produk'
  id: number
  nama: string
  keterangan: string
  kode: string
  barcode: string
  ukuran: string
  stok: number
  harga: number // harga batch terdepan, atau harga baris kalau belum ada batch
}

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

export function PilihBarang({ id, label, items, cabang, pilih, tanda }: { id: string; label: string; items: BarangPilih[]; cabang: string; pilih: (b: BarangPilih) => void; tanda?: (b: BarangPilih) => string }) {
  const [q, setQ] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const hasil = useMemo(() => cariKatalog(items, q, 30), [items, q])
  const ambil = (b: BarangPilih) => {
    pilih(b)
    setQ('')
    input.current?.focus()
  }
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-neutral-700">{label}</label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-mute" />
        <input
          ref={input}
          id={id}
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            const b = cocokPersis(items, q) ?? hasil[0]
            if (b) ambil(b)
          }}
          placeholder="Ukuran, merek, nama, atau kode. Contoh: 185 65 15"
          className={`${inputCls} min-h-12 pl-10 text-base`}
        />
      </div>
      {q.trim() &&
        (hasil.length ? (
          <ul className="mt-2 max-h-80 divide-y divide-line overflow-y-auto rounded-lg border border-line" aria-label={`Hasil pencarian ${label.toLowerCase()}`}>
            {hasil.map((b) => (
              <li key={b.key}>
                <button type="button" onClick={() => ambil(b)} className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-soft">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2">
                      <span className="font-semibold text-ink">{b.nama}</span>
                      {b.sumber === 'ban' && <span className="text-sm">{b.keterangan}</span>}
                    </span>
                    <span className="block text-xs text-mute">
                      {SUMBER_LABEL[b.sumber]}
                      {b.sumber !== 'ban' && b.keterangan ? ` · ${b.keterangan}` : ''} · stok {b.stok}
                      {tanda?.(b) ? ` · ${tanda(b)}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm font-semibold text-ink">{b.harga > 0 ? rp(b.harga) : <span className="text-xs text-mute">belum ada harga</span>}</span>
                  <Plus aria-hidden className="size-5 shrink-0 text-mute" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-lg border border-dashed border-[#cfcfcf] px-3 py-5 text-center text-sm text-mute">Tidak ada ban atau produk yang cocok di cabang {cabang}.</p>
        ))}
    </div>
  )
}
