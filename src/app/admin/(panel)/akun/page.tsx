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
        <Section title="Ganti password" description="Password baru minimal 8 karakter.">
          <form action={changePassword}>
            <FormGrid cols={1}>
              <TextField label="Password lama" name="old" type="password" autoComplete="current-password" required />
              <TextField label="Password baru" hint="Minimal 8 karakter." name="new" type="password" autoComplete="new-password" minLength={8} required />
            </FormGrid>
            <FormActions><SubmitButton>Ganti password</SubmitButton></FormActions>
          </form>
        </Section>
        <Section title="Info akun" description="Data ini hanya bisa diubah owner lewat menu Pengguna.">
          <dl className="grid gap-y-3 text-sm sm:grid-cols-[120px_1fr]">
            <dt className="text-mute">Nama</dt>
            <dd className="font-semibold text-ink">{s.name}</dd>
            <dt className="text-mute">Peran</dt>
            <dd>{s.role === 'OWNER' ? 'Owner' : 'Admin cabang'}</dd>
            <dt className="text-mute">Cabang</dt>
            <dd>{s.role === 'OWNER' ? 'Semua cabang' : (cabang?.name.replace(/\s*\(.*\)/, '') ?? '-')}</dd>
          </dl>
        </Section>
      </SettingsGrid>
    </PageBody>
  )
}
