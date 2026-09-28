import sharp from 'sharp'
import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

import { PRESETS, type PresetKey } from './images-presets'

export { PRESETS, type PresetKey }

export const MAX_UPLOAD = 15 * 1024 * 1024

export const uploadDir = () => path.resolve(process.env.UPLOAD_DIR || './data/uploads')

export async function saveImage(input: Buffer, preset: PresetKey): Promise<string> {
  const p = PRESETS[preset]
  const img = sharp(input, { failOn: 'error' }).rotate()
  const out =
    p.fit === 'cover'
      ? img.resize(p.w, p.h, { fit: 'cover', position: sharp.strategy.attention })
      : p.fit === 'contain' && preset === 'product'
        ? img.resize(p.w, p.h, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' })
        : img.resize(p.w, p.h, { fit: p.fit === 'contain' ? 'contain' : 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 }, withoutEnlargement: p.fit === 'inside' })
  const buf = await out.webp({ quality: 82 }).toBuffer()
  const name = `${preset}-${randomUUID().slice(0, 12)}.webp`
  await mkdir(uploadDir(), { recursive: true })
  await writeFile(path.join(uploadDir(), name), buf)
  return `/media/${name}`
}
