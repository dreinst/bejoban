'use client'
// Formulir barang masuk: kepala penerimaan, lalu baris barang dari pencarian. Harga jual terisi harga sekarang.
// Server menghitung ulang harga lama dan menentukan apakah usulan harga perlu disetujui owner.
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { inputCls } from '@/components/admin/form-cls'
import { JENIS_PEMASOK, JENIS_PEMASOK_LABEL, type JenisPemasok } from '@/lib/kasir/logika'
import { catatBarangMasukAksi, type HasilSimpan } from '../../../../kasir-actions'
import { PilihBarang, type BarangPilih } from '../../pilih-barang'

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
const digit = (s: string) => s.replace(/\D/g, '').slice(0, 10)
const kunciBaru = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`)
const label = 'mb-1 block text-xs font-semibold text-neutral-700'

type Baris = { key: string; jumlah: string; hargaBeli: string; hargaJual: string }

export function FormMasuk({ cabang, barang, owner, hariIni, pemasokLama }: { cabang: { id: number; nama: string }; barang: BarangPilih[]; owner: boolean; hariIni: string; pemasokLama: { pemasok: string; jenisPemasok: string }[] }) {
  const router = useRouter()
  const peta = useMemo(() => new Map(barang.map((b) => [b.key, b])), [barang])
  const [pemasok, setPemasok] = useState('')
  const [jenis, setJenis] = useState<JenisPemasok>('distributor')
  const [pesan, setPesan] = useState('')
  const [terima, setTerima] = useState(hariIni)
  const [catatan, setCatatan] = useState('')
  const [baris, setBaris] = useState<Baris[]>([])
  const [kirim, setKirim] = useState(false)
  const [galat, setGalat] = useState('')
  // Satu kunci untuk satu penerimaan. Dipakai ulang kalau kiriman gagal, supaya kiriman ulang tidak mencatat dua kali.
  const kunci = useRef(kunciBaru())

  const tambah = (b: BarangPilih) => {
    setGalat('')
    setBaris((x) => (x.some((r) => r.key === b.key) ? x : [...x, { key: b.key, jumlah: '1', hargaBeli: '', hargaJual: b.harga > 0 ? String(b.harga) : '' }]))
  }
  const ubah = (key: string, patch: Partial<Baris>) => setBaris((x) => x.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const total = baris.reduce((n, r) => n + (Number(r.jumlah) || 0), 0)
  const kurang = !pemasok.trim() ? 'Isi nama pemasok' : !baris.length ? 'Tambahkan barang yang diterima' : baris.some((r) => !(Number(r.jumlah) > 0)) ? 'Jumlah tiap barang minimal 1' : baris.some((r) => !(Number(r.hargaJual) > 0)) ? 'Isi harga jual tiap barang' : ''

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (kurang || kirim) return
    setKirim(true)
    setGalat('')
    let h: HasilSimpan
    try {
      h = await catatBarangMasukAksi({
        cabangId: cabang.id,
        pemasok,
        jenisPemasok: jenis,
        tanggalPesan: pesan,
        tanggalTerima: terima,
        catatan,
        kunci: kunci.current,
        baris: baris.map((r) => {
          const b = peta.get(r.key)!
          return { sumber: b.sumber, id: b.id, jumlah: Number(r.jumlah), hargaBeli: r.hargaBeli ? Number(r.hargaBeli) : null, hargaJual: r.hargaJual ? Number(r.hargaJual) : null }
        }),
      })
    } catch {
      setKirim(false)
      setGalat('Koneksi terputus. Cek daftar barang masuk dulu sebelum mengirim ulang. Kalau belum ada, tekan Simpan lagi.')
      return
    }
    if (h.ok) {
      router.push(`/admin/kasir/masuk/${h.id}?ok=${encodeURIComponent(`${h.nomor} tersimpan, stok sudah bertambah`)}`)
      return
    }
    setKirim(false)
    setGalat(h.pesan)
  }

  return (
    <form onSubmit={simpan} className="space-y-5">
      <section aria-labelledby="judul-kepala" className="adm-card space-y-4 p-4 sm:p-5">
        <h2 id="judul-kepala" className="font-display text-base font-extrabold text-ink">Penerimaan</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="bm-pemasok" className={label}>Pemasok</label>
            <input
              id="bm-pemasok"
              list="bm-pemasok-lama"
              value={pemasok}
              onChange={(e) => {
                setPemasok(e.target.value)
                const lama = pemasokLama.find((p) => p.pemasok === e.target.value)
                if (lama && (JENIS_PEMASOK as readonly string[]).includes(lama.jenisPemasok)) setJenis(lama.jenisPemasok as JenisPemasok)
              }}
              maxLength={100}
              required
              className={`${inputCls} min-h-11`}
              placeholder="Nama distributor atau toko"
            />
            <datalist id="bm-pemasok-lama">
              {pemasokLama.map((p) => <option key={p.pemasok} value={p.pemasok} />)}
            </datalist>
          </div>
          <fieldset>
            <legend className={label}>Jenis pemasok</legend>
            <div className="grid grid-cols-2 gap-2">
              {JENIS_PEMASOK.map((j) => (
                <label key={j} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-semibold ${jenis === j ? 'border-ink bg-ink text-white' : 'border-[#cfcfcf] bg-white text-ink hover:bg-soft'}`}>
                  <input type="radio" className="sr-only" name="jenisPemasok" value={j} checked={jenis === j} onChange={() => setJenis(j)} />
                  {JENIS_PEMASOK_LABEL[j]}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="bm-pesan" className={label}>Tanggal pesan (kalau tahu)</label>
            <input id="bm-pesan" type="date" value={pesan} max={terima || hariIni} onChange={(e) => setPesan(e.target.value)} className={`${inputCls} min-h-11`} />
          </div>
          <div>
            <label htmlFor="bm-terima" className={label}>Tanggal terima</label>
            <input id="bm-terima" type="date" value={terima} max={hariIni} required onChange={(e) => setTerima(e.target.value)} className={`${inputCls} min-h-11`} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="bm-catatan" className={label}>Catatan (boleh kosong)</label>
            <input id="bm-catatan" value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={300} className={`${inputCls} min-h-11`} placeholder="Mis. nomor surat jalan" />
          </div>
        </div>
      </section>

      <section aria-labelledby="judul-barang" className="adm-card space-y-4 p-4 sm:p-5">
        <h2 id="judul-barang" className="font-display text-base font-extrabold text-ink">Barang yang diterima</h2>
        <PilihBarang id="bm-cari" label="Cari ban atau produk" items={barang} cabang={cabang.nama} pilih={tambah} tanda={(b) => (baris.some((r) => r.key === b.key) ? 'sudah di daftar' : '')} />
        {baris.length ? (
          <ul className="divide-y divide-line border-t border-line">
            {baris.map((r) => {
              const b = peta.get(r.key)
              if (!b) return null
              const usulan = Number(r.hargaJual) || 0
              const beda = usulan > 0 && usulan !== b.harga
              return (
                <li key={r.key} className="py-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{b.nama} {b.sumber === 'ban' ? b.keterangan : ''}</p>
                      <p className="text-xs text-mute">Stok sekarang {b.stok}, harga sekarang {b.harga > 0 ? rp(b.harga) : 'belum ada'}</p>
                    </div>
                    <button type="button" onClick={() => setBaris((x) => x.filter((y) => y.key !== r.key))} aria-label={`Hapus ${b.nama} dari daftar`} className="adm-icon-btn size-11 shrink-0 border-transparent">
                      <X aria-hidden className="size-5" />
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label htmlFor={`bm-j-${r.key}`} className={label}>Jumlah (pcs)</label>
                      <input id={`bm-j-${r.key}`} inputMode="numeric" value={r.jumlah} onChange={(e) => ubah(r.key, { jumlah: digit(e.target.value).slice(0, 4) })} className={`${inputCls} min-h-11`} />
                    </div>
                    <div>
                      <label htmlFor={`bm-b-${r.key}`} className={label}>Harga beli per pcs (boleh kosong)</label>
                      <input id={`bm-b-${r.key}`} inputMode="numeric" value={r.hargaBeli} onChange={(e) => ubah(r.key, { hargaBeli: digit(e.target.value) })} className={`${inputCls} min-h-11`} placeholder="Rp" />
                    </div>
                    <div>
                      <label htmlFor={`bm-h-${r.key}`} className={label}>Harga jual per pcs</label>
                      <input id={`bm-h-${r.key}`} inputMode="numeric" value={r.hargaJual} onChange={(e) => ubah(r.key, { hargaJual: digit(e.target.value) })} className={`${inputCls} min-h-11`} placeholder="Rp" />
                    </div>
                  </div>
                  {beda && (
                    <p className="mt-2 rounded-lg bg-soft px-3 py-2 text-xs text-ink">
                      {owner
                        ? `Batch baru ini dijual ${rp(usulan)}. Batch lama tetap dengan harganya sendiri.`
                        : b.harga > 0
                          ? `Harga ${rp(usulan)} diajukan ke owner. Sampai disetujui, batch baru dijual ${rp(b.harga)}.`
                          : `Harga ${rp(usulan)} diajukan ke owner. Barang ini belum bisa dijual sampai owner menyetujuinya.`}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-[#cfcfcf] px-3 py-6 text-center text-sm text-mute">Belum ada barang. Cari lalu pilih barang yang diterima.</p>
        )}
      </section>

      <div className="adm-card sticky bottom-3 z-10 flex flex-wrap items-center gap-3 p-4">
        <p className="min-w-0 flex-1 text-sm text-mute">
          <b className="text-ink">{total} pcs</b>, {baris.length} barang
          {kurang && <span className="block text-xs">{kurang}</span>}
        </p>
        <button type="submit" disabled={!!kurang || kirim} className="adm-btn min-h-12 px-6 disabled:opacity-50">
          {kirim ? 'Menyimpan...' : 'Simpan barang masuk'}
        </button>
        {galat && <p role="alert" className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{galat}</p>}
      </div>
    </form>
  )
}
