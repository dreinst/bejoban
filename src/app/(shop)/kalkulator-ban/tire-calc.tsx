'use client'
import Link from 'next/link'
import { useState } from 'react'

type Size = { w: number; a: number; r: number }
const calc = ({ w, a, r }: Size) => {
  const side = (w * a) / 100
  const dia = side * 2 + r * 25.4
  return { side, dia, circ: Math.PI * dia }
}

function SizeInput({ label, v, set }: { label: string; v: Size; set: (s: Size) => void }) {
  const f = 'w-full rounded-lg border border-line px-3 py-2.5 text-ink'
  return (
    <div className="rounded-3xl border border-line p-6">
      <p className="mb-3 font-bold text-ink">{label}</p>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <label>Lebar (mm)<input type="number" className={f} value={v.w} onChange={(e) => set({ ...v, w: +e.target.value })} /></label>
        <label>Profil (%)<input type="number" className={f} value={v.a} onChange={(e) => set({ ...v, a: +e.target.value })} /></label>
        <label>Ring (inci)<input type="number" className={f} value={v.r} onChange={(e) => set({ ...v, r: +e.target.value })} /></label>
      </div>
      <p className="mt-3 text-sm text-ink">{v.w}/{v.a} R{v.r}</p>
    </div>
  )
}

export function TireCalc() {
  const [a, setA] = useState<Size>({ w: 185, a: 65, r: 15 })
  const [b, setB] = useState<Size>({ w: 195, a: 60, r: 16 })
  const A = calc(a)
  const B = calc(b)
  const diff = ((B.dia - A.dia) / A.dia) * 100
  const row = (l: string, x: number, y: number, u = 'mm') => (
    <tr className="border-t border-line">
      <td className="py-2">{l}</td>
      <td className="py-2 text-right">{x.toFixed(1)} {u}</td>
      <td className="py-2 text-right">{y.toFixed(1)} {u}</td>
      <td className="py-2 text-right font-semibold">{(y - x > 0 ? '+' : '') + (y - x).toFixed(1)}</td>
    </tr>
  )
  return (
    <div className="mt-10 max-w-3xl space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <SizeInput label="Ukuran sekarang" v={a} set={setA} />
        <SizeInput label="Ukuran baru" v={b} set={setB} />
      </div>
      <div className="rounded-3xl border border-line p-6 text-sm text-ink">
        <table className="w-full">
          <thead className="text-xs text-mute"><tr><th className="text-left">Ukuran</th><th className="text-right">Sekarang</th><th className="text-right">Baru</th><th className="text-right">Selisih</th></tr></thead>
          <tbody>
            {row('Tinggi dinding ban', A.side, B.side)}
            {row('Diameter total', A.dia, B.dia)}
            {row('Keliling', A.circ, B.circ)}
          </tbody>
        </table>
        <p className={`mt-4 rounded-lg p-3 font-semibold ${Math.abs(diff) <= 3 ? 'bg-soft text-ink ring-1 ring-ink' : 'bg-ink text-paper'}`}>
          Selisih diameter {diff.toFixed(1)}%. {Math.abs(diff) <= 3 ? 'Masih aman (di bawah 3%).' : 'Lebih dari 3%, sebaiknya konsultasikan dulu.'} Saat speedometer 100 km/jam, kecepatan sebenarnya sekitar {(100 * (B.dia / A.dia)).toFixed(0)} km/jam.
        </p>
        <Link href={`/produk?q=${b.w}/${b.a}`} className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 font-semibold text-paper">Cari ban {b.w}/{b.a} R{b.r}</Link>
      </div>
    </div>
  )
}
