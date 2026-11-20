// Unduhan CSV untuk tim data. Hanya owner: sesi dicek ulang ke database di server pada tiap unduhan.
// Route handler GET di Next.js 16 tidak di-cache bawaan, dan cookies() membuatnya selalu dijalankan saat diminta.
// Jawabannya tetap diberi Cache-Control no-store supaya browser dan proksi tidak menyimpan isinya.
// Isi dan arti kolom: src/lib/kasir/analitik.ts dan docs/KASIR.md.
import { getSession } from '@/lib/auth'
import { catatAktivitas } from '@/lib/stok/aktivitas'
import { isiEkspor, isJenisEkspor } from '@/lib/kasir/analitik'
import { rentangHariWib } from '@/lib/kasir/logika'

export const runtime = 'nodejs'

const MAKS_HARI = 732
const tanpaSimpan = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' }
const tolak = (pesan: string, status: number) => Response.json({ error: pesan }, { status, headers: tanpaSimpan })

export async function GET(req: Request) {
  const s = await getSession()
  if (!s) return tolak('Belum login', 401)
  if (s.role !== 'OWNER') return tolak('Hanya owner yang bisa mengunduh data', 403)
  const q = new URL(req.url).searchParams
  const jenis = q.get('jenis')
  if (!isJenisEkspor(jenis)) return tolak('Jenis ekspor tidak dikenal', 400)
  const dari = q.get('dari') ?? ''
  const sampai = q.get('sampai') ?? ''
  const r = rentangHariWib(dari, sampai)
  if (!r) return tolak('Tanggal tidak valid', 400)
  if (r.akhir.getTime() - r.mulai.getTime() > MAKS_HARI * 24 * 3600_000) return tolak('Rentang paling panjang dua tahun', 400)
  const isi = await isiEkspor(jenis, r)
  await catatAktivitas({ pengguna: String(s.uid), aksi: 'ekspor_csv', entitas: 'kasir', data: { jenis, dari, sampai } })
  return new Response(isi, {
    headers: { ...tanpaSimpan, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="bejoban-${jenis}-${dari}-${sampai}.csv"` },
  })
}
