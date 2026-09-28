import 'server-only'
import { db } from './db'
import { SECTIONS } from './content'

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Content = Record<string, any>

export async function getContent(): Promise<Content> {
  const rows = await db.setting.findMany()
  const saved = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]))
  return Object.fromEntries(SECTIONS.map((s) => [s.key, { ...s.defaults, ...saved[s.key] }]))
}
