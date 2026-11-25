import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { waktuWib } from '@/lib/format'
import { CHANNEL_LABEL, METODE_LABEL, syaratVoid, type Channel, type MetodeBayar } from '@/lib/kasir/logika'
import { namaPendek } from '@/lib/tire/cabang'
import { CopyButton } from '@/components/admin/copy-button'
import { Toast } from '@/components/admin/toast'
import { FormActions, TextAreaField } from '@/components/admin/field'
import { CloseButton, Modal, SubmitButton } from '@/components/admin/overlay'
import { voidKasir } from '../../kasir-actions'
import { TombolBagikan, TombolCetak, UkuranKertas } from './nota-aksi'

export const metadata = { title: 'Nota | Bejo Ban', manifest: '/kasir.webmanifest' }

// Kertas cetak: lebar isi nota dan ukuran halaman untuk dialog cetak browser. CSS tidak menerima "58mm auto", jadi
// kertas gulung diberi tinggi cadangan di sini, lalu UkuranKertas menggantinya dengan tinggi isi nota yang diukur.
const KERTAS = {
  '58': { label: '58 mm', lebar: '48mm', halaman: '58mm 200mm', margin: '3mm 5mm', gulung: '58mm' },
  '80': { label: '80 mm', lebar: '72mm', halaman: '80mm 200mm', margin: '3mm 4mm', gulung: '80mm' },
  a4: { label: 'A4', lebar: '170mm', halaman: 'A4', margin: '15mm 20mm', gulung: null },
} as const
type Kertas = keyof typeof KERTAS

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

