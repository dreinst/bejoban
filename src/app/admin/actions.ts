'use server'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { createSession, destroySession, requireOwner, requireUser, canEditBranch, loginBlocked, loginFailed, loginOk } from '@/lib/auth'
import { sectionByKey, type Field } from '@/lib/content'
import { slugify } from '@/lib/format'
import { namaPendek } from '@/lib/tire/cabang'
import { catatAktivitas, penggunaDari } from '@/lib/stok/aktivitas'
import { hapusListing, hapusProduk, simpanListing } from '@/lib/stok/ubah'
import { aksesSimpanProduk, dijualTanpaHarga } from '@/lib/admin/produk'
import { arahDari, aturanHapus, geserUrutan, urutanBerikut } from '@/lib/admin/urutan'
import type { HasilAksi } from '@/components/admin/row-controls'

const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? '').trim().slice(0, max)
const int = (fd: FormData, k: string) => Math.max(0, Math.round(Number(String(fd.get(k) ?? '0').replace(/\D/g, '')) || 0))
const isMedia = (v: unknown): v is string => typeof v === 'string' && /^\/media\/[\w-]+\.(webp|png|jpg|svg)$/.test(v)
const safeLink = (v: string) => (/^(https?:\/\/|\/(?!\/)|#)/.test(v) ? v : '')
// Satu baris log_aktivitas per aksi admin yang mengubah data.
const catat = (s: { uid: number }, aksi: string, entitas: string, data: Record<string, unknown> = {}) =>
  catatAktivitas({ pengguna: penggunaDari(s), aksi, entitas, data })
const done = (path: string, msg = 'Tersimpan') => {
  revalidatePath('/', 'layout')
  redirect(`${path}${path.includes('?') ? '&' : '?'}ok=${encodeURIComponent(msg)}`)
}
const gagal = (path: string, msg: string): never => redirect(`${path}${path.includes('?') ? '&' : '?'}err=${encodeURIComponent(msg)}`)

/* ---------- Login ---------- */

export async function login(_: unknown, fd: FormData) {
  const username = str(fd, 'username', 50).toLowerCase()
  const ip = (await headers()).get('x-forwarded-for') ?? 'local'
  const key = `${ip}:${username}`
  if (loginBlocked(key)) return { error: 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.' }
  const u = await db.user.findUnique({ where: { username } })
  if (!u || !(await bcrypt.compare(str(fd, 'password', 200), u.passwordHash))) {
    loginFailed(key)
    return { error: 'Nama pengguna atau kata sandi salah.' }
  }
  if (!u.aktif) return { error: 'Akun ini dinonaktifkan. Hubungi owner.' }
  loginOk(key)
  await createSession({ uid: u.id, role: u.role as 'OWNER' | 'BRANCH_ADMIN', branchId: u.branchId, name: u.name || u.username })
  redirect('/admin')
}

export async function logout() {
  await destroySession()
  redirect('/admin/login')
}

/* ---------- Produk ---------- */

export async function saveProduct(fd: FormData) {
  const s = await requireUser()
  const id = int(fd, 'id')
  const akses = aksesSimpanProduk(s.role, id)
  if (akses === 'tolak') redirect('/admin?e=akses')
  const balik = `/admin/produk/${id || 'baru'}`
  const name = str(fd, 'name', 200)
  if (akses === 'penuh' && !name) gagal(balik, 'Nama produk wajib diisi')

  // Periksa semua harga dulu supaya tidak ada yang tersimpan setengah.
  const branches = await db.branch.findMany()
  const lama = id ? await db.listing.findMany({ where: { productId: id } }) : []
  const rencana: { branchId: number; listing: { price: number; comparePrice: number; available: boolean; flashSale: boolean } }[] = []
  for (const b of branches) {
    if (!canEditBranch(s, b.id) || !fd.has(`b${b.id}_price`)) continue
    const listing = {
      price: int(fd, `b${b.id}_price`),
      comparePrice: int(fd, `b${b.id}_compare`),
      available: fd.get(`b${b.id}_sell`) === 'on',
      flashSale: fd.get(`b${b.id}_flash`) === 'on',
    }
    if (dijualTanpaHarga(listing, lama.find((l) => l.branchId === b.id))) gagal(balik, `Isi harga jual cabang ${namaPendek(b.name)}, atau hilangkan centang Dijual`)
    rencana.push({ branchId: b.id, listing })
  }

  let product: { id: number; name: string }
  if (akses === 'penuh') {
    let images: string[] = []
    try {
      images = (JSON.parse(str(fd, 'images', 5000) || '[]') as unknown[]).filter(isMedia).slice(0, 10)
    } catch {}
    const data = {
      name,
      spec: str(fd, 'spec', 100),
      fitment: str(fd, 'fitment', 300),
      description: str(fd, 'description', 5000),
      images: JSON.stringify(images),
      active: fd.get('active') === 'on',
      isSample: fd.get('isSample') === 'on',
      categoryId: int(fd, 'categoryId') || null,
      brandId: int(fd, 'brandId') || null,
    }
    let slug = slugify(name) || 'produk'
    const clash = await db.product.findFirst({ where: { slug, NOT: { id } } })
    if (clash) slug = `${slug}-${Date.now().toString(36)}`
    product = id ? await db.product.update({ where: { id }, data: { ...data, slug } }) : await db.product.create({ data: { ...data, slug } })
  } else {
    // Admin cabang: data produk dipakai semua cabang dan tidak disentuh, hanya harga dan stok cabangnya.
    const ada = await db.product.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!ada) redirect('/admin/harga')
    product = ada
  }

  for (const { branchId, listing } of rencana) {
    const ref = { productId: product.id, branchId, pengguna: penggunaDari(s), refId: `produk:${product.id}` }
    if (!listing.available && !listing.price) {
      await hapusListing(ref)
      continue
    }
    // Stok diubah lewat buku stok (src/lib/stok), satu transaksi dengan harga listing.
    await simpanListing({ ...ref, data: listing, stok: int(fd, `b${branchId}_stock`) })
  }
  await catat(s, id ? 'ubah' : 'tambah', 'produk', { id: product.id })
  done(`/admin/produk/${product.id}`, `${product.name} tersimpan`)
}

export async function deleteProduct(fd: FormData) {
  const s = await requireOwner()
  const id = int(fd, 'id')
  const p = await db.product.findUnique({ where: { id }, select: { name: true } })
  if (!p) return gagal('/admin/harga', 'Produk tidak ditemukan')
  await hapusProduk({ productId: id, pengguna: penggunaDari(s) })
  await catat(s, 'hapus', 'produk', { id, nama: p.name })
  done('/admin/harga', `${p.name} dihapus`)
}

/* ---------- Pricelist per cabang ---------- */

export async function savePrices(fd: FormData) {
  const s = await requireUser()
  const branchId = int(fd, 'branchId')
  if (!canEditBranch(s, branchId)) redirect('/admin?e=akses')
  const ids = String(fd.get('ids') ?? '').split(',').map(Number).filter(Boolean)
  const rencana: { productId: number; listing: { price: number; comparePrice: number; available: boolean; flashSale: boolean } }[] = []
  const tanpaHarga: number[] = []
  for (const productId of ids) {
    const listing = {
      price: int(fd, `p${productId}_price`),
      comparePrice: int(fd, `p${productId}_compare`),
      available: fd.get(`p${productId}_sell`) === 'on',
      flashSale: fd.get(`p${productId}_flash`) === 'on',
    }
    const exists = await db.listing.findUnique({ where: { productId_branchId: { productId, branchId } } })
    if (dijualTanpaHarga(listing, exists)) tanpaHarga.push(productId)
    if (!exists && !listing.available && !listing.price) continue
    rencana.push({ productId, listing })
  }
  // Tolak semuanya kalau ada yang dijual tanpa harga, supaya tidak tersimpan separuh.
  if (tanpaHarga.length) {
    const nama = await db.product.findMany({ where: { id: { in: tanpaHarga } }, select: { name: true }, take: 3 })
    gagal(`/admin/harga?cabang=${branchId}`, `Isi harga jual dulu atau hilangkan centang Dijual: ${nama.map((n) => n.name).join(', ')}${tanpaHarga.length > 3 ? `, dan ${tanpaHarga.length - 3} lainnya` : ''}`)
  }
  for (const { productId, listing } of rencana) {
    await simpanListing({ productId, branchId, data: listing, stok: int(fd, `p${productId}_stock`), pengguna: penggunaDari(s), refId: `harga:${branchId}` })
  }
  await catat(s, 'simpan', 'harga_cabang', { cabang: branchId, produk: ids.length })
  done(`/admin/harga?cabang=${branchId}`, 'Harga tersimpan')
}

/* ---------- Konten situs ---------- */

// Hanya simpan kunci yang dikenal skema, dengan tipe yang benar.
function clean(fields: Field[], input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    const v = input?.[f.key]
    if (f.type === 'image') out[f.key] = isMedia(v) ? v : ''
    else if (f.type === 'images') out[f.key] = Array.isArray(v) ? v.filter(isMedia).slice(0, f.max) : []
    else if (f.type === 'products') out[f.key] = Array.isArray(v) ? v.map(Number).filter(Number.isInteger).slice(0, f.max) : []
    else if (f.type === 'list')
      out[f.key] = Array.isArray(v) ? v.slice(0, f.max).map((item) => clean(f.fields, item as Record<string, unknown>)) : []
    else {
      const t = typeof v === 'string' ? v.slice(0, 2000) : ''
      out[f.key] = /link|href/i.test(f.key) ? safeLink(t) : t
    }
  }
  return out
}

export async function saveSection(fd: FormData) {
  const s = await requireOwner()
  const section = sectionByKey(str(fd, 'key', 50))
  if (!section) redirect('/admin/konten')
  let raw: Record<string, unknown> = {}
  try {
    raw = JSON.parse(String(fd.get('value') ?? '{}'))
  } catch {}
  const value = JSON.stringify(clean(section.fields, raw))
  await db.setting.upsert({ where: { key: section.key }, create: { key: section.key, value }, update: { value } })
  await catat(s, 'simpan', 'konten', { kunci: section.key })
  done(`/admin/konten/${section.key}`)
}

/* ---------- Kategori & merek ---------- */

export async function saveCategory(fd: FormData) {
  const s = await requireOwner()
  const id = int(fd, 'id')
  const name = str(fd, 'name', 60)
  if (!name) gagal('/admin/kategori', 'Nama kategori wajib diisi')
  const image = String(fd.get('image') ?? '')
  const data = { name, slug: slugify(name) || 'kategori', image: isMedia(image) ? image : '' }
  try {
    if (id) await db.category.update({ where: { id }, data })
    else await db.category.create({ data: { ...data, sort: urutanBerikut(await db.category.findMany({ select: { sort: true } })) } })
  } catch {
    gagal('/admin/kategori', `Nama kategori "${name}" sudah dipakai atau menghasilkan alamat yang sama dengan kategori lain`)
  }
  await catat(s, id ? 'ubah' : 'tambah', 'kategori', { id: id || null, nama: name })
  done('/admin/kategori', id ? `${name} tersimpan` : `${name} ditambahkan`)
}

// Hapus hanya untuk kategori yang tidak dipakai produk. Yang masih dipakai ditolak di sini juga, tidak hanya di dialog.
export async function deleteCategory(fd: FormData) {
  const s = await requireOwner()
  const id = int(fd, 'id')
  const c = await db.category.findUnique({ where: { id }, include: { _count: { select: { products: true } } } })
  if (!c) return gagal('/admin/kategori', 'Kategori tidak ditemukan')
  const aturan = aturanHapus(c.name, [{ jumlah: c._count.products, satuan: 'produk' }])
  if (!aturan.boleh) gagal('/admin/kategori', `${aturan.dipakai} Nonaktifkan saja supaya tidak tampil lagi.`)
  await db.category.delete({ where: { id } })
  await catat(s, 'hapus', 'kategori', { id, nama: c.name })
  done('/admin/kategori', `${c.name} dihapus`)
}

// Aktifkan atau nonaktifkan kategori. Nonaktif: hilang dari saringan situs dan pilihan form produk, produknya tidak diubah.
export async function setCategoryActive(fd: FormData) {
  const s = await requireOwner()
  const id = int(fd, 'id')
  const aktif = str(fd, 'aktif', 1) === '1'
  const c = await db.category.findUnique({ where: { id }, select: { name: true } })
  if (!c) return gagal('/admin/kategori', 'Kategori tidak ditemukan')
  await db.category.update({ where: { id }, data: { aktif } })
  await catat(s, aktif ? 'aktifkan' : 'nonaktifkan', 'kategori', { id, nama: c.name })
  done('/admin/kategori', aktif ? `${c.name} diaktifkan` : `${c.name} dinonaktifkan`)
}

// Urutan kategori: tukar dengan tetangga. Urutan sama dengan saringan di situs (sort, lalu nama).
export async function moveCategory(fd: FormData): Promise<HasilAksi> {
  const s = await requireOwner()
  const id = int(fd, 'id')
  const arah = arahDari(fd.get('arah'))
  if (!arah) return { err: 'Arah urutan tidak dikenal' }
  const list = await db.category.findMany({ orderBy: [{ sort: 'asc' }, { name: 'asc' }], select: { id: true, sort: true } })
  const ubah = geserUrutan(list, id, arah)
  if (!ubah.length) return
  await db.$transaction(ubah.map((u) => db.category.update({ where: { id: u.id }, data: { sort: u.sort } })))
  await catat(s, 'urutkan', 'kategori', { id, arah })
  revalidatePath('/', 'layout')
}

// Merek: tambah dan ubah dari satu form di panel samping. Urutan tidak diketik; merek baru masuk di akhir.
export async function saveBrand(fd: FormData) {
  const s = await requireOwner()
  const id = int(fd, 'id')
  const name = str(fd, 'name', 60)
  if (!name) gagal('/admin/merek', 'Nama merek wajib diisi')
  const logo = String(fd.get('logo') ?? '')
  const data = { name, logo: isMedia(logo) ? logo : '', byOrder: fd.get('byOrder') === 'on' }
  try {
    if (id) await db.brand.update({ where: { id }, data })
    else await db.brand.create({ data: { ...data, sort: urutanBerikut(await db.brand.findMany({ select: { sort: true } })) } })
  } catch {
    gagal('/admin/merek', `Nama merek "${name}" sudah dipakai`)
  }
  await catat(s, id ? 'ubah' : 'tambah', 'merek', { id: id || null, nama: name, byOrder: data.byOrder })
  done('/admin/merek', id ? `${name} tersimpan` : `${name} ditambahkan`)
}

// Hapus hanya untuk merek yang tidak dipakai produk. Yang masih dipakai ditolak di sini juga, tidak hanya di dialog.
export async function deleteBrand(fd: FormData) {
  const s = await requireOwner()
  const id = int(fd, 'id')
  const b = await db.brand.findUnique({ where: { id }, include: { _count: { select: { products: true } } } })
  if (!b) return gagal('/admin/merek', 'Merek tidak ditemukan')
  const aturan = aturanHapus(b.name, [{ jumlah: b._count.products, satuan: 'produk' }])
  if (!aturan.boleh) gagal('/admin/merek', `${aturan.dipakai} Nonaktifkan saja supaya tidak tampil lagi.`)
  await db.brand.delete({ where: { id } })
  await catat(s, 'hapus', 'merek', { id, nama: b.name })
  done('/admin/merek', `${b.name} dihapus`)
}

// Aktifkan atau nonaktifkan merek. Nonaktif: hilang dari situs dan pilihan merek, produknya tidak diubah.
export async function setBrandActive(fd: FormData) {
  const s = await requireOwner()
  const id = int(fd, 'id')
  const aktif = str(fd, 'aktif', 1) === '1'
  const b = await db.brand.findUnique({ where: { id }, select: { name: true } })
  if (!b) return gagal('/admin/merek', 'Merek tidak ditemukan')
  await db.brand.update({ where: { id }, data: { aktif } })
  await catat(s, aktif ? 'aktifkan' : 'nonaktifkan', 'merek', { id, nama: b.name })
  done('/admin/merek', aktif ? `${b.name} diaktifkan` : `${b.name} dinonaktifkan`)
}

// Sakelar by order langsung di baris tabel.
export async function setBrandByOrder(fd: FormData): Promise<HasilAksi> {
  const s = await requireOwner()
  const id = int(fd, 'id')
  const byOrder = str(fd, 'value', 1) === '1'
  const b = await db.brand.findUnique({ where: { id }, select: { name: true } })
  if (!b) return { err: 'Merek tidak ditemukan' }
  await db.brand.update({ where: { id }, data: { byOrder } })
  await catat(s, 'ubah', 'merek', { id, nama: b.name, byOrder })
  revalidatePath('/', 'layout')
  return { ok: byOrder ? `${b.name} ditandai by order` : `${b.name} tidak lagi by order` }
}

// Urutan merek: tukar dengan tetangga. Urutan sama dengan beranda (sort, lalu nama).
export async function moveBrand(fd: FormData): Promise<HasilAksi> {
  const s = await requireOwner()
  const id = int(fd, 'id')
  const arah = arahDari(fd.get('arah'))
  if (!arah) return { err: 'Arah urutan tidak dikenal' }
  const list = await db.brand.findMany({ orderBy: [{ sort: 'asc' }, { name: 'asc' }], select: { id: true, sort: true } })
  const ubah = geserUrutan(list, id, arah)
  if (!ubah.length) return
  await db.$transaction(ubah.map((u) => db.brand.update({ where: { id: u.id }, data: { sort: u.sort } })))
  await catat(s, 'urutkan', 'merek', { id, arah })
  revalidatePath('/', 'layout')
}

/* ---------- Cabang ---------- */

export async function saveBranch(fd: FormData) {
  const s = await requireUser()
  const id = int(fd, 'id')
  if (id ? !canEditBranch(s, id) : s.role !== 'OWNER') redirect('/admin?e=akses')
  const name = str(fd, 'name', 100)
  if (!name) gagal('/admin/cabang', 'Nama cabang wajib diisi')
  const photo = String(fd.get('photo') ?? '')
  const data = {
    name,
    instagram: str(fd, 'instagram', 60).replace(/^@/, ''),
    whatsapp: str(fd, 'whatsapp', 20).replace(/[^\d+]/g, ''),
    address: str(fd, 'address', 300),
    hours: str(fd, 'hours', 60),
    mapsUrl: safeLink(str(fd, 'mapsUrl', 500)),
    services: str(fd, 'services', 200),
    photo: isMedia(photo) ? photo : '',
  }
  try {
    if (id) await db.branch.update({ where: { id }, data })
    else {
      const sort = urutanBerikut(await db.branch.findMany({ select: { sort: true } }))
      await db.branch.create({ data: { ...data, sort, slug: slugify(name) || `cabang-${Date.now()}` } })
    }
  } catch {
    gagal('/admin/cabang', `Nama cabang "${name}" menghasilkan alamat yang sama dengan cabang lain`)
  }
  await catat(s, id ? 'ubah' : 'tambah', 'cabang', { id: id || null, nama: name })
  done('/admin/cabang', id ? `${name} tersimpan` : `${name} ditambahkan`)
}

// Urutan cabang (owner saja): tukar dengan tetangga.
export async function moveBranch(fd: FormData): Promise<HasilAksi> {
  const s = await requireOwner()
  const id = int(fd, 'id')
  const arah = arahDari(fd.get('arah'))
  if (!arah) return { err: 'Arah urutan tidak dikenal' }
  const list = await db.branch.findMany({ orderBy: [{ sort: 'asc' }, { name: 'asc' }], select: { id: true, sort: true } })
  const ubah = geserUrutan(list, id, arah)
  if (!ubah.length) return
  await db.$transaction(ubah.map((u) => db.branch.update({ where: { id: u.id }, data: { sort: u.sort } })))
  await catat(s, 'urutkan', 'cabang', { id, arah })
  revalidatePath('/', 'layout')
}

/* ---------- Pengguna ---------- */

export async function saveUser(fd: FormData) {
  const s = await requireOwner()
  const id = int(fd, 'id')
  const username = str(fd, 'username', 40).toLowerCase().replace(/[^a-z0-9._]/g, '')
  const password = str(fd, 'password', 200)
  const role = fd.get('role') === 'OWNER' ? 'OWNER' : 'BRANCH_ADMIN'
  const branchId = role === 'OWNER' ? null : int(fd, 'branchId') || null
  const P = '/admin/pengguna'
  if (!username) gagal(P, 'Username wajib diisi')
  if (role === 'BRANCH_ADMIN' && !branchId) gagal(P, 'Admin cabang wajib punya cabang')
  if (branchId && !(await db.branch.findUnique({ where: { id: branchId }, select: { id: true } }))) gagal(P, 'Cabang tidak ditemukan')
  if (!id && password.length < 8) gagal(P, 'Password minimal 8 karakter')
  // Status aktif hanya diubah kalau form mengirim penandanya.
  const aktif = fd.has('aktif_form') ? fd.get('aktif') === 'on' : undefined
  if (id && id === s.uid && aktif === false) gagal(P, 'Tidak bisa menonaktifkan akun sendiri')
  if (id && id === s.uid && role !== 'OWNER') gagal(P, 'Tidak bisa menurunkan peran akun sendiri')
  const data = { username, name: str(fd, 'name', 60), role, branchId, ...(aktif !== undefined && { aktif }) }
  try {
    if (id) await db.user.update({ where: { id }, data })
    else await db.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password, 10) } })
  } catch {
    gagal(P, `Username "${username}" sudah dipakai`)
  }
  await catat(s, id ? 'ubah' : 'tambah', 'pengguna', { id: id || null, username, peran: role, ...(aktif !== undefined && { aktif }) })
  done(P, id ? `${username} tersimpan` : `${username} ditambahkan`)
}

