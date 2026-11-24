// Pemetaan id LID WhatsApp ke nomor untuk cermin chat, plus penggabungan chat lama yang tersimpan dengan id LID.
// Urutan sumber nomor: payload pesan (SenderAlt/RecipientAlt), tabel wa_lid, lalu API lids WAHA sebagai cadangan.
// Pemetaan yang gagal tidak pernah menolak pesan: pesan tetap disimpan dengan id LID dan digabung nanti.
import { db } from '../db'
import { chatGrup, chatLid, cuplikan, pnDari } from './baca'

// Mencari nomor untuk satu LID. '' = tidak diketahui. Boleh melempar galat (dianggap tidak diketahui).
export type CariPn = (lid: string) => Promise<string>

// API WAHA: GET /api/{session}/lids/{lid} menjawab { lid, pn }. Lid di-encode lengkap dengan "@lid".
export function pencariWaha(url: string, kunci: string, session: string, batasMs = 5000): CariPn {
  const dasar = url.replace(/\/$/, '')
  return async (lid) => {
    const res = await fetch(`${dasar}/api/${encodeURIComponent(session)}/lids/${encodeURIComponent(lid)}`, {
      headers: { 'X-Api-Key': kunci, Accept: 'application/json' },
      signal: AbortSignal.timeout(batasMs),
    })
    if (!res.ok) throw new Error(`WAHA ${res.status} di /lids`)
    return pnDari((await res.json())?.pn)
  }
}

// Pencari dari env app, atau undefined kalau sambungan WAHA belum diisi.
export const pencariDariEnv = (): CariPn | undefined => {
  const url = process.env.WAHA_URL ?? ''
  const kunci = process.env.WAHA_API_KEY ?? ''
  return url && kunci ? pencariWaha(url, kunci, process.env.WAHA_SESSION || 'default') : undefined
}

// LID yang baru gagal dicari tidak ditanyakan lagi ke WAHA selama 10 menit, supaya tiap pesan tidak memanggil WAHA.
const gagal = new Map<string, number>()
const JEDA_GAGAL = 10 * 60_000
export const lupakanGagal = () => gagal.clear()

