import { db } from './db'
import { renderTemplate } from './text/template'
import { branchLabel, mergeSitus, waNumber, type Situs } from './situs'
import { waLink } from './format'

const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10) // tanggal Jakarta

type Kind = keyof Situs['openers']
const KINDS: Kind[] = ['umum', 'produk']

// Tautan pendek /wa/<cabang>: alihkan ke wa.me dengan nomor utama dan kalimat pembuka cabang.
// Hanya hitungan klik per cabang per hari yang disimpan, tanpa data pribadi.
export async function waRedirect(slug: string | null, q: URLSearchParams): Promise<string | null> {
  const [row, branches] = await Promise.all([db.setting.findUnique({ where: { key: 'situs' } }), db.branch.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }] })])
  const s = mergeSitus(row ? JSON.parse(row.value) : null)
  const branch = slug ? branches.find((b) => b.slug === slug) : null
  if (slug && !branch) return null
  const kindRaw = q.get('k') as Kind | null
  const kind: Kind = kindRaw && KINDS.includes(kindRaw) ? kindRaw : q.get('p') ? 'produk' : 'umum'
  const vars = { cabang: branch ? branchLabel(branch.name) : 'Bejo Ban', produk: (q.get('p') ?? '').slice(0, 150) }
  const extra = (q.get('x') ?? '').slice(0, 1500)
  const text = renderTemplate(s.openers[kind], vars) + (extra ? `\n${extra}` : '')
  const number = branch ? waNumber(s, branch) : s.mainWhatsapp || branches[0]?.whatsapp || ''
  if (!number) return null
  await db.waClick.upsert({ where: { day_branch: { day: today(), branch: slug ?? '' } }, create: { day: today(), branch: slug ?? '', count: 1 }, update: { count: { increment: 1 } } })
  return waLink(number, text)
}
