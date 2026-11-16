import sharp, { type SharpOptions } from 'sharp'
import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

import { PRESETS, type PresetKey } from './images-presets'

export { PRESETS, type PresetKey }

export const MAX_UPLOAD = 15 * 1024 * 1024

export const uploadDir = () => path.resolve(process.env.UPLOAD_DIR || './data/uploads')

// SVG dikenali dari awal isinya (boleh diawali BOM, spasi, deklarasi XML, atau komentar).
export const isSvg = (input: Buffer) => /^\s*(?:\uFEFF)?\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(input.subarray(0, 4096).toString('utf8'))

// Opsi baca sharp. SVG dirender pada density tinggi supaya tajam setelah diperkecil (bawaan sharp 72 dpi),
// format lain tidak berubah. Transparansi SVG tetap utuh karena latar tidak diratakan.
export const opsiBaca = (input: Buffer): SharpOptions => (isSvg(input) ? { failOn: 'error', density: 300 } : { failOn: 'error' })

export async function saveImage(input: Buffer, preset: PresetKey): Promise<string> {
  const p = PRESETS[preset]
  let img = sharp(input, opsiBaca(input)).rotate()
  // Logo merek: pangkas tepi kosong (transparan atau warna latar polos). Gambar polos satu warna tidak bisa
  // dipangkas, jadi dipakai apa adanya.
  if (preset === 'brand') {
    try {
      img = sharp(await img.trim({ threshold: 10 }).png().toBuffer())
    } catch {
      img = sharp(input, opsiBaca(input)).rotate()
    }
  }
  const out =
    p.fit === 'cover'
      ? img.resize(p.w, p.h, { fit: 'cover', position: sharp.strategy.attention })
      : p.fit === 'contain' && preset === 'product'
        ? img.resize(p.w, p.h, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' })
        : img.resize(p.w, p.h, { fit: p.fit === 'contain' ? 'contain' : 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 }, withoutEnlargement: p.fit === 'inside' && preset !== 'brand' })
  const buf = await out.webp({ quality: 82 }).toBuffer()
  const name = `${preset}-${randomUUID().slice(0, 12)}.webp`
  await mkdir(uploadDir(), { recursive: true })
  await writeFile(path.join(uploadDir(), name), buf)
  return `/media/${name}`
}
