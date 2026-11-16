// Isi data nyata client dan konten beranda dari folder lokal data/seed-lokal/ (diabaikan git) ke database.
// Folder itu berisi satu berkas seed.json dan gambar yang dirujuk. Jangan menaruh foto pabrikan atau angka asli di git.
//   npm run seed:lokal
// Aman dijalankan berulang: gambar yang sama tidak diunggah ulang, produk memakai upsert berdasarkan slug,
// dan harga serta stok yang sudah diisi admin tidak ditimpa.
//
// Format seed.json (semua bagian opsional):
//   branches: [{ slug, address?, photo? }]               photo = nama berkas gambar di folder ini
//   services: [{ groupName, name, variant?, ringMin?, ringMax?, minDiameter?, price, unit?, altLabel?, altPrice?, note?, keywords? }]
//   content:  { <kunci bagian Tampilan Web>: { ...isi yang ditimpa } }   nama berkas gambar diganti URL otomatis
//   products: [{ name, spec, brand, category, image, fitment? }]          enam produk beranda, sisa produk CONTOH disembunyikan
import 'dotenv/config'
import { createHash } from 'crypto'
import { access, readFile } from 'fs/promises'
import path from 'path'
import { db } from '../src/lib/db'
import { saveImage, uploadDir, type PresetKey } from '../src/lib/images'
import { slugify } from '../src/lib/format'

type Svc = { groupName: string; name: string; variant?: string; ringMin?: number | null; ringMax?: number | null; minDiameter?: number | null; price: number | null; unit?: string; altLabel?: string; altPrice?: number | null; note?: string; keywords?: string }
type Prod = { name: string; spec: string; brand: string; category: string; image: string; fitment?: string }
type Seed = {
  branches?: { slug: string; address?: string; photo?: string }[]
  services?: Svc[]
  content?: Record<string, Record<string, unknown>>
  products?: Prod[]
}

const DIR = path.join(process.cwd(), 'data', 'seed-lokal')
const exists = (p: string) => access(p).then(() => true, () => false)

// Gambar yang isinya sama dan presetnya sama dipakai ulang, supaya menjalankan seed berkali-kali tidak menumpuk berkas.
async function imageUrl(file: string, preset: PresetKey): Promise<string> {
  const buf = await readFile(path.join(DIR, file))
  const key = `${preset}:${createHash('sha1').update(buf).digest('hex')}`
  const row = await db.setting.findUnique({ where: { key: 'seed.images' } })
  const map: Record<string, string> = row ? JSON.parse(row.value) : {}
  if (map[key] && (await exists(path.join(uploadDir(), path.basename(map[key]))))) return map[key]
  const url = await saveImage(buf, preset)
  map[key] = url
  await db.setting.upsert({ where: { key: 'seed.images' }, create: { key: 'seed.images', value: JSON.stringify(map) }, update: { value: JSON.stringify(map) } })
  return url
}

// Bagian konten dan jenis presetnya untuk kolom yang berisi nama berkas gambar.
async function resolveContent(key: string, v: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...v }
  if (key === 'hero' && typeof v.image === 'string' && v.image) out.image = await imageUrl(v.image, 'heroCar')
  // Berurutan, bukan paralel: peta gambar disimpan per pemanggilan dan paralel bisa saling menimpa.
  if (key === 'gallery' && Array.isArray(v.images)) {
    out.images = []
    for (const f of v.images as string[]) (out.images as string[]).push(await imageUrl(f, 'gallery'))
  }
  if (key === 'cars' && Array.isArray(v.items)) {
    out.items = []
    for (const it of v.items as Record<string, unknown>[]) {
      ;(out.items as unknown[]).push({ ...it, image: typeof it.image === 'string' && it.image ? await imageUrl(it.image, 'carCut') : '' })
    }
  }
  return out
}

async function main() {
  let seed: Seed
  try {
    seed = JSON.parse(await readFile(path.join(DIR, 'seed.json'), 'utf8'))
  } catch {
    console.error('Berkas data/seed-lokal/seed.json tidak ada atau bukan JSON yang valid.')
    process.exit(1)
  }

  for (const b of seed.branches ?? []) {
    const data: { address?: string; photo?: string } = {}
    if (b.address) data.address = b.address
    if (b.photo) data.photo = await imageUrl(b.photo, 'branch')
    if (Object.keys(data).length) await db.branch.updateMany({ where: { slug: b.slug }, data })
  }

  if (seed.services?.length) {
    await db.servicePrice.deleteMany()
    for (const [i, s] of seed.services.entries()) {
      await db.servicePrice.create({
        data: {
          groupName: s.groupName,
          name: s.name,
          variant: s.variant ?? '',
          ringMin: s.ringMin ?? null,
          ringMax: s.ringMax ?? null,
          minDiameter: s.minDiameter ?? null,
          price: s.price,
          unit: s.unit ?? '',
          altLabel: s.altLabel ?? '',
          altPrice: s.altPrice ?? null,
          note: s.note ?? '',
          keywords: (s.keywords ?? '').toLowerCase(),
          sort: i + 1,
        },
      })
    }
  }

  // Produk beranda. Harga dan stok per cabang dibuat 0 hanya kalau barisnya belum ada, jadi isian admin aman.
  const ids: number[] = []
  if (seed.products?.length) {
    const branches = await db.branch.findMany()
    for (const p of seed.products) {
      const brand = (await db.brand.findUnique({ where: { name: p.brand } })) ?? (await db.brand.create({ data: { name: p.brand, sort: 99 } }))
      const cat = await db.category.findFirst({ where: { name: p.category } })
      const image = await imageUrl(p.image, 'productCut')
      const data = { name: p.name, spec: p.spec, fitment: p.fitment ?? '', images: JSON.stringify([image]), isSample: false, active: true, brandId: brand.id, categoryId: cat?.id ?? null }
      const slug = slugify(p.name)
      const prod = await db.product.upsert({ where: { slug }, create: { slug, ...data }, update: data })
      ids.push(prod.id)
      for (const b of branches) {
        await db.listing.upsert({ where: { productId_branchId: { productId: prod.id, branchId: b.id } }, create: { productId: prod.id, branchId: b.id, price: 0, stock: 0, available: true }, update: {} })
      }
    }
    // Sembunyikan (bukan hapus) produk contoh dari situs publik.
    const hidden = await db.product.updateMany({ where: { isSample: true, active: true }, data: { active: false } })
    console.log(`Produk contoh disembunyikan: ${hidden.count}`)
  }

  const content = { ...(seed.content ?? {}) }
  if (ids.length) content.newest = { ...(content.newest ?? {}), products: ids }
  for (const [key, patch] of Object.entries(content)) {
    const row = await db.setting.findUnique({ where: { key } })
    const cur = row ? JSON.parse(row.value) : {}
    const next = { ...cur, ...(await resolveContent(key, patch)) }
    await db.setting.upsert({ where: { key }, create: { key, value: JSON.stringify(next) }, update: { value: JSON.stringify(next) } })
  }

  console.log(`Seed lokal selesai: ${seed.branches?.length ?? 0} cabang, ${seed.services?.length ?? 0} baris jasa, ${seed.products?.length ?? 0} produk, ${Object.keys(content).length} bagian konten.`)
}

main().finally(() => db.$disconnect())
