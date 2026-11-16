import 'server-only'
import { cache } from 'react'
import { db } from './db'
import { mergeSitus } from './situs'

export const getSitus = cache(async () => {
  const row = await db.setting.findUnique({ where: { key: 'situs' } })
  return mergeSitus(row ? JSON.parse(row.value) : null)
})
