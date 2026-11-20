'use client'
// Isi satu baris opname: pilih barang, isi stok fisik dan alasan kalau berbeda, lalu simpan tanpa pindah halaman.
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { inputCls } from '@/components/admin/form-cls'
import { isiBarisOpnameAksi } from '../../../../kasir-actions'
import { PilihBarang, type BarangPilih } from '../../pilih-barang'

const label = 'mb-1 block text-xs font-semibold text-neutral-700'

export function IsiBarisOpname({ opnameId, cabang, barang, sudah }: { opnameId: number; cabang: string; barang: BarangPilih[]; sudah: Record<string, number> }) {
  const router = useRouter()
  const [pilih, setPilih] = useState<BarangPilih | null>(null)
  const [fisik, setFisik] = useState('')
  const [alasan, setAlasan] = useState('')
  const [kirim, setKirim] = useState(false)
  const [hasil, setHasil] = useState<{ ok: boolean; pesan: string } | null>(null)
  const kolomFisik = useRef<HTMLInputElement>(null)

  const selisih = pilih && fisik !== '' ? Number(fisik) - pilih.stok : 0
  const perluAlasan = selisih !== 0 && alasan.trim().length < 3

  const ambil = (b: BarangPilih) => {
    setPilih(b)
    setFisik(sudah[b.key] !== undefined ? String(sudah[b.key]) : '')
    setAlasan('')
    setHasil(null)
    setTimeout(() => kolomFisik.current?.focus(), 0)
  }

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pilih || fisik === '' || perluAlasan || kirim) return
    setKirim(true)
    try {
      const h = await isiBarisOpnameAksi({ opnameId, sumber: pilih.sumber, barisId: pilih.id, stokFisik: fisik, alasan })
      setHasil(h)
      if (h.ok) {
        setPilih(null)
        setFisik('')
        setAlasan('')
        router.refresh()
        document.getElementById('op-cari')?.focus()
      }
    } catch {
      setHasil({ ok: false, pesan: 'Koneksi terputus. Coba simpan lagi.' })
    }
    setKirim(false)
  }

  return (
    <div className="space-y-3">
      <PilihBarang id="op-cari" label="Cari barang yang dihitung" items={barang} cabang={cabang} pilih={ambil} tanda={(b) => (sudah[b.key] !== undefined ? `sudah diisi: fisik ${sudah[b.key]}` : '')} />
      {hasil && (
        <p role={hasil.ok ? 'status' : 'alert'} className={`rounded-lg px-3 py-2 text-sm ${hasil.ok ? 'bg-soft text-ink' : 'border border-red-200 bg-red-50 text-red-800'}`}>
          {hasil.pesan}
        </p>
      )}
      {pilih && (
        <form onSubmit={simpan} className="rounded-lg border border-ink p-4">
          <p className="font-semibold text-ink">{pilih.nama} {pilih.sumber === 'ban' ? pilih.keterangan : ''}</p>
          <p className="text-xs text-mute">Stok sistem sekarang {pilih.stok}. Angka ini dicatat sebagai stok sistem saat baris disimpan.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <div>
              <label htmlFor="op-fisik" className={label}>Stok fisik</label>
              <input ref={kolomFisik} id="op-fisik" inputMode="numeric" value={fisik} onChange={(e) => setFisik(e.target.value.replace(/\D/g, '').slice(0, 6))} className={`${inputCls} min-h-11 text-base`} />
            </div>
            <div>
              <label htmlFor="op-alasan" className={label}>Alasan selisih {selisih !== 0 ? '(wajib)' : '(kalau ada selisih)'}</label>
              <input id="op-alasan" value={alasan} onChange={(e) => setAlasan(e.target.value)} maxLength={200} disabled={fisik === '' || selisih === 0} className={`${inputCls} min-h-11`} placeholder="Mis. rusak, salah hitung, belum dicatat" />
            </div>
          </div>
          {fisik !== '' && (
            <p className="mt-2 text-sm text-ink">
              Selisih <b>{selisih > 0 ? `+${selisih}` : selisih}</b>
              {perluAlasan && <span className="text-mute">. Tulis alasannya dulu.</span>}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="submit" disabled={fisik === '' || perluAlasan || kirim} className="adm-btn min-h-11 disabled:opacity-50">{kirim ? 'Menyimpan...' : 'Simpan baris'}</button>
            <button type="button" onClick={() => setPilih(null)} className="adm-btn-line min-h-11">Batal</button>
          </div>
        </form>
      )}
    </div>
  )
}
