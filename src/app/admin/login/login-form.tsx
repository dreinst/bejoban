'use client'
import { useActionState } from 'react'
import { login } from '../actions'

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null)
  const f = 'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-ink'
  return (
    <form action={action} className="space-y-3">
      <input name="username" placeholder="Username" autoComplete="username" required className={f} />
      <input name="password" type="password" placeholder="Password" autoComplete="current-password" required className={f} />
      {state?.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-ink py-3 font-bold text-paper">{pending ? 'Memeriksa…' : 'Masuk'}</button>
    </form>
  )
}
