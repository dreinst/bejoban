// Webhook WAHA untuk cermin chat WhatsApp (event message.any, message.revoked, message.edited).
// Setiap permintaan wajib membawa HMAC SHA-512 yang cocok di header X-Webhook-Hmac, dengan kunci WAHA_WEBHOOK_HMAC.
// Tanpa kunci di env, semua permintaan ditolak. Tanpa HMAC yang cocok dijawab 401 dan tidak ada yang disimpan.
// Webhook ini hanya mencatat; tidak pernah mengirim pesan dan tidak menyentuh perilaku bot.
// Isi pesan tidak pernah dicetak ke log (data pribadi pelanggan).
import { bacaEvent, hmacCocok } from '@/lib/cermin/baca'
import { bersihkanBilaPerlu, terapkanEvent } from '@/lib/cermin/simpan'

const NO_STORE = { 'Cache-Control': 'no-store' }
const MAKS_BODY = 1_000_000 // byte; payload pesan tanpa media jauh di bawah ini

// Baca body paling banyak `maks` byte, supaya permintaan raksasa tanpa HMAC tidak menghabiskan memori.
async function bacaTerbatas(req: Request, maks: number): Promise<string | null> {
  const panjang = Number(req.headers.get('content-length') ?? '')
  if (Number.isFinite(panjang) && panjang > maks) return null
  if (!req.body) return ''
  const reader = req.body.getReader()
  const potongan: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maks) {
      await reader.cancel().catch(() => null)
      return null
    }
    potongan.push(value)
  }
  return Buffer.concat(potongan).toString('utf8')
}

export async function POST(req: Request) {
  const kunci = process.env.WAHA_WEBHOOK_HMAC
  if (!kunci) return Response.json({ error: 'Webhook belum dipasang' }, { status: 401, headers: NO_STORE })
  const raw = await bacaTerbatas(req, MAKS_BODY)
  if (raw === null) return Response.json({ error: 'Terlalu besar' }, { status: 413, headers: NO_STORE })
  if (!hmacCocok(raw, req.headers.get('x-webhook-hmac'), kunci)) return Response.json({ error: 'HMAC tidak cocok' }, { status: 401, headers: NO_STORE })

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return Response.json({ error: 'Bukan JSON' }, { status: 400, headers: NO_STORE })
  }
  // Hanya sesi bot. Sesi lain (kalau WAHA dipakai bersama) diabaikan tanpa galat supaya WAHA tidak mengulang.
  const sesi = process.env.WAHA_SESSION || 'default'
  const sesiBody = (body as { session?: unknown })?.session
  if (typeof sesiBody === 'string' && sesiBody !== sesi) return Response.json({ ok: true, simpan: false }, { headers: NO_STORE })

  try {
    const { simpan } = await terapkanEvent(bacaEvent(body))
    await bersihkanBilaPerlu()
    return Response.json({ ok: true, simpan }, { headers: NO_STORE })
  } catch (e) {
    // 500 membuat WAHA mengulang kiriman (penyimpanan idempoten, jadi aman). Yang dicatat hanya jenis galatnya.
    console.error('Webhook cermin gagal menyimpan:', (e as Error)?.name ?? 'galat')
    return Response.json({ error: 'Gagal menyimpan' }, { status: 500, headers: NO_STORE })
  }
}
