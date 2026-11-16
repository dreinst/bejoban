import { waRedirect } from '@/lib/wa-link'

export async function GET(req: Request) {
  const to = await waRedirect(null, new URL(req.url).searchParams)
  return to ? Response.redirect(to, 302) : new Response('Nomor WhatsApp belum diatur', { status: 404 })
}
