import type { Place } from './types'

// Pilihan lokasi untuk admin: kembaran dibuang dan tiap pilihan diberi pembeda (kelurahan, kecamatan, kota atau kabupaten, provinsi).
// Pembeda diambil dari alamat lengkap penyedia tanpa nama tempat, kode pos, dan "Indonesia". Nomor `i` tetap indeks asli untuk `pick`.
export function pilihanUnik(places: Place[]) {
  const lihat = new Set<string>()
  const hasil: { p: Place; i: number; pembeda: string }[] = []
  places.forEach((p, i) => {
    const bagian = p.display.split(',').map((x) => x.trim()).filter((x) => x && !/^indonesia$/i.test(x) && !/^\d{5}$/.test(x))
    if (bagian[0] && bagian[0].toLowerCase() === p.name.toLowerCase()) bagian.shift()
    const fallback = [p.kecamatan && `Kec. ${p.kecamatan}`, p.city, p.province].filter(Boolean)
    const pembeda = (bagian.length ? bagian : fallback).join(', ')
    const kunci = `${p.name}|${pembeda}`.toLowerCase()
    if (lihat.has(kunci)) return
    lihat.add(kunci)
    hasil.push({ p, i, pembeda })
  })
  return hasil
}
