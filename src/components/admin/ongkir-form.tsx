'use client'
import { useState } from 'react'
import { CheckField, FormGrid, SelectField, TextField } from './field'

// cabang: slug cabang yang punya ukuran ini, string kosong untuk baris stok tanpa cabang.
type Size = { sizeNorm: string; sizeRaw: string; ring: number; cabang: string[] }
type Branch = { slug: string; name: string }
type Defaults = { mode: string; size: string; qty: number; kg: string; pl: string; lb: string; tg: string; cabang: string; packing: boolean; q: string; city: string }

// Kolom yang tidak dipakai oleh mode terpilih disembunyikan (dan tidak ikut terkirim), jadi yang tampil hanya yang dihitung.
export function OngkirForm({ d, sizes, cities, branches, packingFee }: { d: Defaults; sizes: Size[]; cities: string[]; branches: Branch[]; packingFee: string }) {
  const [mode, setMode] = useState(d.mode)
  const [cabang, setCabang] = useState(d.cabang || branches[0]?.slug || '')
  // Daftar ukuran mengikuti cabang asal: baris cabang itu ditambah baris tanpa cabang.
  const pilihan = sizes.filter((s) => s.cabang.includes('') || s.cabang.includes(cabang))
  const stok = mode === 'stok'
  const velg = mode === 'velg'
  const manual = mode === 'manual'
  const hint = stok ? 'Berat diambil dari pengaturan kemasan ban per ring.' : velg ? 'Berat diambil dari pengaturan velg.' : 'Isi berat dan ukuran paketnya sendiri.'
  return (
    <form>
      <FormGrid>
        <SelectField label="Barang" name="mode" value={mode} onChange={(e) => setMode(e.target.value)} hint={hint}>
          <option value="stok">Ban dari stok</option>
          <option value="velg">Velg</option>
          <option value="manual">Berat manual</option>
        </SelectField>
        {!manual && <TextField label="Jumlah" name="qty" type="number" min={1} max={200} defaultValue={d.qty} />}
        {stok && (
          <SelectField
            key={cabang}
            className="sm:col-span-2"
            label="Ukuran ban"
            name="size"
            defaultValue={pilihan.some((s) => s.sizeNorm === d.size) ? d.size : ''}
          >
            <option value="">{pilihan.length ? 'Pilih ukuran' : 'Belum ada stok ban di cabang ini'}</option>
            {pilihan.map((s) => <option key={s.sizeNorm} value={s.sizeNorm}>{s.sizeRaw.trim()} (R{s.ring})</option>)}
          </SelectField>
        )}
        {manual && (
          <>
            <TextField label="Berat manual (kg)" name="kg" defaultValue={d.kg} inputMode="decimal" />
            <div>
              <p className="mb-1 text-xs font-semibold text-neutral-700" id="dimensi-label">Dimensi paket manual (cm, boleh kosong)</p>
              <div role="group" aria-labelledby="dimensi-label" className="grid grid-cols-3 gap-2">
                <TextField label="Panjang" name="pl" defaultValue={d.pl} inputMode="decimal" />
                <TextField label="Lebar" name="lb" defaultValue={d.lb} inputMode="decimal" />
                <TextField label="Tinggi" name="tg" defaultValue={d.tg} inputMode="decimal" />
              </div>
            </div>
          </>
        )}
        <SelectField label="Cabang asal" name="cabang" value={cabang} onChange={(e) => setCabang(e.target.value)}>
          {branches.map((b) => <option key={b.slug} value={b.slug}>{b.name.replace(/\s*\(.*\)/, '')}</option>)}
        </SelectField>
        {!manual && <CheckField label={`Tambah packing (${packingFee}/ban)`} name="packing" value="1" defaultChecked={d.packing} className="self-end" />}
        <TextField
          className="sm:col-span-2"
          label="Alamat atau lokasi tujuan"
          hint="Alamat lengkap dari Google Maps boleh ditempel utuh."
          name="q"
          defaultValue={d.q}
          placeholder="Tempel alamat lengkap, atau tulis kecamatan dan kota"
        />
        <div className="sm:col-span-2">
          <TextField label="Atau pilih kota di tabel tarif" name="city" list="kota" defaultValue={d.city} placeholder="mis. Surabaya" />
          <datalist id="kota">{cities.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
      </FormGrid>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button className="adm-btn">Cari lokasi dan hitung</button>
        <button name="fresh" value="1" className="adm-btn-line" title="Cari lokasi lagi tanpa memakai hasil pencarian yang tersimpan">Cari lagi tanpa simpanan</button>
      </div>
    </form>
  )
}
