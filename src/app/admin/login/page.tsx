import { LoginForm } from './login-form'

/* eslint-disable @next/next/no-img-element */
export const metadata = { title: 'Login Admin | Bejo Ban' }

export default function Login() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink p-4">
      <div className="w-full max-w-sm">
        <img src="/logo-bejoban-putih.svg" alt="Bejo Ban" className="mx-auto h-12 w-auto" />
        <div className="card-l mt-8 p-7">
          <h1 className="font-display text-xl font-extrabold text-ink">Masuk admin</h1>
          <p className="mb-6 mt-1 text-sm text-mute">Atur produk, stok, harga, dan tampilan situs.</p>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
