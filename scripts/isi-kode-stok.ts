// Isi kolom StockTire.kode yang masih kosong sesudah migrasi 20261116140000_penyelarasan_bejostock.
// Jalankan sekali sesudah `npx prisma migrate deploy`: npm run isi:kode
// Aman diulang: baris yang sudah punya kode tidak disentuh. Hanya kolom kode yang diubah.
import 'dotenv/config'
import { db } from '../src/lib/db'
import { isiKodeKosong } from '../src/lib/stok/ubah'

async function main() {
  const hasil = await db.$transaction((tx) => isiKodeKosong(tx), { timeout: 60_000 })
  const kosong = await db.stockTire.count({ where: { kode: null } })
  console.log(`Kode diisi: ${hasil.diisi} baris. Masih kosong: ${kosong}.`)
  console.log(`Baris kembar (ukuran dan merek sama) yang diberi sufiks urutan: ${hasil.kembar.length}`)
  for (const k of hasil.kembar) console.log(`  id ${k.id}: ${k.kode}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
