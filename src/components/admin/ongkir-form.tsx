'use client'
import { useState } from 'react'

type Size = { sizeNorm: string; sizeRaw: string; ring: number }
type Branch = { slug: string; name: string }
type Defaults = { mode: string; size: string; qty: number; kg: string; pl: string; lb: string; tg: string; cabang: string; packing: boolean; q: string; city: string }

const inputCls = 'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-ink disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400'
const labelCls = 'block text-xs font-semibold text-neutral-700'

// Kolom yang tidak dipakai oleh mode terpilih dinonaktifkan (dan tidak ikut terkirim), supaya jelas mana yang dihitung.
export function OngkirForm({ d, sizes, cities, branches, packingFee }: { d: Defaults; sizes: Size[]; cities: string[]; branches: Branch[]; packingFee: string }) {
  const [mode, setMode] = useState(d.mode)
  const stok = mode === 'stok'
  const velg = mode === 'velg'
  const manual = mode === 'manual'
  const hint = stok ? 'Berat diambil dari pengaturan kemasan ban per ring.' : velg ? 'Berat diambil dari pengaturan velg.' : 'Berat dan dimensi diisi sendiri di bawah.'
  return (
    <form className="grid gap-3 md:grid-cols-4">
      <label className={labelCls}>Barang
        <select name="mode" value={mode} onChange={(e) => setMode(e.target.value)} className={inputCls}>
          <option value="stok">Ban dari stok</option>
          <option value="velg">Velg</option>
          <option value="manual">Berat manual</option>
        </select>
      </label>
      <label className={`${labelCls} md:col-span-2`}>Ukuran ban
        <select name="size" defaultValue={d.size} disabled={!stok} className={inputCls}>
          <option value="">{sizes.length ? 'Pilih ukuran' : 'Stok kosong, impor dulu'}</option>
          {sizes.map((s) => <option key={s.sizeNorm} value={s.sizeNorm}>{s.sizeRaw.trim()} (R{s.ring})</option>)}
        </select>
      </label>
      <label className={labelCls}>Jumlah
        <input name="qty" type="number" min={1} max={200} defaultValue={d.qty} disabled={manual} className={inputCls} />
      </label>
      <p className="text-xs text-neutral-500 md:col-span-4">{hint}</p>
      <label className={labelCls}>Berat manual (kg)
        <input name="kg" defaultValue={d.kg} inputMode="decimal" disabled={!manual} className={inputCls} />
      </label>
      <label className={labelCls}>Dimensi paket manual, cm (p, l, t)
        <span className="flex gap-1">
          <input name="pl" placeholder="p" defaultValue={d.pl} disabled={!manual} className={inputCls} />
          <input name="lb" placeholder="l" defaultValue={d.lb} disabled={!manual} className={inputCls} />
          <input name="tg" placeholder="t" defaultValue={d.tg} disabled={!manual} className={inputCls} />
        </span>
      </label>
      <label className={labelCls}>Cabang asal
        <select name="cabang" defaultValue={d.cabang} className={inputCls}>
          {branches.map((b) => <option key={b.slug} value={b.slug}>{b.name.replace(/\s*\(.*\)/, '')}</option>)}
        </select>
      </label>
      <label className="flex items-end gap-2 pb-2 text-sm">
        <input type="checkbox" name="packing" value="1" defaultChecked={d.packing} disabled={manual} />
        Tambah packing ({packingFee}/ban)
      </label>
      <label className={`${labelCls} md:col-span-3`}>Alamat atau lokasi tujuan
        <input name="q" defaultValue={d.q} className={inputCls} placeholder="Tempel alamat lengkap, atau tulis kecamatan dan kota" />
        <span className="font-normal text-neutral-500">Alamat lengkap gaya Google Maps boleh ditempel utuh. Pencarian mencoba versi yang makin pendek sampai ketemu.</span>
      </label>
      <label className={labelCls}>Atau pilih kota di tabel tarif
        <input name="city" list="kota" defaultValue={d.city} className={inputCls} placeholder="mis. Surabaya" />
        <datalist id="kota">{cities.map((c) => <option key={c} value={c} />)}</datalist>
      </label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-4">
        <button className="adm-btn">Cari lokasi dan hitung</button>
        <button name="fresh" value="1" className="adm-btn-line">Cari ulang (lewati cache)</button>
        <span className="text-xs text-neutral-500">Pencarian hanya jalan saat tombol ditekan (aturan pakai OpenStreetMap).</span>
      </div>
    </form>
  )
}
