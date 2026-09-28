import { TireCalc } from './tire-calc'

export const metadata = { title: 'Kalkulator Ban | Bejo Ban' }

export default function Page() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
      <h1 className="text-4xl font-black uppercase tracking-tight md:text-6xl">Kalkulator Ban</h1>
      <p className="mt-2 text-mute">Bandingkan ukuran ban lama dan baru sebelum ganti.</p>
      <TireCalc />
    </div>
  )
}
