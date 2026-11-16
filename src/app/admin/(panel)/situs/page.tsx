import Link from 'next/link'
import { requireOwner } from '@/lib/auth'
import { CopyButton } from '@/components/admin/copy-button'
import { saveSitus } from '../../fitur-actions'
import { alamatSitus, getSitus } from '@/lib/situs-server'
import { db } from '@/lib/db'
import { branchLabel, waNumber } from '@/lib/situs'
import { renderTemplate } from '@/lib/text/template'
import { PageBody, PageHeader, Section, SettingsGrid } from '@/components/admin/ui'
import { DataTable } from '@/components/admin/data-table'
import { FormActions, FormGrid, TextField } from '@/components/admin/field'
import { SubmitButton } from '@/components/admin/overlay'
import { FormPulih } from '@/components/admin/form-pulih'

// Tanggal awal (waktu Jakarta) untuk hitungan klik n hari terakhir.
function clickSince(days: number) {
  return new Date(Date.now() + 7 * 3600_000 - (days - 1) * 86400_000).toISOString().slice(0, 10)
}

export default async function Situs() {
  await requireOwner()
  const [s, branches, origin] = await Promise.all([getSitus(), db.branch.findMany({ orderBy: { sort: 'asc' } }), alamatSitus()])
  const clicks = await db.waClick.findMany({ where: { day: { gte: clickSince(14) } }, orderBy: { day: 'desc' } })
  const days = [...new Set(clicks.map((c) => c.day))]
  const links = [
    ...branches.map((b) => ({ path: `/wa/${b.slug}`, slug: b.slug, label: branchLabel(b.name) })),
    { path: '/wa', slug: '', label: 'Umum (tanpa cabang)' },
  ].map((l) => ({ ...l, url: origin + l.path, total: clicks.filter((c) => c.branch === l.slug).reduce((a, c) => a + c.count, 0) }))
  const bagian = (b: string) => <input type="hidden" name="bagian" value={b} />
  return (
    <PageBody>
      <PageHeader title="Tautan WhatsApp" note="Tautan pendek, nomor, dan kalimat pembuka untuk tombol WhatsApp di situs." />
      <SettingsGrid>
        <Section id="tautan" wide title="Tautan pendek WhatsApp" description="Semua tombol WhatsApp di situs memakai tautan ini. Pasang juga di Google Maps, bio Instagram, dan QR di toko. Kalau nomor atau kalimat pembuka diubah, tautannya tetap sama.">
          <DataTable
            tanpaBingkai
            caption="Tautan pendek WhatsApp per cabang"
            rows={links}
            rowKey={(l) => l.path}
            columns={[
              { key: 'nama', header: 'Nama', cell: (l) => <span className="font-semibold text-ink">{l.label}</span> },
              { key: 'tautan', header: 'Tautan', cell: (l) => <code className="text-xs [overflow-wrap:anywhere]">{l.url}</code> },
              { key: 'klik', header: 'Klik 14 hari', align: 'right', className: 'whitespace-nowrap', cell: (l) => l.total.toLocaleString('id-ID') },
            ]}
            actions={(l) => <CopyButton text={l.url} label="Salin tautan" />}
          />
        </Section>

        {days.length > 0 && (
          <Section id="klik" wide title="Klik per hari" description="Jumlah klik tautan pendek, 14 hari terakhir.">
            <DataTable
              tanpaBingkai
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
          </Section>
        )}

        <Section id="nomor" title="Nomor WhatsApp utama" description="Nomor tujuan semua tombol WhatsApp di situs.">
          <FormPulih nama="nomor">
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
              <dl className="mt-4 grid gap-y-1 text-sm sm:grid-cols-[170px_1fr]">
                {branches.map((b) => (
                  <div key={b.id} className="contents">
                    <dt className="text-mute">Nomor {branchLabel(b.name)}</dt>
                    <dd className={s.mainWhatsapp ? 'text-mute line-through' : 'font-semibold text-ink'}>{b.whatsapp || '-'}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-xs text-mute">
                {s.mainWhatsapp ? 'Nomor tiap cabang sedang tidak dipakai karena nomor utama terisi. ' : ''}
                Nomor tiap cabang diubah di <Link href="/admin/cabang" className="font-semibold underline">Pengaturan, tab Cabang</Link>.
              </p>
              <FormActions><SubmitButton>Simpan nomor</SubmitButton></FormActions>
            </form>
          </FormPulih>
        </Section>

        <Section id="pembuka" title="Kalimat pembuka" description="Kalimat yang sudah terisi di WhatsApp pelanggan saat mereka menekan tombol.">
          <FormPulih nama="pembuka">
            <form action={saveSitus}>
              {bagian('pembuka')}
              <FormGrid cols={1}>
                <TextField label="Tombol umum (beranda, footer, tombol Chat)" name="opUmum" defaultValue={s.openers.umum} hint={<>Wajib memuat {'{cabang}'}, diganti nama cabang. Bot mengenali cabang pelanggan dari kata itu.</>} />
                <TextField
                  label="Halaman produk"
                  hint={<>Wajib memuat {'{cabang}'} dan {'{produk}'}. {'{produk}'} diganti nama produk.</>}
                  name="opProduk"
                  defaultValue={s.openers.produk}
                />
              </FormGrid>
              <div className="mt-4 text-xs text-mute">
                <p className="font-semibold text-ink">Hasil saat ini (tombol umum)</p>
                <ul className="mt-1 space-y-1">
                  {branches.map((b) => (
                    <li key={b.id}>
                      <b className="text-ink">{branchLabel(b.name)}</b>, ke nomor {waNumber(s, b) || '-'}:{' '}
                      <span className="[overflow-wrap:anywhere]">&ldquo;{renderTemplate(s.openers.umum, { cabang: branchLabel(b.name) })}&rdquo;</span>
                    </li>
                  ))}
                </ul>
              </div>
              <FormActions><SubmitButton>Simpan kalimat pembuka</SubmitButton></FormActions>
            </form>
          </FormPulih>
        </Section>
      </SettingsGrid>
    </PageBody>
  )
}
