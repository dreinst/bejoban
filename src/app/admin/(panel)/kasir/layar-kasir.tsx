'use client'
// Layar transaksi kasir: cari barang dan jasa dalam satu daftar, keranjang, channel, metode bayar, diskon nota,
// konfirmasi, lalu simpan lewat aksi server. Harga di layar hanya pratinjau; server menghitung ulang dari batch dan
// menolak kalau totalnya berbeda dari yang dilihat kasir. Aturan kiriman putus: docs/KASIR.md, bagian transaksi.
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus, Search, X } from 'lucide-react'
import { inputCls } from '@/components/admin/form-cls'
import { cariKatalog, cocokPersis, hitungKeranjang } from '@/lib/kasir/cari'
import { CHANNEL, CHANNEL_LABEL, MAKS_UANG, METODE_BAYAR, METODE_LABEL, SUMBER_LABEL, type Channel, type MetodeBayar } from '@/lib/kasir/logika'
import type { ItemKatalog } from '@/lib/kasir/katalog'
import { bayarKasir, cekKunciKasir, type HasilBayar, type HasilCekKunci } from '../../kasir-actions'

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
const digit = (s: string) => s.replace(/\D/g, '').slice(0, 12)
const angka = (s: string) => (s ? Number(s) : 0)
const kunciBaru = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`)

type Baris = { key: string; jumlah: number }
type Galat = { pesan: string; nama?: string; stokLain?: { cabang: string; stok: number }[]; nota?: { id: number; nomor: string }; info?: boolean }
type Kiriman = {
  cabangId: number
  channel: Channel
  metode: MetodeBayar
  diskon: number
  alasanDiskon: string
  dibayar: number | null
  totalDilihat: number
  kunci: string
  baris: { sumber: ItemKatalog['sumber']; id: number; alt?: true; jumlah: number }[]
}

// Kiriman yang jawabannya belum diterima disimpan di tab ini, supaya statusnya tetap dicek walau halaman dimuat ulang.
const simpanan = (cabangId: number) => `kasir-kiriman-${cabangId}`
const ingatKiriman = (cabangId: number, k: Kiriman | null) => {
  try {
    if (k) sessionStorage.setItem(simpanan(cabangId), JSON.stringify(k))
    else sessionStorage.removeItem(simpanan(cabangId))
  } catch {}
}
const bacaKiriman = (cabangId: number): Kiriman | null => {
  try {
    return JSON.parse(sessionStorage.getItem(simpanan(cabangId)) ?? 'null')
  } catch {
    return null
  }
}

function Pilihan<T extends string>({ label, nilai, pilihan, ubah }: { label: string; nilai: T; pilihan: readonly { v: T; t: string }[]; ubah: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-1 text-xs font-semibold text-neutral-700">{label}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-2">
        {pilihan.map((p) => (
          <label key={p.v} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-semibold ${nilai === p.v ? 'border-ink bg-ink text-white' : 'border-[#cfcfcf] bg-white text-ink hover:bg-soft'}`}>
            <input type="radio" className="sr-only" name={label} value={p.v} checked={nilai === p.v} onChange={() => ubah(p.v)} />
            {p.t}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function LayarKasir({ cabang, katalog, owner }: { cabang: { id: number; nama: string }; katalog: ItemKatalog[]; owner: boolean }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [keranjang, setKeranjang] = useState<Baris[]>([])
  const [channel, setChannel] = useState<Channel>('toko')
  const [metode, setMetode] = useState<MetodeBayar>('tunai')
  const [diskon, setDiskon] = useState('')
  const [alasan, setAlasan] = useState('')
  const [dibayar, setDibayar] = useState('')
  const [info, setInfo] = useState<Galat | null>(null)
  const [konfirmasi, setKonfirmasi] = useState(false)
  const [kirim, setKirim] = useState(false)
  const [galat, setGalat] = useState<Galat | null>(null)
  // putus: kiriman terakhir tidak mendapat jawaban. Keranjang dikunci sampai statusnya jelas lewat Cek status.
  const [putus, setPutus] = useState(false)
  const [mengecek, setMengecek] = useState(false)
  // Kiriman dari sebelum halaman dimuat ulang yang statusnya belum jelas. Selama ada, Bayar dikunci supaya kiriman
  // baru tidak menimpa catatannya di sessionStorage dan kasir tidak memasukkan nota yang mungkin sudah tersimpan.
  const [cekAwal, setCekAwal] = useState<{ jalan: boolean; pesan: string } | null>(null)
  const kunci = useRef<string | null>(null)
  const kiriman = useRef<Kiriman | null>(null)
  const cari = useRef<HTMLInputElement>(null)
  const dlg = useRef<HTMLDialogElement>(null)

  const peta = useMemo(() => new Map(katalog.map((i) => [i.key, i])), [katalog])
  const hasil = useMemo(() => cariKatalog(katalog, q, 30), [katalog, q])
  const isi = keranjang.filter((b) => peta.has(b.key))
  const hitung = hitungKeranjang(
    isi.map((b) => {
      const i = peta.get(b.key)!
      return { key: b.key, nama: i.nama, jumlah: b.jumlah, batch: i.batch, hargaJasa: i.sumber === 'jasa' ? i.harga : null }
    }),
    angka(diskon),
  )
  const nDiskon = angka(diskon)
  const nBayar = angka(dibayar)
  const kurangBayar = metode === 'tunai' && nBayar < hitung.total
  const uangLebih = metode === 'tunai' && nBayar > MAKS_UANG
  const alasanKurang = nDiskon > 0 && alasan.trim().length < 3
  const bisaBayar = isi.length > 0 && !hitung.galat && !kurangBayar && !uangLebih && !alasanKurang && nDiskon <= hitung.subtotal

  // Kiriman dari sebelum halaman dimuat ulang yang jawabannya tidak sampai: cek statusnya. Catatannya hanya dihapus
  // kalau yang tersimpan masih kiriman yang sama dengan yang dicek.
  const cekSimpanan = useCallback(async (k: Kiriman) => {
    setCekAwal({ jalan: true, pesan: 'Memeriksa transaksi sebelum halaman dimuat ulang. Tunggu sebentar.' })
    let h: HasilCekKunci
    try {
      h = await cekKunciKasir(k)
    } catch {
      setCekAwal({ jalan: false, pesan: 'Transaksi sebelum halaman dimuat ulang belum bisa dicek karena koneksi. Tunggu sinyal kembali, lalu tekan Cek lagi. Bayar dikunci sampai statusnya jelas.' })
      return
    }
    if (!h.ok) {
      setCekAwal({ jalan: false, pesan: `Transaksi sebelum halaman dimuat ulang belum bisa dicek: ${h.pesan} Tekan Cek lagi. Bayar dikunci sampai statusnya jelas.` })
      return
    }
    if (bacaKiriman(cabang.id)?.kunci === k.kunci) ingatKiriman(cabang.id, null)
    setCekAwal(null)
    if (h.status === 'tersimpan') setInfo({ pesan: `Transaksi sebelum halaman dimuat ulang sudah tersimpan sebagai nota ${h.nomor}. Jangan diulang.`, nota: { id: h.id, nomor: h.nomor }, info: true })
    else setInfo({ pesan: 'Transaksi sebelum halaman dimuat ulang tidak tersimpan. Kalau pelanggan masih menunggu, masukkan lagi barangnya.', info: true })
  }, [cabang.id])

  useEffect(() => {
    const k = bacaKiriman(cabang.id)
    // Lewat microtask supaya setState tidak di badan effect. Tetap jalan sebelum kasir sempat mengetuk apa pun.
    if (k) queueMicrotask(() => void cekSimpanan(k))
  }, [cabang.id, cekSimpanan])

  const cekLagi = () => {
    const k = bacaKiriman(cabang.id)
    if (k) void cekSimpanan(k)
    else setCekAwal(null)
  }

  useEffect(() => {
    const d = dlg.current
    if (!d) return
    if (konfirmasi && !d.open) d.showModal()
    if (!konfirmasi && d.open) d.close()
  }, [konfirmasi])

  const bisaTambah = (i: ItemKatalog) => i.harga > 0 && (i.sumber === 'jasa' || (i.stok ?? 0) > 0)

  const tambah = (i: ItemKatalog) => {
    setInfo(null)
    if (i.sumber !== 'jasa') {
      const ada = keranjang.find((b) => b.key === i.key)?.jumlah ?? 0
      if ((i.stok ?? 0) <= ada) {
        setInfo({ pesan: `${i.nama} ${i.keterangan}: stok cabang ini ${i.stok ?? 0}.`.replace(' :', ':'), nama: i.nama, stokLain: i.stokLain })
        return
      }
    }
    if (i.harga <= 0) {
      setInfo({ pesan: `${i.nama}: harga belum diatur${i.sumber === 'jasa' ? ' di Harga jasa' : '. Minta owner mengatur harga batch-nya'}.` })
      return
    }
    setKeranjang((k) => (k.some((b) => b.key === i.key) ? k.map((b) => (b.key === i.key ? { ...b, jumlah: b.jumlah + 1 } : b)) : [...k, { key: i.key, jumlah: 1 }]))
    setQ('')
    cari.current?.focus()
  }

  const ubahJumlah = (key: string, n: number) => {
    const i = peta.get(key)
    if (!i) return
    const batas = i.sumber === 'jasa' ? 9999 : (i.stok ?? 0)
    if (n > batas) setInfo({ pesan: `${i.nama}: stok cabang ini ${batas}.`, nama: i.nama, stokLain: i.stokLain })
    else setInfo(null)
    setKeranjang((k) => k.map((b) => (b.key === key ? { ...b, jumlah: Math.max(1, Math.min(n, batas || 1)) } : b)))
  }

  const bukaKonfirmasi = () => {
    if (!bisaBayar || putus || cekAwal) return
    kunci.current ??= kunciBaru()
    setGalat(null)
    setKonfirmasi(true)
  }

  // Kunci dibuang bersama kirimannya. Hanya boleh sesudah jawaban pasti dari server (berhasil, ditolak, atau Cek status).
  const lepasKunci = () => {
    kunci.current = null
    kiriman.current = null
    ingatKiriman(cabang.id, null)
    setPutus(false)
  }

  const tutupKonfirmasi = () => {
    // Selama status kiriman belum jelas, keranjang tidak boleh diubah. Kasir harus menekan Cek status dulu.
    if (kirim || mengecek || putus) return
    setKonfirmasi(false)
    lepasKunci()
  }

  const simpan = async () => {
    // Kirim ulang sesudah putus memakai isi yang persis sama dengan kiriman pertama.
    if (!putus || !kiriman.current) {
      kunci.current ??= kunciBaru()
      kiriman.current = {
        cabangId: cabang.id,
        channel,
        metode,
        diskon: nDiskon,
        alasanDiskon: alasan,
        dibayar: metode === 'tunai' ? nBayar : null,
        totalDilihat: hitung.total,
        kunci: kunci.current,
        baris: isi.map((b) => {
          const i = peta.get(b.key)!
          return { sumber: i.sumber, id: i.id, ...(i.alt && { alt: true }), jumlah: b.jumlah }
        }),
      }
    }
    ingatKiriman(cabang.id, kiriman.current)
    setKirim(true)
    setGalat(null)
    let h: HasilBayar
    try {
      h = await bayarKasir(kiriman.current)
    } catch {
      setKirim(false)
      setPutus(true)
      setGalat({ pesan: 'Koneksi terputus sebelum jawaban server sampai, jadi belum pasti transaksi ini tersimpan. Keranjang dikunci. Tekan Cek status sebelum melakukan hal lain.' })
      return
    }
    setKirim(false)
    lepasKunci()
    if (!h.ok) {
      setGalat({ pesan: h.pesan, nama: h.nama, stokLain: h.stokLain, nota: h.nota })
      router.refresh()
      return
    }
    router.push(`/admin/nota/${h.id}?baru=1`)
  }

  // Tanya server apakah kiriman yang putus tadi tersimpan. Kalau belum, server menutup kuncinya, jadi kiriman lama
  // yang baru sampai nanti ditolak dan keranjang boleh diubah lalu dikirim dengan kunci baru tanpa nota ganda.
  const cekStatus = async () => {
    if (!kiriman.current) return
    setMengecek(true)
    let h: HasilCekKunci
    try {
      h = await cekKunciKasir(kiriman.current)
    } catch {
      setMengecek(false)
      setGalat({ pesan: 'Masih belum tersambung ke server. Tunggu sinyal kembali, lalu tekan Cek status lagi.' })
      return
    }
    setMengecek(false)
    if (!h.ok) {
      setGalat({ pesan: h.pesan })
      return
    }
    lepasKunci()
    if (h.status === 'tersimpan' && h.cocok) {
      router.push(`/admin/nota/${h.id}?baru=1`)
      return
    }
    if (h.status === 'tersimpan') {
      setGalat({ pesan: `Kiriman tadi tersimpan sebagai nota ${h.nomor}, tetapi isinya berbeda dari keranjang ini. Periksa notanya sebelum menyimpan lagi.`, nota: { id: h.id, nomor: h.nomor } })
      return
    }
    setGalat({ pesan: 'Transaksi tadi tidak tersimpan. Keranjang masih utuh. Periksa lagi, lalu tekan Simpan transaksi untuk mengirimnya sebagai transaksi baru.', info: true })
    router.refresh()
  }

  const kunciKeyboard = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const pas = cocokPersis(katalog, q)
    const pilih = pas ?? hasil[0]
    if (pilih) tambah(pilih)
  }

  const saranUang = [...new Set([hitung.total, Math.ceil(hitung.total / 50_000) * 50_000, Math.ceil(hitung.total / 100_000) * 100_000])].filter((n) => n > 0).slice(0, 3)
  const jumlahBarang = isi.reduce((n, b) => n + b.jumlah, 0)

  const kotakInfo = (g: Galat) => (
    <div role="alert" className={`rounded-lg border px-3 py-2 text-sm ${g.info ? 'border-line bg-soft text-ink' : 'border-red-200 bg-red-50 text-red-800'}`}>
      <p className="font-semibold">{g.pesan}</p>
      {g.nota && (
        <Link href={`/admin/nota/${g.nota.id}`} className="mt-1 inline-flex min-h-11 items-center font-semibold underline">
          Buka nota {g.nota.nomor}
        </Link>
      )}
      {g.stokLain && (
        <p className="mt-0.5">
          {g.stokLain.length ? `Stok di cabang lain: ${g.stokLain.map((s) => `${s.cabang} ${s.stok}`).join(', ')}.` : 'Cabang lain tidak punya barang ini.'}
        </p>
      )}
    </div>
  )

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section aria-labelledby="judul-cari" className="adm-card min-w-0 p-4 sm:p-5">
        <h2 id="judul-cari" className="sr-only">Cari barang atau jasa</h2>
        <label htmlFor="kasir-cari" className="mb-1 block text-xs font-semibold text-neutral-700">Cari ban, produk, atau jasa</label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-mute" />
          <input
            ref={cari}
            id="kasir-cari"
            autoFocus
            autoComplete="off"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              const pas = e.target.value.length >= 8 ? katalog.find((i) => i.barcode && i.barcode === e.target.value.trim()) : null
              if (pas) tambah(pas)
            }}
            onKeyDown={kunciKeyboard}
            placeholder="Ukuran, merek, nama, atau kode. Contoh: 185 65 15"
            className={`${inputCls} min-h-12 pl-10 text-base`}
          />
        </div>
        <p className="mt-1 text-xs text-mute">Enter menambah hasil pertama. Pemindai barcode juga bisa dipakai.</p>
        {info && <div className="mt-3">{kotakInfo(info)}</div>}
        {q.trim() ? (
          hasil.length ? (
            <ul className="mt-3 divide-y divide-line rounded-lg border border-line" aria-label="Hasil pencarian">
              {hasil.map((i) => {
                const habis = i.stok !== null && i.stok <= 0
                const bisa = bisaTambah(i)
                // Baris yang tidak bisa dijual tetap tampil (supaya stok cabang lain terlihat), tetapi bukan tombol.
                const Wadah = bisa ? 'button' : 'div'
                return (
                  <li key={i.key}>
                    <Wadah
                      {...(bisa ? { type: 'button' as const, onClick: () => tambah(i) } : {})}
                      className={`flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left ${bisa ? 'hover:bg-soft' : 'bg-soft/60 text-mute'}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2">
                          <span className="font-semibold text-ink">{i.nama}</span>
                          <span className="text-sm">{i.sumber === 'ban' ? i.keterangan : ''}</span>
                        </span>
                        <span className="block text-xs text-mute">
                          {SUMBER_LABEL[i.sumber]}
                          {i.sumber !== 'ban' && i.keterangan ? ` · ${i.keterangan}` : ''}
                          {i.stok !== null && ` · ${habis ? 'habis di cabang ini' : `stok ${i.stok}`}`}
                          {i.stokLain.length > 0 && ` · ${i.stokLain.map((s) => `${s.cabang} ${s.stok}`).join(', ')}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-sm font-semibold text-ink">
                        {i.harga > 0 ? rp(i.harga) : <span className="text-xs font-semibold text-red-700">harga belum diatur</span>}
                        {i.batch.length > 1 && i.batch[1].harga !== i.batch[0].harga && <span className="block text-[11px] font-normal text-mute">lalu {rp(i.batch[1].harga)}</span>}
                      </span>
                      {bisa ? <Plus aria-hidden className="size-5 shrink-0 text-mute" /> : <span className="shrink-0 text-xs font-semibold">tidak bisa dijual</span>}
                    </Wadah>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-3 rounded-lg border border-dashed border-[#cfcfcf] px-3 py-6 text-center text-sm text-mute">Tidak ada barang atau jasa yang cocok di cabang {cabang.nama}.</p>
          )
        ) : (
          <p className="mt-3 text-sm text-mute">{katalog.filter((i) => i.sumber !== 'jasa').length} barang dan {katalog.filter((i) => i.sumber === 'jasa').length} pilihan jasa di cabang {cabang.nama}.</p>
        )}
      </section>

      <section aria-labelledby="judul-keranjang" className="adm-card min-w-0 p-4 sm:p-5 xl:sticky xl:top-4">
        <h2 id="judul-keranjang" className="font-display text-base font-extrabold text-ink">Keranjang</h2>
        {isi.length ? (
          <ul className="mt-3 divide-y divide-line">
            {isi.map((b) => {
              const i = peta.get(b.key)!
              const r = hitung.rinci.find((x) => x.key === b.key)
              const sub = r?.potongan.reduce((n, p) => n + p.jumlah * p.harga, 0) ?? 0
              return (
                <li key={b.key} className="py-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{i.nama} {i.sumber === 'ban' ? <span className="font-normal">{i.keterangan}</span> : null}</p>
                      <p className="text-xs text-mute">{r?.galat || r?.potongan.map((p) => `${p.jumlah} × ${rp(p.harga)}`).join(' + ')}</p>
                    </div>
                    <button type="button" onClick={() => setKeranjang((k) => k.filter((x) => x.key !== b.key))} aria-label={`Hapus ${i.nama} dari keranjang`} className="adm-icon-btn size-11 border-transparent">
                      <X aria-hidden className="size-5" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => ubahJumlah(b.key, b.jumlah - 1)} disabled={b.jumlah <= 1} aria-label={`Kurangi ${i.nama}`} className="adm-icon-btn size-11 disabled:opacity-40">
                        <Minus aria-hidden className="size-4" />
                      </button>
                      <span className="block w-16">
                        <input
                          aria-label={`Jumlah ${i.nama}`}
                          inputMode="numeric"
                          value={b.jumlah}
                          onChange={(e) => ubahJumlah(b.key, Number(digit(e.target.value)) || 1)}
                          className={`${inputCls} min-h-11 text-center text-base`}
                        />
                      </span>
                      <button type="button" onClick={() => ubahJumlah(b.key, b.jumlah + 1)} aria-label={`Tambah ${i.nama}`} className="adm-icon-btn size-11">
                        <Plus aria-hidden className="size-4" />
                      </button>
                    </div>
                    <p className="whitespace-nowrap font-semibold text-ink">{rp(sub)}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-mute">Belum ada barang. Cari lalu tekan barangnya untuk menambah.</p>
        )}

        <div id="pembayaran" className="mt-4 scroll-mt-20 space-y-4 border-t border-line pt-4">
          <Pilihan label="Channel" nilai={channel} ubah={setChannel} pilihan={CHANNEL.map((v) => ({ v, t: CHANNEL_LABEL[v] }))} />
          <Pilihan label="Metode bayar" nilai={metode} ubah={setMetode} pilihan={METODE_BAYAR.map((v) => ({ v, t: METODE_LABEL[v] }))} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <div>
              <label htmlFor="kasir-diskon" className="mb-1 block text-xs font-semibold text-neutral-700">Diskon nota (Rp)</label>
              <input id="kasir-diskon" inputMode="numeric" value={diskon} onChange={(e) => setDiskon(digit(e.target.value))} placeholder="0" aria-describedby="kasir-diskon-rp" className={`${inputCls} min-h-11 text-right`} />
              <span id="kasir-diskon-rp" className="mt-0.5 block h-4 text-right text-[11px] leading-4 text-mute">{nDiskon > 0 ? rp(nDiskon) : ''}</span>
            </div>
            {nDiskon > 0 && (
              <div>
                <label htmlFor="kasir-alasan" className="mb-1 block text-xs font-semibold text-neutral-700">Alasan diskon</label>
                <input id="kasir-alasan" value={alasan} maxLength={200} onChange={(e) => setAlasan(e.target.value)} placeholder="Mis. keluarga pemilik" className={`${inputCls} min-h-11`} />
              </div>
            )}
          </div>
          {nDiskon > 0 && <p className="-mt-2 text-xs text-mute">{owner ? 'Diskon dari owner langsung berlaku dan tercatat di log.' : 'Transaksi tetap jalan. Diskon ini masuk antrean tinjau owner.'}</p>}
          {nDiskon > hitung.subtotal && <p className="-mt-2 text-xs font-semibold text-red-700">Diskon tidak boleh melebihi subtotal.</p>}
          {metode === 'tunai' && (
            <div>
              <label htmlFor="kasir-bayar" className="mb-1 block text-xs font-semibold text-neutral-700">Uang diterima (Rp)</label>
              <input id="kasir-bayar" inputMode="numeric" value={dibayar} onChange={(e) => setDibayar(digit(e.target.value).slice(0, 10))} placeholder="0" aria-describedby="kasir-bayar-rp" className={`${inputCls} min-h-12 text-right text-base`} />
              <span id="kasir-bayar-rp" className="mt-0.5 block h-4 text-right text-[11px] leading-4 text-mute">{nBayar > 0 ? rp(nBayar) : ''}</span>
              {saranUang.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {saranUang.map((n, k) => (
                    <button key={n} type="button" onClick={() => setDibayar(String(n))} className="adm-btn-line adm-btn-sm min-h-11">
                      {k === 0 ? 'Uang pas' : rp(n)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-mute">Subtotal</dt><dd>{rp(hitung.subtotal)}</dd></div>
            {hitung.diskon > 0 && <div className="flex justify-between"><dt className="text-mute">Diskon</dt><dd>-{rp(hitung.diskon)}</dd></div>}
            <div className="flex justify-between border-t border-line pt-2 text-lg font-extrabold text-ink"><dt>Total</dt><dd>{rp(hitung.total)}</dd></div>
            {metode === 'tunai' && nBayar > 0 && (
              <div className="flex justify-between font-semibold">
                <dt>{kurangBayar ? 'Kurang' : 'Kembalian'}</dt>
                <dd className={kurangBayar ? 'text-red-700' : 'text-ink'}>{rp(Math.abs(nBayar - hitung.total))}</dd>
              </div>
            )}
          </dl>
          {cekAwal && (
            <div role="status" className="rounded-lg border border-line bg-soft px-3 py-2 text-sm text-ink">
              <p className="font-semibold">{cekAwal.pesan}</p>
              {!cekAwal.jalan && (
                <button type="button" onClick={cekLagi} className="adm-btn mt-2 min-h-11">
                  Cek lagi
                </button>
              )}
            </div>
          )}
          <button type="button" onClick={bukaKonfirmasi} disabled={!bisaBayar || cekAwal !== null} className="adm-btn adm-btn-lg w-full text-base">
            {isi.length ? `Bayar ${rp(hitung.total)}` : 'Bayar'}
          </button>
          {isi.length > 0 && !bisaBayar && (
            <p className="text-xs text-mute">
              {hitung.galat
                ? 'Periksa baris yang bertanda di keranjang.'
                : alasanKurang
                  ? 'Tulis alasan diskon.'
                  : kurangBayar
                    ? 'Isi uang diterima, paling sedikit sebesar total.'
                    : uangLebih
                      ? `Uang diterima paling banyak ${rp(MAKS_UANG)} karena batas penyimpanan. Periksa lagi angkanya.`
                      : ''}
            </p>
          )}
        </div>
      </section>

      {/* Bilah bawah di HP dan tablet: total selalu terlihat, tombol membawa ke bagian pembayaran. */}
      {isi.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 shadow-[0_-8px_16px_-12px_rgba(0,0,0,.3)] backdrop-blur md:left-60 xl:hidden">
          <div className="mx-auto flex max-w-[1200px] items-center gap-3">
            <p className="min-w-0 flex-1 text-sm">
              <span className="block text-xs text-mute">{jumlahBarang} barang</span>
              <span className="font-extrabold text-ink">{rp(hitung.total)}</span>
            </p>
            <a href="#pembayaran" className="adm-btn min-h-12">Ke pembayaran</a>
          </div>
        </div>
      )}
      {isi.length > 0 && <div aria-hidden className="h-20 xl:hidden" />}

      <dialog
        ref={dlg}
        data-variant="modal"
        aria-labelledby="judul-konfirmasi"
        className="adm-overlay"
        onCancel={(e) => {
          e.preventDefault()
          tutupKonfirmasi()
        }}
        onClose={() => {
          // Browser bisa menutup dialog tanpa cancel yang bisa dicegah (Escape kedua, tombol Kembali Android).
          // Selama status kiriman belum jelas, dialog dibuka lagi supaya keranjang tetap terkunci.
          if (!konfirmasi) return
          if (kirim || mengecek || putus) {
            dlg.current?.showModal()
            return
          }
          setKonfirmasi(false)
          lepasKunci()
        }}
      >
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="border-b border-line px-5 pb-3 pt-5">
            <h2 id="judul-konfirmasi" className="font-display text-lg font-extrabold text-ink">Simpan transaksi?</h2>
            <p className="mt-1 text-sm text-mute">Cabang {cabang.nama} · {CHANNEL_LABEL[channel]} · {METODE_LABEL[metode]}</p>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-5 text-sm">
            <ul className="divide-y divide-line">
              {isi.map((b) => {
                const i = peta.get(b.key)!
                const r = hitung.rinci.find((x) => x.key === b.key)
                return (
                  <li key={b.key} className="flex justify-between gap-3 py-2">
                    <span className="min-w-0">
                      {i.nama} {i.sumber === 'ban' ? i.keterangan : ''}
                      <span className="block text-xs text-mute">{r?.potongan.map((p) => `${p.jumlah} × ${rp(p.harga)}`).join(' + ')}</span>
                    </span>
                    <span className="shrink-0 font-semibold">{rp(r?.potongan.reduce((n, p) => n + p.jumlah * p.harga, 0) ?? 0)}</span>
                  </li>
                )
              })}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-line pt-3">
              {hitung.diskon > 0 && <div className="flex justify-between"><dt className="text-mute">Diskon ({alasan.trim()})</dt><dd>-{rp(hitung.diskon)}</dd></div>}
              <div className="flex justify-between text-base font-extrabold text-ink"><dt>Total</dt><dd>{rp(hitung.total)}</dd></div>
              {metode === 'tunai' && (
                <>
                  <div className="flex justify-between"><dt className="text-mute">Uang diterima</dt><dd>{rp(nBayar)}</dd></div>
                  <div className="flex justify-between font-semibold"><dt>Kembalian</dt><dd>{rp(nBayar - hitung.total)}</dd></div>
                </>
              )}
            </dl>
            {galat && <div className="mt-4">{kotakInfo(galat)}</div>}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">
            {putus ? (
              <>
                <button type="button" onClick={simpan} disabled={kirim || mengecek} className="adm-btn-line min-h-12">
                  {kirim ? 'Mengirim ulang...' : 'Kirim ulang yang sama'}
                </button>
                <button type="button" onClick={cekStatus} disabled={kirim || mengecek} className="adm-btn min-h-12">
                  {mengecek ? 'Mengecek...' : 'Cek status'}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={tutupKonfirmasi} disabled={kirim} className="adm-btn-line min-h-12">Kembali</button>
                <button type="button" onClick={simpan} disabled={kirim} className="adm-btn min-h-12" data-autofocus>
                  {kirim ? 'Menyimpan...' : 'Simpan transaksi'}
                </button>
              </>
            )}
          </div>
        </div>
      </dialog>
    </div>
  )
}
