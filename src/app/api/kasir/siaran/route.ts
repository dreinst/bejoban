// Siaran kasir lewat Server-Sent Events: perubahan stok, transaksi, pengajuan diskon, keputusan owner, peringatan stok.
// Hanya untuk sesi admin. Owner menerima semua cabang, admin cabang hanya cabangnya (src/lib/kasir/siaran.ts).
import { getSession } from '@/lib/auth'
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
      // retry: jeda sambung ulang EventSource bawaan browser.
      kirim(`retry: 5000\n: tersambung\n\n`)
      const berhenti = dengar((ev) => {
        if (bolehTerima(ev, s)) kirim(`event: ${ev.jenis}\ndata: ${JSON.stringify({ cabangId: ev.cabangId, pesan: ev.pesan ?? null })}\n\n`)
      })
      // Detak supaya proksi (Caddy) tidak menutup koneksi yang diam.
      const detak = setInterval(() => kirim(`: detak\n\n`), DETAK_MS)
      lepas = () => {
        clearInterval(detak)
        berhenti()
      }
      req.signal.addEventListener('abort', () => {
        lepas()
        try {
          controller.close()
        } catch {}
      })
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
