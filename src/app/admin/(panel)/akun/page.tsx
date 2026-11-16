import { requireUser } from '@/lib/auth'
import { changePassword } from '../../actions'
import { inputCls } from '@/components/admin/section-editor'
import { Card, labelCls } from '@/components/admin/simple-list'

export default async function Akun() {
  const s = await requireUser()
  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-bold text-ink">Akun saya</h1>
      <Card title={`Ganti password (${s.name})`}>
        <form action={changePassword} className="space-y-3">
          <label className={labelCls}>Password lama<input name="old" type="password" autoComplete="current-password" required className={inputCls} /></label>
          <label className={labelCls}>Password baru (min. 8 karakter)<input name="new" type="password" autoComplete="new-password" required className={inputCls} /></label>
          <button className="adm-btn">Ganti password</button>
        </form>
      </Card>
    </div>
  )
}
