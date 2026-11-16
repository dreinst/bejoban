import { headers } from 'next/headers'
import { requireOwner } from '@/lib/auth'
import { CopyButton } from '@/components/admin/copy-button'
import { saveSitus } from '../../fitur-actions'
import { getSitus } from '@/lib/situs-server'
import { db } from '@/lib/db'
import { branchLabel, waHref } from '@/lib/situs'
import { PageBody, PageHeader, Section, SettingsGrid } from '@/components/admin/ui'
import { DataTable } from '@/components/admin/data-table'
import { CheckField, FormActions, FormGrid, TextField } from '@/components/admin/field'
import { SubmitButton } from '@/components/admin/overlay'

// Tanggal awal (waktu Jakarta) untuk hitungan klik n hari terakhir.
function clickSince(days: number) {
  return new Date(Date.now() + 7 * 3600_000 - (days - 1) * 86400_000).toISOString().slice(0, 10)
}

export default async function Situs() {
  await requireOwner()
  const [s, branches] = await Promise.all([getSitus(), db.branch.findMany({ orderBy: { sort: 'asc' } })])
  const h = await headers()
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host') ?? 'localhost'}`
  const clicks = await db.waClick.findMany({ where: { day: { gte: clickSince(14) } }, orderBy: { day: 'desc' } })
  const days = [...new Set(clicks.map((c) => c.day))]
  const links = [{ path: '/wa/batu', label: 'Batu' }, { path: '/wa/karanglo', label: 'Karanglo' }, { path: '/wa', label: 'Umum (tanpa cabang)' }].map((l) => {
    const slug = l.path === '/wa' ? '' : l.path.slice(4)
    return { ...l, url: origin + l.path, slug, total: clicks.filter((c) => c.branch === slug).reduce((a, c) => a + c.count, 0) }
  })
  const bagian = (b: string) => <input type="hidden" name="bagian" value={b} />
  return (
    <PageBody>
      <PageHeader title="Tautan WhatsApp" note="Tombol WhatsApp dan tampilan harga di situs." />

      <div>
        <h2 className="font-display text-base font-extrabold text-ink">Tautan pendek WhatsApp</h2>
        <p className="mb-3 mt-1 max-w-3xl text-sm text-mute">Semua tombol WhatsApp di situs memakai tautan ini. Pasang juga di Google Maps, bio Instagram, dan QR di toko. Kalau nomor atau kalimat pembuka diubah, tautannya tetap sama.</p>
        <DataTable
          caption="Tautan pendek WhatsApp per cabang"
          rows={links}
          rowKey={(l) => l.path}
          columns={[
            { key: 'nama', header: 'Nama', cell: (l) => <span className="font-semibold text-ink">{l.label}</span> },
            { key: 'tautan', header: 'Tautan', cell: (l) => <code className="break-all text-xs">{l.url}</code> },
            { key: 'klik', header: 'Klik 14 hari', align: 'right', className: 'whitespace-nowrap', cell: (l) => l.total.toLocaleString('id-ID') },
          ]}
          actions={(l) => <CopyButton text={l.url} label="Salin tautan" />}
        />
      </div>

      {days.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-base font-extrabold text-ink">Klik per hari</h2>
          <DataTable
            caption="Jumlah klik tautan WhatsApp per hari, 14 hari terakhir"
            rows={days}
            rowKey={(d) => d}
            columns={[
              { key: 'hari', header: 'Hari', className: 'whitespace-nowrap', cell: (d) => <span className="font-semibold text-ink">{d}</span> },
              ...links.map((l) => ({
                key: l.path,
                header: l.label,
                align: 'right' as const,
                cell: (d: string) => (clicks.find((c) => c.day === d && c.branch === l.slug)?.count ?? 0).toLocaleString('id-ID'),
              })),
            ]}
          />
        </div>
      )}

      <SettingsGrid>
        <Section id="nomor" title="Nomor WhatsApp utama">
          <form action={saveSitus}>
            {bagian('nomor')}
            <FormGrid cols={1}>
              <TextField
                label="Satu nomor untuk semua cabang"
                hint="Kalau diisi, semua tombol WhatsApp di situs memakai nomor ini dan cabang dibedakan dari kalimat pembuka. Kosongkan untuk memakai nomor tiap cabang."
                name="mainWhatsapp"
                defaultValue={s.mainWhatsapp}
                placeholder="0812... (kosong: pakai nomor tiap cabang)"
                inputMode="tel"
              />
            </FormGrid>
            <FormActions><SubmitButton>Simpan nomor</SubmitButton></FormActions>
          </form>
        </Section>

        <Section id="harga" title="Harga di situs">
          <form action={saveSitus}>
            {bagian('harga')}
            <CheckField
              label="Tampilkan harga di situs"
              name="showPrices"
              defaultChecked={s.showPrices}
              hint="Kalau mati, beranda dan halaman produk hanya menampilkan ajakan tanya harga lewat WhatsApp. Harga jasa tidak pernah tampil di situs."
            />
            <FormActions><SubmitButton>Simpan</SubmitButton></FormActions>
          </form>
        </Section>

        <Section id="pembuka" title="Kalimat pembuka" wide>
          <form action={saveSitus} className="max-w-[640px]">
            {bagian('pembuka')}
            <FormGrid cols={1}>
              <TextField label="Tombol umum (beranda, footer, tombol Chat)" name="opUmum" defaultValue={s.openers.umum} />
              <TextField
                label="Halaman produk"
                hint={<>{'{cabang}'} diganti nama cabang dan {'{produk}'} diganti nama produk. Pertahankan {'{cabang}'} karena bot mengenali cabang dari kata itu.</>}
                name="opProduk"
                defaultValue={s.openers.produk}
              />
            </FormGrid>
            <div className="mt-4 text-xs text-mute">
              <p className="font-semibold text-ink">Hasil saat ini</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {branches.map((b) => <li key={b.id}>{branchLabel(b.name)}: <span className="break-all">{decodeURIComponent(waHref(s, b, 'umum'))}</span></li>)}
              </ul>
            </div>
            <FormActions><SubmitButton>Simpan kalimat pembuka</SubmitButton></FormActions>
          </form>
        </Section>
      </SettingsGrid>
    </PageBody>
  )
}
