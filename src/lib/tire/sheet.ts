// Ekspor CSV dari Google Sheets. Hanya docs.google.com yang boleh diambil (cegah SSRF).
// Spreadsheet harus dibagikan "Siapa saja yang memiliki tautan dapat melihat".

export type SheetUrl = { ok: true; csvUrl: string } | { ok: false; error: string }

export function sheetCsvUrl(input: string, allowLocal = false): SheetUrl {
  let u: URL
  try {
    u = new URL(input.trim())
  } catch {
    return { ok: false, error: 'URL spreadsheet tidak valid.' }
  }
  // Untuk uji lokal saja (bukan produksi): boleh CSV dari komputer sendiri.
  if (allowLocal && u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)) return { ok: true, csvUrl: u.toString() }
  if (u.protocol !== 'https:' || u.hostname !== 'docs.google.com') return { ok: false, error: 'Hanya tautan Google Sheets (docs.google.com) yang bisa dipakai.' }
  const id = /\/spreadsheets\/d\/([\w-]+)/.exec(u.pathname)?.[1]
  if (!id) return { ok: false, error: 'ID spreadsheet tidak ditemukan di URL.' }
  const gid = /[#?&]gid=(\d+)/.exec(u.hash)?.[1] ?? u.searchParams.get('gid') ?? '0'
  return { ok: true, csvUrl: `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}` }
}

export async function fetchSheetCsv(csvUrl: string, maxBytes = 2_000_000): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(csvUrl, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'BejoBanInternalTool/1.0' } })
    if (!res.ok) return { ok: false, error: `Spreadsheet menjawab ${res.status}. Periksa tautan dan pengaturan berbagi.` }
    const type = res.headers.get('content-type') ?? ''
    if (type.includes('text/html')) return { ok: false, error: 'Spreadsheet belum dibagikan. Ubah akses menjadi "Siapa saja yang memiliki tautan dapat melihat".' }
    const text = await res.text()
    if (text.length > maxBytes) return { ok: false, error: 'Ekspor terlalu besar (maksimal 2 MB).' }
    return { ok: true, text }
  } catch {
    return { ok: false, error: 'Gagal mengambil spreadsheet (koneksi atau waktu habis).' }
  }
}
