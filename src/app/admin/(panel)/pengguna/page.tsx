import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { saveUser, deleteUser } from '../../actions'
import { inputCls } from '@/components/admin/section-editor'
import { Card, labelCls } from '@/components/admin/simple-list'
import { PageHeader } from '@/components/admin/ui'

export default async function Pengguna() {
  const s = await requireOwner()
  const [users, branches] = await Promise.all([db.user.findMany({ include: { branch: true }, orderBy: { id: 'asc' } }), db.branch.findMany({ orderBy: { sort: 'asc' } })])
  const form = (u?: (typeof users)[number]) => (
    <form action={saveUser} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="id" value={u?.id ?? 0} />
      <label className={labelCls}>Username<input name="username" defaultValue={u?.username} required className={inputCls} /></label>
      <label className={labelCls}>Nama tampilan<input name="name" defaultValue={u?.name} className={inputCls} /></label>
      <label className={labelCls}>Peran
        <select name="role" defaultValue={u?.role ?? 'BRANCH_ADMIN'} className={inputCls}>
          <option value="OWNER">Owner (semua akses)</option>
          <option value="BRANCH_ADMIN">Admin cabang (cabangnya sendiri)</option>
        </select>
      </label>
      <label className={labelCls}>Cabang (untuk admin cabang)
        <select name="branchId" defaultValue={u?.branchId ?? ''} className={inputCls}>
          <option value="">(tidak ada)</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
      <label className={labelCls}>{u ? 'Password baru (kosongkan kalau tidak diganti)' : 'Password (min. 8 karakter)'}<input name="password" type="password" autoComplete="new-password" className={inputCls} /></label>
      <input type="hidden" name="aktif_form" value="1" />
      <label className={`${labelCls} flex items-center gap-2`}><input type="checkbox" name="aktif" defaultChecked={u?.aktif ?? true} disabled={u?.id === s.uid} />Akun aktif (kalau mati, tidak bisa masuk)</label>
      {u?.id === s.uid && <input type="hidden" name="aktif" value="on" />}
      <div className="flex items-end"><button className="adm-btn">Simpan</button></div>
    </form>
  )
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Pengguna" note="Owner mengatur semuanya. Admin cabang melihat Ringkasan, Produk situs, Perlu dicek, Percakapan chatbot, dan Hitung ongkir untuk cabangnya, serta bisa mengubah data cabangnya sendiri." />
      {users.map((u) => (
        <Card key={u.id} title={`${u.username} · ${u.role === 'OWNER' ? 'Owner' : `Admin ${u.branch?.name ?? ''}`}`}>
          {form(u)}
          {u.id !== s.uid && (
            <form action={deleteUser} className="mt-3 text-right">
              <input type="hidden" name="id" value={u.id} />
              <label className="mr-3 text-xs"><input type="checkbox" required className="mr-1" />Yakin</label>
              <button className="text-xs font-semibold text-red-600">Hapus pengguna</button>
            </form>
          )}
        </Card>
      ))}
      <Card title="+ Pengguna baru">{form()}</Card>
    </div>
  )
}
