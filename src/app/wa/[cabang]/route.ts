import { waRedirect } from '@/lib/wa-link'

export async function GET(req: Request, ctx: RouteContext<'/wa/[cabang]'>) {
  const { cabang } = await ctx.params
  const to = await waRedirect(cabang.toLowerCase(), new URL(req.url).searchParams)
  return to ? Response.redirect(to, 302) : new Response('Cabang tidak ditemukan', { status: 404 })
}
