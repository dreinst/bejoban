import { NextResponse, type NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth-edge'

export async function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === '/admin/login') return NextResponse.next()
  if (!(await verifyToken(req.cookies.get('bejo_session')?.value)))
    return NextResponse.redirect(new URL('/admin/login', req.url))
  return NextResponse.next()
}

export const config = { matcher: ['/admin', '/admin/((?!upload$).*)'] }
