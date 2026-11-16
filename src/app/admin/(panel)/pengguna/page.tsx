import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { saveUser, deleteUser } from '../../actions'
import { inputCls } from '@/components/admin/section-editor'
import { Card, labelCls } from '@/components/admin/simple-list'

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
          <option value="BRANCH_ADMIN">Admin cabang (produk & harga cabangnya)</option>
        </select>
      </label>
      <label className={labelCls}>Cabang (untuk admin cabang)
        <select name="branchId" defaultValue={u?.branchId ?? ''} className={inputCls}>
          <option value="">(tidak ada)</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
      <label className={labelCls}>{u ? 'Password baru (kosongkan kalau tidak diganti)' : 'Password (min. 8 karakter)'}<input name="password" type="password" autoComplete="new-password" className={inputCls} /></label>
      <div className="flex items-end"><button className="adm-btn">Simpan</button></div>
    </form>
  )
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold text-ink">Pengguna</h1>
      <p className="text-sm text-neutral-500">Owner bisa mengatur semuanya. Admin cabang hanya bisa mengubah produk, harga dan stok, serta data cabangnya sendiri.</p>
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
