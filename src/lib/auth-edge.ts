import { jwtVerify } from 'jose'

// Cek cepat di proxy. Otorisasi sebenarnya tetap di server (lib/auth.ts): proxy tidak membaca database,
// jadi akun nonaktif atau terhapus baru ditolak oleh getSession di halaman, aksi, dan route API.
export async function verifyToken(token?: string) {
  if (!token) return false
  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET), { algorithms: ['HS256'] })
    return true
  } catch {
    return false
  }
}