// Reset password oleh owner. Password baru tidak disimpan di log aktivitas.
export async function resetUserPassword(fd: FormData) {
  const s = await requireOwner()
  const id = int(fd, 'id')
  const password = str(fd, 'password', 200)
  const u = await db.user.findUnique({ where: { id }, select: { username: true } })
  if (!u) return gagal('/admin/pengguna', 'Pengguna tidak ditemukan')
  if (password.length < 8) gagal('/admin/pengguna', 'Password baru minimal 8 karakter')
  await db.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } })
  await catat(s, 'reset_password', 'pengguna', { id, username: u.username })
  done('/admin/pengguna', `Password ${u.username} diganti`)
}

export async function deleteUser(fd: FormData) {
  const s = await requireOwner()
  const id = int(fd, 'id')
  if (id === s.uid) gagal('/admin/pengguna', 'Tidak bisa menghapus akun sendiri')
  const u = await db.user.findUnique({ where: { id }, select: { username: true } })
  if (!u) return gagal('/admin/pengguna', 'Pengguna tidak ditemukan')
  await db.user.delete({ where: { id } })
  await catat(s, 'hapus', 'pengguna', { id, username: u.username })
  done('/admin/pengguna', `${u.username} dihapus`)
}

export async function changePassword(fd: FormData) {
  const s = await requireUser()
  const u = await db.user.findUniqueOrThrow({ where: { id: s.uid } })
  if (!(await bcrypt.compare(str(fd, 'old', 200), u.passwordHash))) redirect('/admin/akun?err=Kata sandi lama salah')
  const pw = str(fd, 'new', 200)
  if (pw.length < 8) redirect('/admin/akun?err=Kata sandi baru minimal 8 karakter')
  await db.user.update({ where: { id: s.uid }, data: { passwordHash: await bcrypt.hash(pw, 10) } })
  await catat(s, 'ganti_password', 'pengguna', { id: s.uid })
  done('/admin/akun', 'Kata sandi diganti')
}
