import { LoginForm } from './login-form'

export const metadata = { title: 'Login Admin | Bejo Ban' }

export default function Login() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8">
        <h1 className="text-xl font-black text-ink">Admin Bejo Ban</h1>
        <p className="mb-6 text-sm text-neutral-500">Masuk untuk mengatur produk, harga dan tampilan web.</p>
        <LoginForm />
      </div>
    </div>
  )
}
