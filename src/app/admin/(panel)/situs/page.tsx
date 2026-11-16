import { headers } from 'next/headers'
import { requireOwner } from '@/lib/auth'
import { CopyButton } from '@/components/admin/copy-button'
import { saveSitus } from '../../fitur-actions'
import { getSitus } from '@/lib/situs-server'
import { db } from '@/lib/db'
import { branchLabel, waHref } from '@/lib/situs'
import { inputCls } from '@/components/admin/section-editor'
import { Card, labelCls } from '@/components/admin/simple-list'

// Tanggal awal (waktu Jakarta) untuk hitungan klik n hari terakhir.
async function clickSince(days: number) {
  return new Date(Date.now() + 7 * 3600_000 - (days - 1) * 86400_000).toISOString().slice(0, 10)
}

export default async function Situs() {
  await requireOwner()
  const [s, branches] = await Promise.all([getSitus(), db.branch.findMany({ orderBy: { sort: 'asc' } })])
  const h = await headers()
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host') ?? 'localhost'}`
  const since = await clickSince(14)
  const clicks = await db.waClick.findMany({ where: { day: { gte: since } }, orderBy: { day: 'desc' } })
  const days = [...new Set(clicks.map((c) => c.day))]
  const links = [{ path: '/wa/batu', label: 'Batu' }, { path: '/wa/karanglo', label: 'Karanglo' }, { path: '/wa', label: 'Umum (tanpa cabang)' }].map((l) => {
    const slug = l.path === '/wa' ? '' : l.path.slice(4)
    return { ...l, url: origin + l.path, slug, total: clicks.filter((c) => c.branch === slug).reduce((a, c) => a + c.count, 0) }
  })
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold text-ink">Situs dan WhatsApp</h1>
      <p className="text-sm text-neutral-500">Pengaturan tombol WhatsApp dan harga di situs publik. Halaman admin tetap menampilkan harga.</p>
      <Card title="Tautan pendek WhatsApp">
        <p className="mb-3 text-xs text-neutral-500">Semua tombol WhatsApp di situs memakai tautan ini. Pasang juga di Google Maps, bio Instagram, dan QR di toko. Nomor dan kalimat pembuka cukup diubah di bawah, tautannya tidak berubah.</p>
        <div className="space-y-2">
          {links.map((l) => (
            <div key={l.path} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="w-40 font-semibold">{l.label}</span>
              <code className="flex-1 break-all rounded bg-neutral-100 px-2 py-1 text-xs">{l.url}</code>
              <span className="text-xs text-neutral-500">{l.total} klik (14 hari)</span>
              <CopyButton text={l.url} label="Salin tautan" />
            </div>
          ))}
        </div>
        {days.length > 0 && (
          <table className="mt-4 text-xs">
            <thead><tr className="text-left text-neutral-600"><th className="pr-4">Hari</th>{links.map((l) => <th key={l.path} className="pr-4">{l.label}</th>)}</tr></thead>
            <tbody>{days.map((d) => <tr key={d}><td className="pr-4">{d}</td>{links.map((l) => <td key={l.path} className="pr-4">{clicks.find((c) => c.day === d && c.branch === l.slug)?.count ?? 0}</td>)}</tr>)}</tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-neutral-500">Hanya hitungan per cabang per hari yang disimpan, tanpa data pribadi.</p>
      </Card>
      <form action={saveSitus} className="space-y-4">
        <Card title="Nomor WhatsApp utama">
          <label className={labelCls}>Satu nomor untuk semua cabang
            <input name="mainWhatsapp" defaultValue={s.mainWhatsapp} placeholder="0812... (kosong: pakai nomor tiap cabang)" className={inputCls} />
          </label>
          <p className="mt-2 text-xs text-neutral-500">Kalau diisi, semua tombol WhatsApp dan checkout keranjang memakai nomor ini. Cabang dibedakan dari kalimat pembuka di bawah, dan bot mengenali cabang dari kata nama cabang di kalimat itu. Kalau kalimat diedit, pertahankan nama cabangnya (variabel {'{cabang}'}).</p>
        </Card>
        <Card title="Kalimat pembuka">
          <div className="grid gap-3">
            <label className={labelCls}>Tombol umum (beranda, footer, tombol Chat)
              <input name="opUmum" defaultValue={s.openers.umum} className={inputCls} />
              <span className="font-normal text-neutral-500">Variabel: {'{cabang}'}</span>
            </label>
            <label className={labelCls}>Halaman produk
              <input name="opProduk" defaultValue={s.openers.produk} className={inputCls} />
              <span className="font-normal text-neutral-500">Variabel: {'{cabang}'} {'{produk}'}</span>
            </label>
            <label className={labelCls}>Checkout keranjang (diikuti daftar barang)
              <input name="opKeranjang" defaultValue={s.openers.keranjang} className={inputCls} />
              <span className="font-normal text-neutral-500">Variabel: {'{cabang}'}</span>
            </label>
          </div>
          <div className="mt-3 text-xs text-neutral-600">
            <p className="font-semibold">Hasil saat ini</p>
            <ul className="list-disc pl-5">{branches.map((b) => <li key={b.id}>{branchLabel(b.name)}: <span className="break-all">{decodeURIComponent(waHref(s, b, 'umum'))}</span></li>)}</ul>
          </div>
        </Card>
        <Card title="Harga di situs">
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="showPrices" defaultChecked={s.showPrices} />Tampilkan harga di situs</label>
          <p className="mt-2 text-xs text-neutral-500">Bawaan mati. Kalau mati, beranda, daftar produk, detail, keranjang, dan flash sale hanya menampilkan ajakan tanya harga lewat WhatsApp. Harga jasa tidak pernah tampil di situs.</p>
        </Card>
        <button className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white">Simpan</button>
      </form>
    </div>
  )
}
