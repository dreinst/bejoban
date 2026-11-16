'use client'
import { useActionState } from 'react'
import { login } from '../actions'
import { FormGrid, TextField } from '@/components/admin/field'

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null)
  return (
    <form action={action}>
      <FormGrid cols={1}>
        <TextField label="Nama pengguna" name="username" autoComplete="username" required />
        <TextField label="Kata sandi" name="password" type="password" autoComplete="current-password" required />
      </FormGrid>
      {state?.error && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{state.error}</p>}
      <button disabled={pending} className="adm-btn adm-btn-lg mt-5 w-full min-h-11">{pending ? 'Memeriksa...' : 'Masuk'}</button>
    </form>
  )
}
