import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from './db'

const COOKIE = 'bejo_session'
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET)

export type Session = { uid: number; role: 'OWNER' | 'BRANCH_ADMIN'; branchId: number | null; name: string }

export async function createSession(s: Session) {
  const token = await new SignJWT(s).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('7d').sign(key())
  ;(await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function destroySession() {
  ;(await cookies()).delete(COOKIE)
}

export async function verifyToken(token?: string): Promise<Session | null> {
  if (!token) return null
  try {
    return (await jwtVerify(token, key(), { algorithms: ['HS256'] })).payload as unknown as Session
  } catch {
    return null
  }
}

// Cek ulang ke database supaya akun yang dihapus/diubah perannya langsung kehilangan akses.
export async function getSession(): Promise<Session | null> {
  const s = await verifyToken((await cookies()).get(COOKIE)?.value)
  if (!s) return null
  const u = await db.user.findUnique({ where: { id: s.uid } })
  if (!u) return null
  return { uid: u.id, role: u.role as Session['role'], branchId: u.branchId, name: u.name || u.username }
}

export async function requireUser() {
  const s = await getSession()
  if (!s) redirect('/admin/login')
  return s
}

export async function requireOwner() {
  const s = await requireUser()
  if (s.role !== 'OWNER') redirect('/admin?e=akses')
  return s
}

export const canEditBranch = (s: Session, branchId: number) => s.role === 'OWNER' || s.branchId === branchId

// Pembatas percobaan login sederhana (per proses).
const attempts = new Map<string, { n: number; until: number }>()
export function loginBlocked(k: string) {
  const a = attempts.get(k)
  return !!a && a.n >= 5 && a.until > Date.now()
}
export function loginFailed(k: string) {
  const a = attempts.get(k)
  const n = a && a.until > Date.now() ? a.n + 1 : 1
  attempts.set(k, { n, until: Date.now() + 15 * 60 * 1000 })
}
export const loginOk = (k: string) => attempts.delete(k)