// Nota digital satu transaksi. Di luar panel admin supaya cetaknya bersih. Admin hanya melihat nota cabangnya.
export default async function Nota({ params, searchParams }: PageProps<'/admin/nota/[id]'>) {
  const s = await requireUser()
  const { id } = await params
  const sp = await searchParams
  const t = await db.transaksi.findUnique({ where: { id: Number(id) || 0 }, include: { detail: { orderBy: { id: 'asc' } } } })
  if (!t) notFound()
  if (s.role !== 'OWNER' && s.branchId !== t.cabangId) redirect('/admin/kasir/riwayat?err=' + encodeURIComponent('Nota itu milik cabang lain'))
  const cabang = await db.branch.findUnique({ where: { id: t.cabangId }, select: { name: true, address: true, whatsapp: true } })
  const kertas: Kertas = sp.kertas === '58' || sp.kertas === '80' || sp.kertas === 'a4' ? sp.kertas : '80'
  const k = KERTAS[kertas]
  const voidAda = t.status === 'void'
  const pemvoid = t.divoidOleh ? await db.user.findUnique({ where: { id: t.divoidOleh }, select: { name: true, username: true } }) : null
  const bolehVoid = syaratVoid({ peran: s.role, cabangSesi: s.branchId, cabangTransaksi: t.cabangId, status: t.status, waktuTransaksi: t.waktuTransaksi, sekarang: new Date(), alasan: 'cek' }).boleh
  const namaCabang = cabang ? namaPendek(cabang.name) : `Cabang ${t.cabangId}`
  const url = (kr: Kertas) => `/admin/nota/${t.id}?kertas=${kr}`

  // Teks polos untuk disalin atau dibagikan ke chat WhatsApp pelanggan.
  const teks = [
    `Bejo Ban ${namaCabang}`,
    cabang?.address,
    cabang?.whatsapp ? `WA ${cabang.whatsapp}` : '',
    '',
    `Nota ${t.nomor}${voidAda ? ' (VOID)' : ''}`,
    `${waktuWib(t.waktuTransaksi)} WIB`,
    `Kasir ${t.namaKasir} · ${CHANNEL_LABEL[t.channel as Channel] ?? t.channel}`,
    '',
    ...t.detail.map((d) => `${d.nama}\n  ${d.jumlah} x ${rp(d.hargaSatuan)} = ${rp(d.subtotal)}`),
    '',
    `Subtotal ${rp(t.subtotal)}`,
    ...(t.diskon ? [`Diskon -${rp(t.diskon)}`] : []),
    `Total ${rp(t.total)}`,
    `Bayar ${METODE_LABEL[t.metodeBayar as MetodeBayar] ?? t.metodeBayar}${t.dibayar !== null ? ` ${rp(t.dibayar)}` : ''}`,
    ...(t.kembalian !== null ? [`Kembalian ${rp(t.kembalian)}`] : []),
    '',
    'Harga sudah termasuk pajak. Terima kasih.',
  ]
    .filter((x) => x !== undefined)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')

  const baris = 'flex justify-between gap-3'
  return (
    <div className="min-h-screen bg-soft px-4 py-6 text-ink print:bg-white print:p-0">
      <style>{`@media print { @page { size: ${k.halaman}; margin: ${k.margin}; } }`}</style>
      {k.gulung && <UkuranKertas isiId="isi-nota" lebar={k.gulung} margin={k.margin} />}
      <div className="mx-auto mb-5 max-w-3xl space-y-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/kasir" className="adm-btn-line min-h-11">Transaksi baru</Link>
          <Link href="/admin/kasir/riwayat" className="adm-btn-line min-h-11">Riwayat</Link>
          <span className="flex-1" />
          <TombolCetak />
          <TombolBagikan teks={teks} judul={`Nota ${t.nomor}`} />
          <CopyButton text={teks} label="Salin teks" pesan="Teks nota tersalin" className="adm-btn-line min-h-11" />
        </div>
        <nav aria-label="Ukuran kertas" className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-semibold text-mute">Kertas</span>
          {(Object.keys(KERTAS) as Kertas[]).map((kr) => (
            <Link key={kr} href={url(kr)} aria-current={kr === kertas ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-full border px-4 font-semibold ${kr === kertas ? 'border-accent bg-accent text-ink' : 'border-[#cfcfcf] bg-white'}`}>
              {KERTAS[kr].label}
            </Link>
          ))}
        </nav>
        {sp.baru === '1' && !voidAda && <p role="status" className="rounded-lg border border-ok-line bg-ok-soft px-4 py-3 text-sm font-semibold text-ok">Transaksi {t.nomor} tersimpan.</p>}
      </div>

      <article
        aria-label={`Nota ${t.nomor}`}
        className="relative mx-auto bg-white p-4 font-mono text-[12px] leading-snug shadow-sm print:p-0 print:shadow-none"
        style={{ width: `calc(${k.lebar} + 2rem)`, maxWidth: '100%' }}
      >
        <div id="isi-nota" className="mx-auto print:!w-auto" style={{ width: k.lebar, maxWidth: '100%' }}>
          {voidAda && (
            <p className="mb-2 border-2 border-ink py-1 text-center text-base font-extrabold tracking-widest">VOID</p>
          )}
          <header className="text-center">
            <p className="text-sm font-extrabold">BEJO BAN</p>
            <p>{namaCabang}</p>
            {cabang?.address && <p>{cabang.address}</p>}
            {cabang?.whatsapp && <p>WA {cabang.whatsapp}</p>}
          </header>
          <div className="my-2 border-t border-dashed border-ink" />
          <p className={baris}><span>No</span><span className="text-right">{t.nomor}</span></p>
          <p className={baris}><span>Waktu</span><span className="text-right">{waktuWib(t.waktuTransaksi)} WIB</span></p>
          <p className={baris}><span>Kasir</span><span className="text-right">{t.namaKasir}</span></p>
          <p className={baris}><span>Channel</span><span className="text-right">{CHANNEL_LABEL[t.channel as Channel] ?? t.channel}</span></p>
          <div className="my-2 border-t border-dashed border-ink" />
          <ul className="space-y-1.5">
            {t.detail.map((d) => (
              <li key={d.id}>
                <p className="break-words">{d.nama}</p>
                <p className={baris}>
                  <span>{d.jumlah} x {rp(d.hargaSatuan)}</span>
                  <span>{rp(d.subtotal)}</span>
                </p>
              </li>
            ))}
          </ul>
          <div className="my-2 border-t border-dashed border-ink" />
          <p className={baris}><span>Subtotal</span><span>{rp(t.subtotal)}</span></p>
          {t.diskon > 0 && <p className={baris}><span>Diskon</span><span>-{rp(t.diskon)}</span></p>}
          <p className={`${baris} text-sm font-extrabold`}><span>TOTAL</span><span>{rp(t.total)}</span></p>
          <p className={baris}><span>{METODE_LABEL[t.metodeBayar as MetodeBayar] ?? t.metodeBayar}</span><span>{rp(t.dibayar ?? t.total)}</span></p>
          {t.kembalian !== null && <p className={baris}><span>Kembalian</span><span>{rp(t.kembalian)}</span></p>}
          <div className="my-2 border-t border-dashed border-ink" />
          <p className="text-center">Harga sudah termasuk pajak.</p>
          <p className="text-center">Terima kasih.</p>
          {voidAda && (
            <p className="mt-2 text-center">
              Di-void {t.waktuVoid ? `${waktuWib(t.waktuVoid)} WIB` : ''}{pemvoid ? ` oleh ${pemvoid.name || pemvoid.username}` : ''}. Alasan: {t.alasanVoid}
            </p>
          )}
        </div>
      </article>

      <div className="mx-auto mt-5 max-w-3xl print:hidden">
        {t.diskon > 0 && <p className="mb-3 text-sm text-mute">Alasan diskon: {t.alasanDiskon || '-'}</p>}
        {bolehVoid && (
          <Modal trigger="Void transaksi" triggerClassName="adm-btn-danger min-h-11" title={`Void ${t.nomor}?`} description="Stok tiap barang kembali ke batch asalnya. Nota tetap tersimpan dengan tanda VOID.">
            <form action={voidKasir}>
              <input type="hidden" name="id" value={t.id} />
              <TextAreaField label="Alasan void" name="alasan" rows={3} required minLength={3} maxLength={200} placeholder="Mis. pelanggan batal, salah input jumlah" />
              <FormActions>
                <CloseButton />
                <SubmitButton className="adm-btn-danger" pending="Memproses...">Void transaksi</SubmitButton>
              </FormActions>
            </form>
          </Modal>
        )}
        {!bolehVoid && !voidAda && s.role !== 'OWNER' && <p className="text-sm text-mute">Void hanya bisa dilakukan admin di hari transaksi. Minta owner kalau perlu membatalkan nota ini.</p>}
      </div>
      <Suspense>
        <Toast />
      </Suspense>
    </div>
  )
}