// Gabungkan semua baris dengan chat_id = lid ke chat_id = pn. Pesan yang ada di kedua sisi (id pendek sama)
// menjadi satu: tanda dihapus dan diedit digabung, isi hasil edit dipertahankan, baris sementara kalah dari baris asli.
export async function gabungLid(lid: string, pn: string): Promise<{ pindah: number; ganda: number }> {
  if (!chatLid(lid) || !pnDari(pn)) return { pindah: 0, ganda: 0 }
  const hasil = await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "wa_pesan" p SET
        "dihapus" = p."dihapus" OR l."dihapus",
        "diedit" = p."diedit" OR l."diedit",
        "isi" = CASE WHEN p."diedit" THEN p."isi" WHEN l."diedit" THEN l."isi" WHEN p."sementara" AND NOT l."sementara" THEN l."isi" ELSE p."isi" END,
        "pengirim" = CASE WHEN l."pengirim" = 'bot' OR p."sementara" AND NOT l."sementara" THEN l."pengirim" ELSE p."pengirim" END,
        "jenis" = CASE WHEN p."sementara" AND NOT l."sementara" THEN l."jenis" ELSE p."jenis" END,
        "nama_berkas" = CASE WHEN p."sementara" AND NOT l."sementara" THEN l."nama_berkas" ELSE p."nama_berkas" END,
        "nama_pengirim" = CASE WHEN p."nama_pengirim" = '' THEN l."nama_pengirim" ELSE p."nama_pengirim" END,
        "waktu" = CASE WHEN p."sementara" AND NOT l."sementara" THEN l."waktu" ELSE p."waktu" END,
        "sementara" = p."sementara" AND l."sementara"
      FROM "wa_pesan" l
      WHERE l."chat_id" = ${lid} AND p."chat_id" = ${pn} AND p."id_pendek" = l."id_pendek"`
    const ganda = await tx.$executeRaw`
      DELETE FROM "wa_pesan" l USING "wa_pesan" p
      WHERE l."chat_id" = ${lid} AND p."chat_id" = ${pn} AND p."id_pendek" = l."id_pendek"`
    const pindah = await tx.$executeRaw`UPDATE "wa_pesan" SET "chat_id" = ${pn} WHERE "chat_id" = ${lid}`
    const lama = await tx.waChat.findUnique({ where: { chatId: lid } })
    if (lama) {
      const baru = await tx.waChat.findUnique({ where: { chatId: pn } })
      if (baru) {
        // Waktu dilihat diambil yang lebih baru, nama yang sudah ada di chat nomor dipertahankan.
        const dilihat = [baru.dilihat, lama.dilihat].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null
        await tx.waChat.update({ where: { chatId: pn }, data: { nama: baru.nama || lama.nama, dilihat } })
      } else {
        await tx.waChat.create({ data: { chatId: pn, nama: lama.nama, grup: false, dilihat: lama.dilihat } })
      }
      await tx.waChat.delete({ where: { chatId: lid } })
    }
    const akhir = await tx.waPesan.findFirst({ where: { chatId: pn }, orderBy: [{ waktu: 'desc' }, { id: 'desc' }], select: { isi: true, jenis: true, namaBerkas: true, dihapus: true, waktu: true } })
    if (akhir) await tx.waChat.update({ where: { chatId: pn }, data: { pesanTerakhir: cuplikan(akhir), waktuTerakhir: akhir.waktu } })
    return { pindah, ganda }
  })
  return hasil
}

// Simpan pemetaan, lalu gabungkan sisa baris LID kalau ada. Kegagalan gabung tidak menghentikan penyimpanan pesan.
export async function catatLid(lid: string, pn: string) {
  if (!chatLid(lid) || !pnDari(pn)) return
  await db.waLid.upsert({ where: { lid }, create: { lid, pn }, update: { pn, diperbarui: new Date() } })
  gagal.delete(lid)
  const sisa = (await db.waChat.count({ where: { chatId: lid } })) + (await db.waPesan.count({ where: { chatId: lid } }))
  if (!sisa) return
  try {
    await gabungLid(lid, pn)
  } catch (e) {
    console.error('Gabung chat LID cermin gagal, dicoba lagi nanti:', (e as Error)?.name ?? 'galat')
  }
}

// Nomor untuk sekumpulan chat LID pribadi. alt: nomor yang sudah dibawa payload. Hasil: lid -> pn (yang ketemu saja).
export async function petakanLid(lids: string[], alt: Map<string, string> = new Map(), cari?: CariPn): Promise<Map<string, string>> {
  const hasil = new Map<string, string>()
  const calon = [...new Set(lids)].filter((l) => chatLid(l) && !chatGrup(l))
  if (!calon.length) return hasil
  for (const l of calon) {
    const pn = pnDari(alt.get(l))
    if (pn) {
      hasil.set(l, pn)
      await catatLid(l, pn)
    }
  }
  const belum = calon.filter((l) => !hasil.has(l))
  if (belum.length) for (const r of await db.waLid.findMany({ where: { lid: { in: belum } } })) hasil.set(r.lid, r.pn)
  for (const l of belum) {
    if (hasil.has(l)) {
      await catatLid(l, hasil.get(l)!) // menggabungkan sisa baris lama kalau ada
      continue
    }
    if (!cari || (gagal.get(l) ?? 0) > Date.now() - JEDA_GAGAL) continue
    let pn = ''
    try {
      pn = pnDari(await cari(l))
    } catch {
      pn = ''
    }
    if (!pn) {
      gagal.set(l, Date.now())
      continue
    }
    hasil.set(l, pn)
    await catatLid(l, pn)
  }
  return hasil
}
