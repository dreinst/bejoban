import { getSession } from '@/lib/auth'
import { MAX_UPLOAD, PRESETS, saveImage, type PresetKey } from '@/lib/images'

export async function POST(req: Request) {
  if (!(await getSession())) return Response.json({ error: 'Belum login' }, { status: 401 })
  const fd = await req.formData()
  const file = fd.get('file')
  const preset = String(fd.get('preset')) as PresetKey
  if (!(preset in PRESETS)) return Response.json({ error: 'Jenis foto tidak dikenal' }, { status: 400 })
  if (!(file instanceof File) || !file.size) return Response.json({ error: 'File kosong' }, { status: 400 })
  if (file.size > MAX_UPLOAD) return Response.json({ error: 'File lebih dari 15 MB' }, { status: 400 })
  try {
    return Response.json({ url: await saveImage(Buffer.from(await file.arrayBuffer()), preset) })
  } catch {
    return Response.json({ error: 'File bukan gambar yang bisa dibaca (pakai JPG, PNG, WebP, atau SVG)' }, { status: 400 })
  }
}
