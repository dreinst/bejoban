import { readFile } from 'fs/promises'
import path from 'path'
import { uploadDir } from '@/lib/images'

export async function GET(_: Request, ctx: RouteContext<'/media/[name]'>) {
  const { name } = await ctx.params
  if (!/^[\w-]+\.(webp|png|jpg|svg)$/.test(name)) return new Response('Not found', { status: 404 })
  try {
    const buf = await readFile(path.join(uploadDir(), name))
    const type = name.endsWith('.svg') ? 'image/svg+xml' : `image/${name.split('.').pop()}`
    return new Response(buf, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable' } })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
