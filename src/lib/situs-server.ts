import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { db } from './db'
import { alamatSitusDari, mergeSitus } from './situs'

export const getSitus = cache(async () => {
  const row = await db.setting.findUnique({ where: { key: 'situs' } })
  return mergeSitus(row ? JSON.parse(row.value) : null)
})

/** Alamat situs untuk tautan pendek /wa/<cabang>: `SITE_URL` bila diisi, kalau kosong dari header permintaan. */
export async function alamatSitus() {
  const h = await headers()
  return alamatSitusDari(process.env.SITE_URL, h.get('x-forwarded-proto'), h.get('host'))
}
