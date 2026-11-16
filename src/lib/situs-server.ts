import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { db } from './db'
import { mergeSitus } from './situs'

export const getSitus = cache(async () => {
  const row = await db.setting.findUnique({ where: { key: 'situs' } })
  return mergeSitus(row ? JSON.parse(row.value) : null)
})

/** Alamat situs yang sedang dipakai membuka admin, dasar untuk tautan pendek /wa/<cabang>. */
export async function alamatSitus() {
  const h = await headers()
  return `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host') ?? 'localhost'}`
}
