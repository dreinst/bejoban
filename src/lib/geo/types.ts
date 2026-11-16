export type Place = {
  name: string // nama tempat
  kecamatan: string
  city: string // kota atau kabupaten
  province: string
  lat: number
  lon: number
  display: string // alamat lengkap dari penyedia
  precision?: 'alamat' | 'kecamatan' | 'kota' | 'provinsi' // seberapa tepat titik hasil, untuk ditampilkan jujur ke admin
}

// Antarmuka penyedia lokasi. Bawaan OpenStreetMap (tanpa kunci), Google Maps kalau kunci API diisi.
export interface GeoProvider {
  id: string
  search(query: string): Promise<Place[]>
}
