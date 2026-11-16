import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { deleteUser, resetUserPassword, saveUser } from '../../actions'
import { Badge, Empty, PageBody, PageHeader } from '@/components/admin/ui'
import { DataTable, ListToolbar } from '@/components/admin/data-table'
import { CheckField, FormActions, FormGrid, SelectField, TextField } from '@/components/admin/field'
import { CloseButton, ConfirmDialog, Drawer, SubmitButton } from '@/components/admin/overlay'

type Pengguna = { id: number; username: string; name: string; role: string; branchId: number | null; aktif: boolean }
type Cabang = { id: number; name: string }

// Satu form untuk tambah dan ubah. Password hanya diisi saat tambah; mengganti password lewat "Reset password".
function FormPengguna({ u, cabang, sendiri }: { u?: Pengguna; cabang: Cabang[]; sendiri?: boolean }) {
  return (
    <form action={saveUser}>
      <input type="hidden" name="id" value={u?.id ?? 0} />
      <input type="hidden" name="aktif_form" value="1" />
      <FormGrid cols={1}>
        <TextField label="Username" name="username" defaultValue={u?.username} required maxLength={40} autoComplete="off" hint="Huruf kecil, angka, titik, dan garis bawah." />
        <TextField label="Nama tampilan" name="name" defaultValue={u?.name} maxLength={60} autoComplete="off" />
        <SelectField label="Peran" name="role" defaultValue={u?.role ?? 'BRANCH_ADMIN'}>
          <option value="OWNER">Owner (semua akses)</option>
          <option value="BRANCH_ADMIN">Admin cabang (cabangnya sendiri)</option>
        </SelectField>
        <SelectField label="Cabang" name="branchId" defaultValue={u?.branchId ?? ''} hint="Wajib untuk admin cabang. Owner tidak perlu.">
          <option value="">(tidak ada)</option>
          {cabang.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </SelectField>
        {!u && <TextField label="Password" name="password" type="password" required minLength={8} maxLength={200} autoComplete="new-password" hint="Minimal 8 karakter." />}
        <CheckField label="Akun aktif" name="aktif" defaultChecked={u?.aktif ?? true} disabled={sendiri} hint={sendiri ? 'Akun sendiri tidak bisa dinonaktifkan.' : 'Kalau dimatikan, pengguna tidak bisa masuk.'} />
        {sendiri && <input type="hidden" name="aktif" value="on" />}
      </FormGrid>
      <FormActions>
        <CloseButton />
        <SubmitButton>{u ? 'Simpan perubahan' : 'Tambah pengguna'}</SubmitButton>
      </FormActions>
    </form>
  )
}

function FormReset({ u }: { u: Pengguna }) {
  return (
    <form action={resetUserPassword}>
      <input type="hidden" name="id" value={u.id} />
      <FormGrid cols={1}>
        <TextField label="Password baru" name="password" type="password" required minLength={8} maxLength={200} autoComplete="new-password" hint={`Minimal 8 karakter. ${u.username} memakai password ini untuk masuk berikutnya.`} />
      </FormGrid>
      <FormActions>
        <CloseButton />
        <SubmitButton>Ganti password</SubmitButton>
      </FormActions>
    </form>
  )
}

export default async function Pengguna({ searchParams }: PageProps<'/admin/pengguna'>) {
  const s = await requireOwner()
  const q = String((await searchParams).q ?? '').trim().slice(0, 60)
  const [semua, cabang] = await Promise.all([
    db.user.findMany({ include: { branch: true }, orderBy: { id: 'asc' } }),
    db.branch.findMany({ orderBy: [{ sort: 'asc' }, { name: 'asc' }], select: { id: true, name: true } }),
  ])
  const ql = q.toLowerCase()
  const list = q ? semua.filter((u) => u.username.toLowerCase().includes(ql) || u.name.toLowerCase().includes(ql)) : semua
  const tambah = (
    <Drawer trigger="+ Tambah pengguna" triggerClassName="adm-btn" title="Tambah pengguna" description="Owner bisa mengatur semuanya. Admin cabang hanya melihat data cabangnya.">
      <FormPengguna cabang={cabang} />
    </Drawer>
  )

  return (
    <PageBody>
      <PageHeader
        title="Pengguna"
        note="Owner mengatur semuanya. Admin cabang melihat Ringkasan, Produk situs, Perlu dicek, Percakapan chatbot, dan Hitung ongkir untuk cabangnya, serta bisa mengubah data cabangnya sendiri."
        actions={tambah}
      />
      <ListToolbar
        count={list.length}
        total={q ? semua.length : undefined}
        noun="pengguna"
        search={semua.length > 10 || q ? { placeholder: 'Cari username atau nama', value: q } : undefined}
      />
      <DataTable
        caption="Daftar pengguna"
        rows={list}
        rowKey={(u) => u.id}
        muted={(u) => !u.aktif}
        columns={[
          { key: 'username', header: 'Username', cell: (u) => <span className="font-semibold text-ink">{u.username}{u.id === s.uid && <span className="ml-1.5 text-xs font-normal text-mute">(kamu)</span>}</span> },
          { key: 'nama', header: 'Nama', cell: (u) => u.name || '-' },
          { key: 'peran', header: 'Peran', cell: (u) => (u.role === 'OWNER' ? 'Owner' : 'Admin cabang') },
          { key: 'cabang', header: 'Cabang', cell: (u) => u.branch?.name ?? '-' },
          { key: 'status', header: 'Status', cell: (u) => <Badge tone={u.aktif ? 'dark' : 'outline'}>{u.aktif ? 'Aktif' : 'Nonaktif'}</Badge> },
        ]}
        actions={(u) => (
          <>
            <Drawer trigger="Ubah" triggerLabel={`Ubah ${u.username}`} title={`Ubah pengguna ${u.username}`}>
              <FormPengguna u={u} cabang={cabang} sendiri={u.id === s.uid} />
            </Drawer>
            <Drawer trigger="Reset password" triggerLabel={`Reset password ${u.username}`} title={`Reset password ${u.username}`}>
              <FormReset u={u} />
            </Drawer>
            {u.id !== s.uid && (
              <ConfirmDialog
                triggerLabel={`Hapus ${u.username}`}
                title={`Hapus pengguna ${u.username}?`}
                message={
                  <>
                    <p>{u.username} tidak bisa masuk lagi setelah dihapus, dan akunnya tidak bisa dikembalikan.</p>
                    {u.aktif && <p className="text-mute">Kalau hanya ingin menutup aksesnya sementara, buka Ubah lalu matikan Akun aktif.</p>}
                  </>
                }
                confirm={{ action: deleteUser, fields: { id: u.id }, label: 'Hapus pengguna' }}
              />
            )}
          </>
        )}
        empty={
          q ? (
            <Empty title="Pengguna tidak ditemukan">Tidak ada pengguna dengan kata &quot;{q}&quot;. Periksa ejaannya atau hapus pencarian.</Empty>
          ) : (
            <Empty title="Belum ada pengguna" action={tambah}>Tambah pengguna pertama.</Empty>
          )
        }
      />
    </PageBody>
  )
}
