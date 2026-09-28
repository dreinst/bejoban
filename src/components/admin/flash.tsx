'use client'
import { useSearchParams } from 'next/navigation'

export function Flash() {
  const sp = useSearchParams()
  const ok = sp.get('ok')
  const err = sp.get('err') || (sp.get('e') === 'akses' ? 'Akun Anda tidak punya akses ke halaman itu.' : '')
  if (!ok && !err) return null
  return <p className={`mb-5 rounded-lg px-4 py-3 text-sm font-semibold ${err ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}>{err || `✓ ${ok}`}</p>
}
