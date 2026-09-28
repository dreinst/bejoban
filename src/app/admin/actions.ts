'use server'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { createSession, destroySession, requireOwner, requireUser, canEditBranch, loginBlocked, loginFailed, loginOk } from '@/lib/auth'
import { sectionByKey, type Field } from '@/lib/content'
import { slugify } from '@/lib/format'

const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? '').trim().slice(0, max)
const int = (fd: FormData, k: string) => Math.max(0, Math.round(Number(String(fd.get(k) ?? '0').replace(/\D/g, '')) || 0))
const isMedia = (v: unknown): v is string => typeof v === 'string' && /^\/media\/[\w-]+\.(webp|png|jpg|svg)$/.test(v)
const safeLink = (v: string) => (/^(https?:\/\/|\/(?!\/)|#)/.test(v) ? v : '')
const done = (path: string, msg = 'Tersimpan') => {
  revalidatePath('/', 'layout')
  redirect(`${path}${path.includes('?') ? '&' : '?'}ok=${encodeURIComponent(msg)}`)
}

/* ---------- Login ---------- */

export async function login(_: unknown, fd: FormData) {
  const username = str(fd, 'username', 50).toLowerCase()
  const ip = (await headers()).get('x-forwarded-for') ?? 'local'
  const key = `${ip}:${username}`
  if (loginBlocked(key)) return { error: 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.' }
  const u = await db.user.findUnique({ where: { username } })
  if (!u || !(await bcrypt.compare(str(fd, 'password', 200), u.passwordHash))) {
    loginFailed(key)
    return { error: 'Username atau password salah.' }
  }
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
  const name = str(fd, 'name', 200)
  if (!name) redirect(`/admin/produk/${id || 'baru'}?err=Nama wajib diisi`)
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
  const product = id ? await db.product.update({ where: { id }, data: { ...data, slug } }) : await db.product.create({ data: { ...data, slug } })

  for (const b of await db.branch.findMany()) {
    if (!canEditBranch(s, b.id) || !fd.has(`b${b.id}_price`)) continue
    const listing = {
      price: int(fd, `b${b.id}_price`),
      comparePrice: int(fd, `b${b.id}_compare`),
      stock: int(fd, `b${b.id}_stock`),
      available: fd.get(`b${b.id}_sell`) === 'on',
      flashSale: fd.get(`b${b.id}_flash`) === 'on',
    }
    if (!listing.available && !listing.price) {
      await db.listing.deleteMany({ where: { productId: product.id, branchId: b.id } })
      continue
    }
    await db.listing.upsert({
      where: { productId_branchId: { productId: product.id, branchId: b.id } },
      create: { productId: product.id, branchId: b.id, ...listing },
      update: listing,
    })
  }
  done(`/admin/produk/${product.id}`)
}

export async function deleteProduct(fd: FormData) {
  await requireOwner()
  await db.product.delete({ where: { id: int(fd, 'id') } })
  done('/admin/produk', 'Produk dihapus')
}

/* ---------- Pricelist per cabang ---------- */

export async function savePrices(fd: FormData) {
  const s = await requireUser()
  const branchId = int(fd, 'branchId')
  if (!canEditBranch(s, branchId)) redirect('/admin?e=akses')
  const ids = String(fd.get('ids') ?? '').split(',').map(Number).filter(Boolean)
  for (const productId of ids) {
    const listing = {
      price: int(fd, `p${productId}_price`),
      comparePrice: int(fd, `p${productId}_compare`),
      stock: int(fd, `p${productId}_stock`),
      available: fd.get(`p${productId}_sell`) === 'on',
      flashSale: fd.get(`p${productId}_flash`) === 'on',
    }
    const exists = await db.listing.findUnique({ where: { productId_branchId: { productId, branchId } } })
    if (!exists && !listing.available && !listing.price) continue
    await db.listing.upsert({ where: { productId_branchId: { productId, branchId } }, create: { productId, branchId, ...listing }, update: listing })
  }
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
  await requireOwner()
  const section = sectionByKey(str(fd, 'key', 50))
  if (!section) redirect('/admin/konten')
  let raw: Record<string, unknown> = {}
  try {
    raw = JSON.parse(String(fd.get('value') ?? '{}'))
  } catch {}
  const value = JSON.stringify(clean(section.fields, raw))
  await db.setting.upsert({ where: { key: section.key }, create: { key: section.key, value }, update: { value } })
  done(`/admin/konten/${section.key}`)
}

/* ---------- Kategori & merek ---------- */

export async function saveCategory(fd: FormData) {
  await requireOwner()
  const id = int(fd, 'id')
  const name = str(fd, 'name', 60)
  if (!name) redirect('/admin/kategori?err=Nama wajib diisi')
  const image = String(fd.get('image') ?? '')
  const data = { name, slug: slugify(name), sort: int(fd, 'sort'), image: isMedia(image) ? image : '' }
  if (id) await db.category.update({ where: { id }, data })
  else await db.category.create({ data })
  done('/admin/kategori')
}

export async function deleteCategory(fd: FormData) {
  await requireOwner()
  const id = int(fd, 'id')
  await db.product.updateMany({ where: { categoryId: id }, data: { categoryId: null } })
  await db.category.delete({ where: { id } })
  done('/admin/kategori', 'Kategori dihapus')
}

export async function saveBrand(fd: FormData) {
  await requireOwner()
  const id = int(fd, 'id')
  const name = str(fd, 'name', 60)
  if (!name) redirect('/admin/merek?err=Nama wajib diisi')
  const logo = String(fd.get('logo') ?? '')
  const data = { name, sort: int(fd, 'sort'), logo: isMedia(logo) ? logo : '' }
  if (id) await db.brand.update({ where: { id }, data })
  else await db.brand.create({ data })
  done('/admin/merek')
}

export async function deleteBrand(fd: FormData) {
  await requireOwner()
  const id = int(fd, 'id')
  await db.product.updateMany({ where: { brandId: id }, data: { brandId: null } })
  await db.brand.delete({ where: { id } })
  done('/admin/merek', 'Merek dihapus')
}

/* ---------- Cabang ---------- */

export async function saveBranch(fd: FormData) {
  const s = await requireUser()
  const id = int(fd, 'id')
  if (id ? !canEditBranch(s, id) : s.role !== 'OWNER') redirect('/admin?e=akses')
  const name = str(fd, 'name', 100)
  if (!name) redirect('/admin/cabang?err=Nama wajib diisi')
  const photo = String(fd.get('photo') ?? '')
  const data = {
    name,
    instagram: str(fd, 'instagram', 60).replace(/^@/, ''),
    whatsapp: str(fd, 'whatsapp', 20).replace(/[^\d+]/g, ''),
    address: str(fd, 'address', 300),
    hours: str(fd, 'hours', 60),
    mapsUrl: safeLink(str(fd, 'mapsUrl', 500)),
    services: str(fd, 'services', 200),
    sort: int(fd, 'sort'),
    photo: isMedia(photo) ? photo : '',
  }
  if (id) await db.branch.update({ where: { id }, data })
  else await db.branch.create({ data: { ...data, slug: slugify(name) || `cabang-${Date.now()}` } })
  done('/admin/cabang')
}

/* ---------- Pengguna ---------- */

export async function saveUser(fd: FormData) {
  await requireOwner()
  const id = int(fd, 'id')
  const username = str(fd, 'username', 40).toLowerCase().replace(/[^a-z0-9._]/g, '')
  const password = str(fd, 'password', 200)
  const role = fd.get('role') === 'OWNER' ? 'OWNER' : 'BRANCH_ADMIN'
  const branchId = role === 'OWNER' ? null : int(fd, 'branchId') || null
  if (!username) redirect('/admin/pengguna?err=Username wajib diisi')
  if (role === 'BRANCH_ADMIN' && !branchId) redirect('/admin/pengguna?err=Admin cabang wajib punya cabang')
  if ((!id || password) && password.length < 8) redirect('/admin/pengguna?err=Password minimal 8 karakter')
  const data = { username, name: str(fd, 'name', 60), role, branchId, ...(password && { passwordHash: await bcrypt.hash(password, 10) }) }
  try {
    if (id) await db.user.update({ where: { id }, data })
    else await db.user.create({ data: { ...data, passwordHash: data.passwordHash! } })
  } catch {
    redirect('/admin/pengguna?err=Username sudah dipakai')
  }
  done('/admin/pengguna')
}

export async function deleteUser(fd: FormData) {
  const s = await requireOwner()
  const id = int(fd, 'id')
  if (id === s.uid) redirect('/admin/pengguna?err=Tidak bisa menghapus akun sendiri')
  await db.user.delete({ where: { id } })
  done('/admin/pengguna', 'Pengguna dihapus')
}

export async function changePassword(fd: FormData) {
  const s = await requireUser()
  const u = await db.user.findUniqueOrThrow({ where: { id: s.uid } })
  if (!(await bcrypt.compare(str(fd, 'old', 200), u.passwordHash))) redirect('/admin/akun?err=Password lama salah')
  const pw = str(fd, 'new', 200)
  if (pw.length < 8) redirect('/admin/akun?err=Password baru minimal 8 karakter')
  await db.user.update({ where: { id: s.uid }, data: { passwordHash: await bcrypt.hash(pw, 10) } })
  done('/admin/akun', 'Password diganti')
}
