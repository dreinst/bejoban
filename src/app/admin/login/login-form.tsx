'use client'
import { useActionState } from 'react'
import { login } from '../actions'

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null)
  const f = 'w-full rounded-lg border border-[#cfcfcf] bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10'
  return (
    <form action={action} className="space-y-3">
      <input name="username" placeholder="Username" aria-label="Username" autoComplete="username" required className={f} />
      <input name="password" type="password" placeholder="Password" aria-label="Password" autoComplete="current-password" required className={f} />
      {state?.error && <p role="alert" className="text-sm font-semibold text-red-600">{state.error}</p>}
      <button disabled={pending} className="adm-btn adm-btn-lg w-full">{pending ? 'Memeriksa...' : 'Masuk'}</button>
    </form>
  )
}
