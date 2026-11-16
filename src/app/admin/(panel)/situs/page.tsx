import { headers } from 'next/headers'
import { requireOwner } from '@/lib/auth'
import { CopyButton } from '@/components/admin/copy-button'
import { saveSitus } from '../../fitur-actions'
import { getSitus } from '@/lib/situs-server'
import { db } from '@/lib/db'
import { branchLabel, waHref } from '@/lib/situs'
import { inputCls } from '@/components/admin/section-editor'
import { Card, labelCls } from '@/components/admin/simple-list'
import { PageHeader } from '@/components/admin/ui'

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
  const bagian = (b: string) => <input type="hidden" name="bagian" value={b} />
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Tautan WhatsApp" note="Tombol WhatsApp dan tampilan harga di situs." />
      <Card title="Tautan pendek WhatsApp">
        <p className="mb-3 text-xs text-neutral-500">Semua tombol WhatsApp di situs memakai tautan ini. Pasang juga di Google Maps, bio Instagram, dan QR di toko. Kalau nomor atau kalimat pembuka diubah, tautannya tetap sama.</p>
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
          <div className="mt-4 overflow-x-auto">
            <table className="text-xs">
              <thead><tr className="text-left text-neutral-600"><th className="pr-4">Hari</th>{links.map((l) => <th key={l.path} className="pr-4">{l.label}</th>)}</tr></thead>
              <tbody>{days.map((d) => <tr key={d}><td className="pr-4">{d}</td>{links.map((l) => <td key={l.path} className="pr-4">{clicks.find((c) => c.day === d && c.branch === l.slug)?.count ?? 0}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </Card>
      <section id="nomor">
        <Card title="Nomor WhatsApp utama">
          <form action={saveSitus} className="space-y-3">
            {bagian('nomor')}
            <label className={labelCls}>Satu nomor untuk semua cabang
              <input name="mainWhatsapp" defaultValue={s.mainWhatsapp} placeholder="0812... (kosong: pakai nomor tiap cabang)" className={inputCls} />
            </label>
            <p className="text-xs text-neutral-500">Kalau diisi, semua tombol WhatsApp di situs memakai nomor ini dan cabang dibedakan dari kalimat pembuka. Kosongkan untuk memakai nomor tiap cabang.</p>
            <button className="adm-btn">Simpan nomor</button>
          </form>
        </Card>
      </section>
      <section id="pembuka">
        <Card title="Kalimat pembuka">
          <form action={saveSitus} className="grid gap-3">
            {bagian('pembuka')}
            <label className={labelCls}>Tombol umum (beranda, footer, tombol Chat)
              <input name="opUmum" defaultValue={s.openers.umum} className={inputCls} />
            </label>
            <label className={labelCls}>Halaman produk
              <input name="opProduk" defaultValue={s.openers.produk} className={inputCls} />
            </label>
            <p className="text-xs text-neutral-500">{'{cabang}'} diganti nama cabang dan {'{produk}'} diganti nama produk. Pertahankan {'{cabang}'} karena bot mengenali cabang dari kata itu.</p>
            <div className="text-xs text-neutral-600">
              <p className="font-semibold">Hasil saat ini</p>
              <ul className="list-disc pl-5">{branches.map((b) => <li key={b.id}>{branchLabel(b.name)}: <span className="break-all">{decodeURIComponent(waHref(s, b, 'umum'))}</span></li>)}</ul>
            </div>
            <button className="w-fit adm-btn">Simpan kalimat pembuka</button>
          </form>
        </Card>
      </section>
      <section id="harga">
        <Card title="Harga di situs">
          <form action={saveSitus} className="space-y-3">
            {bagian('harga')}
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="showPrices" defaultChecked={s.showPrices} />Tampilkan harga di situs</label>
            <p className="text-xs text-neutral-500">Kalau mati, beranda dan halaman produk hanya menampilkan ajakan tanya harga lewat WhatsApp. Harga jasa tidak pernah tampil di situs.</p>
            <button className="adm-btn">Simpan</button>
          </form>
        </Card>
      </section>
    </div>
  )
}
