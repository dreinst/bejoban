// Siaran kasir lewat Server-Sent Events: perubahan stok, transaksi, pengajuan diskon, keputusan owner, peringatan stok.
// Hanya untuk sesi admin. Owner menerima semua cabang, admin cabang hanya cabangnya (src/lib/kasir/siaran.ts).
// Akun dicek ulang ke database sebelum tiap siaran dan bersama detak. Kalau akun dinonaktifkan, dihapus, atau berganti
// peran atau cabang, koneksi diputus. Sambungan ulang dari browser lalu melewati cek sesi dari awal.
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { bolehTerima, dengar } from '@/lib/kasir/siaran'

export const runtime = 'nodejs'

const DETAK_MS = 25_000

export async function GET(req: Request) {
  const s = await getSession()
  if (!s) return Response.json({ error: 'Belum login' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  const enc = new TextEncoder()
  let lepas = () => {}
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const kirim = (teks: string) => {
        try {
          controller.enqueue(enc.encode(teks))
        } catch {
          lepas()
        }
      }
      let putus = false
      const tutup = () => {
        if (putus) return
        putus = true
        lepas()
        try {
          controller.close()
        } catch {}
      }
      const masihSah = async () => {
        const u = await db.user.findUnique({ where: { id: s.uid }, select: { aktif: true, role: true, branchId: true } }).catch(() => null)
        return !!u && u.aktif && u.role === s.role && u.branchId === s.branchId
      }
      // Antrean supaya urutan siaran tetap sama walau tiap kiriman menunggu cek akun.
      let antrean = Promise.resolve()
      const lewatCek = (teks: string) => {
        antrean = antrean.then(async () => {
          if (putus) return
          if (await masihSah()) kirim(teks)
          else tutup()
        })
      }
      // retry: jeda sambung ulang EventSource bawaan browser.
      kirim(`retry: 5000\n: tersambung\n\n`)
      const berhenti = dengar((ev) => {
        if (bolehTerima(ev, s)) lewatCek(`event: ${ev.jenis}\ndata: ${JSON.stringify({ cabangId: ev.cabangId, pesan: ev.pesan ?? null })}\n\n`)
      })
      // Detak supaya proksi (Caddy) tidak menutup koneksi yang diam. Sekaligus cek akun berkala.
      const detak = setInterval(() => lewatCek(`: detak\n\n`), DETAK_MS)
      lepas = () => {
        clearInterval(detak)
        berhenti()
      }
      req.signal.addEventListener('abort', tutup)
    },
    cancel() {
      lepas()
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
