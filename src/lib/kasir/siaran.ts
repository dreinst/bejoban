// Pemancar siaran kasir di dalam proses. Dipakai route /api/kasir/siaran (Server-Sent Events).
// Aplikasi berjalan sebagai satu proses Node di VPS, jadi pemancar di memori cukup. Kalau nanti lebih dari satu
// proses, ganti isi siarkan() dan dengar() dengan LISTEN/NOTIFY PostgreSQL tanpa mengubah pemanggilnya.

export type JenisSiaran = 'stok' | 'transaksi' | 'pengajuan' | 'keputusan' | 'peringatan'

export type Siaran = {
  jenis: JenisSiaran
  cabangId: number | null // null: tidak terikat cabang
  untukPengguna?: number // kalau diisi, hanya pengguna ini (selain owner) yang menerima
  hanyaOwner?: boolean
  pesan?: string
}

type Pendengar = (s: Siaran) => void
const g = globalThis as unknown as { __siaranKasir?: Set<Pendengar> }
const pendengar = (g.__siaranKasir ??= new Set<Pendengar>())

export function siarkan(...daftar: Siaran[]) {
  for (const s of daftar)
    for (const fn of pendengar) {
      try {
        fn(s)
      } catch (e) {
        console.error('siaran kasir gagal', e)
      }
    }
}

export function dengar(fn: Pendengar) {
  pendengar.add(fn)
  return () => {
    pendengar.delete(fn)
  }
}

// Siapa yang menerima siaran ini. Owner menerima semua. Admin cabang hanya cabangnya atau yang ditujukan kepadanya.
export function bolehTerima(s: Siaran, sesi: { uid: number; role: string; branchId: number | null }) {
  if (sesi.role === 'OWNER') return true
  if (s.hanyaOwner) return false
  if (s.untukPengguna !== undefined) return s.untukPengguna === sesi.uid
  return s.cabangId === null || s.cabangId === sesi.branchId
}
