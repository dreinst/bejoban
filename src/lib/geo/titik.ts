// Membaca titik koordinat dari yang ditempel admin: tautan Google Maps lengkap atau dua angka "lintang, bujur".
// Tautan pendek (maps.app.goo.gl) tidak berisi koordinat, jadi dikenali sebagai tidak terbaca.

export type Titik = { lat: number; lon: number }

const sah = (lat: number, lon: number): Titik | null => (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null)
const angka = '(-?\\d{1,3}(?:\\.\\d+)?)'

export function bacaTitik(teks: string): Titik | null {
  const t = teks.trim()
  if (!t) return null
  // Dua angka saja, mis. "-7.8826, 112.5272" (hasil salin dari Google Maps) atau dengan koma desimal "-7,8826 112,5272".
  const pasang = t.match(new RegExp(`^${angka}\\s*[,;\\s]\\s*${angka}$`)) ?? t.replace(/(\d),(\d)/g, '$1.$2').match(new RegExp(`^${angka}\\s*[;\\s]\\s*${angka}$`))
  if (pasang) return sah(Number(pasang[1]), Number(pasang[2]))
  // Tautan: !3d<lintang>!4d<bujur> (titik tempat), @<lintang>,<bujur> (pusat peta), ?q= atau ll= berisi dua angka.
  const dalam =
    t.match(new RegExp(`!3d${angka}!4d${angka}`)) ??
    t.match(new RegExp(`@${angka},${angka}`)) ??
    t.match(new RegExp(`[?&](?:q|ll|query|center|destination)=${angka}(?:,|%2C)${angka}`, 'i'))
  return dalam ? sah(Number(dalam[1]), Number(dalam[2])) : null
}
