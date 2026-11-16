// Isi data nyata client dari berkas lokal data/seed-lokal.json (diabaikan git) ke database.
// Berkas itu berisi harga jasa dan alamat cabang. Jangan menuliskan angka asli di berkas yang masuk git.
//   npm run seed:lokal
// Format data/seed-lokal.json:
//   { "branches": [{ "slug": "karanglo", "address": "..." }],
//     "services": [{ "groupName": "...", "name": "...", "variant": "", "ringMin": 12, "ringMax": 15, "minDiameter": null,
//                    "price": 0, "unit": "", "altLabel": "", "altPrice": null, "note": "", "keywords": "a, b" }] }
import 'dotenv/config'
import { readFile } from 'fs/promises'
import path from 'path'
import { db } from '../src/lib/db'

type Svc = { groupName: string; name: string; variant?: string; ringMin?: number | null; ringMax?: number | null; minDiameter?: number | null; price: number | null; unit?: string; altLabel?: string; altPrice?: number | null; note?: string; keywords?: string }

async function main() {
  const file = path.join(process.cwd(), 'data', 'seed-lokal.json')
  let data: { branches?: { slug: string; address?: string }[]; services?: Svc[] }
  try {
    data = JSON.parse(await readFile(file, 'utf8'))
  } catch {
    console.error('Berkas data/seed-lokal.json tidak ada atau bukan JSON yang valid.')
    process.exit(1)
  }
  for (const b of data.branches ?? []) {
    if (b.address) await db.branch.updateMany({ where: { slug: b.slug }, data: { address: b.address } })
  }
  if (data.services?.length) {
    await db.servicePrice.deleteMany()
    for (const [i, s] of data.services.entries()) {
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
  console.log(`Seed lokal selesai: ${data.branches?.length ?? 0} cabang, ${data.services?.length ?? 0} baris jasa.`)
}

main().finally(() => db.$disconnect())
