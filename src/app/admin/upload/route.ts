import { getSession } from '@/lib/auth'
import { MAX_UPLOAD, PRESETS, saveImage, type PresetKey } from '@/lib/images'
import { PRESET_ADMIN_CABANG } from '@/lib/images-presets'

export async function POST(req: Request) {
  const sesi = await getSession()
  if (!sesi) return Response.json({ error: 'Belum login' }, { status: 401 })
  const fd = await req.formData()
  const file = fd.get('file')
  const preset = String(fd.get('preset')) as PresetKey
  if (!(preset in PRESETS)) return Response.json({ error: 'Jenis foto tidak dikenal' }, { status: 400 })
  if (sesi.role !== 'OWNER' && !PRESET_ADMIN_CABANG.includes(preset)) return Response.json({ error: 'Jenis foto ini hanya bisa diunggah owner' }, { status: 403 })
  if (!(file instanceof File) || !file.size) return Response.json({ error: 'File kosong' }, { status: 400 })
  if (file.size > MAX_UPLOAD) return Response.json({ error: 'File lebih dari 15 MB' }, { status: 400 })
  try {
    return Response.json({ url: await saveImage(Buffer.from(await file.arrayBuffer()), preset) })
  } catch {
    return Response.json({ error: 'File bukan gambar yang bisa dibaca (pakai JPG, PNG, WebP, atau SVG)' }, { status: 400 })
  }
}
