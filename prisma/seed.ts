import 'dotenv/config'
import sharp from 'sharp'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { db } from '../src/lib/db'
import { saveImage, type PresetKey } from '../src/lib/images'
import { slugify } from '../src/lib/format'
import { ensureSampleRates } from '../src/lib/ongkir/sample'

const A = (f: string) => path.join(__dirname, 'seed-assets', f)
const ig = (f: string) => A('ig/' + f)

async function img(file: string, preset: PresetKey, crop?: { top: number; height: number }) {
  let buf = await readFile(file)
  if (file.endsWith('.svg')) buf = await sharp(buf, { density: 300 }).png().toBuffer()
  if (crop) {
    // Koordinat potong ditulis untuk lebar 360 px, lalu diskalakan ke ukuran asli foto.
    const { width = 360 } = await sharp(buf).metadata()
    const k = width / 360
    buf = await sharp(buf).extract({ left: 0, top: Math.round(crop.top * k), width, height: Math.round(crop.height * k) }).toBuffer()
  }
  return saveImage(buf, preset)
}

// Foto IG berupa cover reel 360x640 dengan teks di atas; bagian ini membuang teksnya.
const below = { top: 190, height: 180 }

async function main() {
  await ensureSampleRates()
  if (await db.user.count()) {
    console.log('Database sudah berisi data, seed dilewati.')
    return
  }

  const batu = await db.branch.create({
    data: {
      slug: 'batu',
      name: 'Bejo Ban Batu (Hankook Masters)',
      instagram: 'bejoban',
      whatsapp: '082332705654',
      address: 'Jalan Brantas No 35, Batu (city) 65311',
      mapsUrl: 'https://maps.google.com/?q=Bejo+Ban+Hankook+Masters+Jl.+Brantas+35+Batu',
      services: 'Ban, Velg, Oli, Spooring, Balance, Nitrogen',
      photo: await img(ig('01_Dds5h0pTU8n.jpg'), 'branch', { top: 200, height: 210 }),
      sort: 1,
    },
  })
  const karanglo = await db.branch.create({
    data: {
      slug: 'karanglo',
      name: 'Bejo Ban Karanglo',
      instagram: 'bejobankaranglo',
      whatsapp: '082140220910',
      address: '',
      services: 'Ban, Oli, Spooring, Balancing, Nitrogen',
      photo: await img(ig('k09_DaUU9Bjp9w4.jpg'), 'branch', { top: 230, height: 210 }),
      sort: 2,
    },
  })

  const creds: string[] = []
  for (const u of [
    { username: 'owner', name: 'Owner', role: 'OWNER', branchId: null },
    { username: 'adminbatu', name: 'Admin Batu', role: 'BRANCH_ADMIN', branchId: batu.id },
    { username: 'adminkaranglo', name: 'Admin Karanglo', role: 'BRANCH_ADMIN', branchId: karanglo.id },
  ]) {
    const pw = randomBytes(9).toString('base64url')
    await db.user.create({ data: { ...u, passwordHash: await bcrypt.hash(pw, 10) } })
    creds.push(`${u.username}\t${pw}\t${u.role}`)
  }
  await mkdir('data', { recursive: true })
  await writeFile('data/CREDENTIALS-LOKAL.txt', 'Akun admin lokal (ganti password setelah login)\n' + creds.join('\n') + '\n')

  const cat = async (name: string, icon: string, sort: number) =>
    db.category.create({ data: { name, slug: slugify(name), sort, image: await img(A(icon), 'category') } })
  const cBan = await cat('Ban', 'ban.svg', 1)
  const cVelg = await cat('Velg', 'velg.svg', 2)
  const cOli = await cat('Oli', 'oli.svg', 3)

  const brands = Object.fromEntries(
    await Promise.all(
      ['Hankook', 'Michelin', 'BFGoodrich', 'Sailun'].map(async (name, i) => [name, await db.brand.create({ data: { name, sort: i } })]),
    ),
  )

  const pic = { ban: await img(A('ban.svg'), 'product'), velg: await img(A('velg.svg'), 'product'), oli: await img(A('oli.svg'), 'product') }

  type P = { name: string; spec: string; fitment: string; cat: typeof cBan; brand?: string; pic: string; batu?: [number, number?, boolean?]; kl?: [number, number?, boolean?] }
  const products: P[] = [
    { name: 'Hankook Kinergy Eco2 K435 185/65 R15', spec: '185/65 R15', fitment: 'Avanza, Xenia, Mobilio, Livina', cat: cBan, brand: 'Hankook', pic: pic.ban, batu: [850000] },
    { name: 'Hankook Ventus Prime 4 K135 205/55 R16', spec: '205/55 R16', fitment: 'Civic, Corolla Altis', cat: cBan, brand: 'Hankook', pic: pic.ban, batu: [1250000] },
    { name: 'Hankook Dynapro AT2 RF11 265/65 R17', spec: '265/65 R17', fitment: 'Fortuner, Pajero Sport, FJ Cruiser', cat: cBan, brand: 'Hankook', pic: pic.ban, batu: [2150000, 2350000, true] },
    { name: 'Michelin Primacy 4 ST 205/65 R16', spec: '205/65 R16', fitment: 'Innova', cat: cBan, brand: 'Michelin', pic: pic.ban, batu: [1650000], kl: [1650000] },
    { name: 'Michelin Energy XM2+ 185/70 R14', spec: '185/70 R14', fitment: 'Avanza, Xenia, Granmax', cat: cBan, brand: 'Michelin', pic: pic.ban, batu: [950000], kl: [920000, 950000, true] },
    { name: 'BFGoodrich All-Terrain T/A KO2 265/70 R16', spec: '265/70 R16', fitment: 'FJ Cruiser, Hilux', cat: cBan, brand: 'BFGoodrich', pic: pic.ban, batu: [3100000] },
    { name: 'Sailun Atrezzo Elite 195/65 R15', spec: '195/65 R15', fitment: 'Xpander, Ertiga', cat: cBan, brand: 'Sailun', pic: pic.ban, batu: [650000] },
    { name: 'Velg Pickup Ring 14 PCD 6x139.7 Silver', spec: 'R14 / PCD 6x139.7', fitment: 'Traga, L300, Granmax', cat: cVelg, pic: pic.velg, batu: [800000] },
    { name: 'Velg Ring 17 PCD 6x139.7 Hitam', spec: 'R17 / PCD 6x139.7', fitment: 'Pajero Sport, Fortuner', cat: cVelg, pic: pic.velg, batu: [1750000] },
    { name: 'Oli Mesin Mobil 10W-40 4 Liter', spec: '4 Liter', fitment: '', cat: cOli, pic: pic.oli, batu: [380000], kl: [380000] },
  ]
  const ids: number[] = []
  for (const p of products) {
    const listings = [
      p.batu && { branchId: batu.id, price: p.batu[0], comparePrice: p.batu[1] ?? 0, flashSale: !!p.batu[2], stock: 10 },
      p.kl && { branchId: karanglo.id, price: p.kl[0], comparePrice: p.kl[1] ?? 0, flashSale: !!p.kl[2], stock: 10 },
    ].filter((x) => !!x)
    const created = await db.product.create({
      data: {
        name: p.name,
        slug: slugify(p.name),
        spec: p.spec,
        fitment: p.fitment,
        description: 'Produk contoh. Ganti nama, harga dan foto lewat halaman admin.',
        isSample: true,
        images: JSON.stringify([p.pic]),
        categoryId: p.cat.id,
        brandId: p.brand ? brands[p.brand].id : null,
        listings: { create: listings },
      },
    })
    ids.push(created.id)
  }

  const car = async (title: string, query: string, file: string) => ({
    title,
    sub: `Pilihan velg dan ban yang cocok untuk ${query}`,
    query,
    image: await img(ig(file), 'car', below),
  })
  const content: Record<string, object> = {
    site: { logo: await img(A('logo.svg'), 'logo') },
    flash: { endsAt: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 16) },
    hero: {
      side: [await img(ig('03_DdVhANvT_Wc.jpg'), 'heroSide'), await img(ig('10_DcgZXh3zPXT.jpg'), 'heroSide'), await img(ig('02_DdnfdfBTL6S.jpg'), 'heroSide')],
    },
    panel: { storeImage: await img(ig('k09_DaUU9Bjp9w4.jpg'), 'store') },
    promo: {
      thumbs: [await img(ig('00_Dd0x-1UTLUO.jpg'), 'heroSide'), await img(ig('09_Dckig_dTP0A.jpg'), 'heroSide'), await img(ig('06_Dc0hzNBRNbz.jpg'), 'heroSide')],
      products: [ids[7], ids[5], ids[2], ids[3]],
    },
    cars: {
      items: [
        await car('Velg untuk Traga', 'Traga', '11_DcVeQW-Twez.jpg'),
        await car('Ban untuk Innova', 'Innova', '02_DdnfdfBTL6S.jpg'),
        await car('Velg untuk L300', 'L300', '09_Dckig_dTP0A.jpg'),
        await car('Ban untuk FJ Cruiser', 'FJ Cruiser', '10_DcgZXh3zPXT.jpg'),
      ],
    },
  }
  const { readdir } = await import('fs/promises')
  const igFiles = (await readdir(A('ig'))).filter((f) => f.endsWith('.jpg')).sort()
  content.gallery = { images: await Promise.all(igFiles.map((f) => img(ig(f), 'heroSide'))) }
  for (const [key, value] of Object.entries(content)) await db.setting.create({ data: { key, value: JSON.stringify(value) } })

  console.log('Seed selesai. Akun admin tersimpan di data/CREDENTIALS-LOKAL.txt')
}

main().finally(() => db.$disconnect())
