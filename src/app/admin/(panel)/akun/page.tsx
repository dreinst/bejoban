import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { changePassword } from '../../actions'
import { PageBody, PageHeader, Section, SettingsGrid } from '@/components/admin/ui'
import { FormActions, FormGrid, TextField } from '@/components/admin/field'
import { SubmitButton } from '@/components/admin/overlay'

export default async function Akun() {
  const s = await requireUser()
  const cabang = s.branchId ? await db.branch.findUnique({ where: { id: s.branchId }, select: { name: true } }) : null
  return (
    <PageBody>
      <PageHeader title="Akun saya" />
      <SettingsGrid>
        <Section title="Ganti kata sandi">
          <form action={changePassword}>
            <FormGrid cols={1}>
              <TextField label="Kata sandi lama" name="old" type="password" autoComplete="current-password" required />
              <TextField label="Kata sandi baru" hint="Minimal 8 karakter." name="new" type="password" autoComplete="new-password" minLength={8} required />
            </FormGrid>
            <FormActions><SubmitButton>Ganti kata sandi</SubmitButton></FormActions>
          </form>
        </Section>
        <Section title="Info akun" description={s.role === 'OWNER' ? undefined : 'Data ini hanya bisa diubah owner lewat menu Pengguna.'}>
          <dl className="space-y-3 text-sm">
            {[
              ['Nama', <span key="n" className="font-semibold text-ink">{s.name}</span>],
              ['Peran', s.role === 'OWNER' ? 'Owner' : 'Admin cabang'],
              ['Cabang', s.role === 'OWNER' ? 'Semua cabang' : (cabang?.name.replace(/\s*\(.*\)/, '') ?? '-')],
            ].map(([k, v]) => (
              <div key={String(k)} className="grid gap-0.5 sm:grid-cols-[120px_1fr] sm:gap-3">
                <dt className="text-mute">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </SettingsGrid>
    </PageBody>
  )
}
