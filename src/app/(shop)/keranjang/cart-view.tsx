'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useCart } from '@/components/cart'
import { rupiah, waLink } from '@/lib/format'

type B = { slug: string; name: string; whatsapp: string }

/* eslint-disable @next/next/no-img-element */
export function CartView({ branches }: { branches: B[] }) {
  const { items, setQty, clear } = useCart()
  const [form, setForm] = useState({ nama: '', mobil: '', datang: '', catatan: '' })
  const groups = branches.map((b) => ({ b, list: items.filter((i) => i.branch === b.slug) })).filter((g) => g.list.length)

  const checkout = (b: B, list: typeof items) => {
    const lines = list.map((i) => `• ${i.name} x${i.qty} = ${rupiah(i.price * i.qty)}`)
    const total = list.reduce((s, i) => s + i.price * i.qty, 0)
    const msg = [
      `Halo ${b.name}, saya mau pesan:`,
      ...lines,
      `Total: ${rupiah(total)}`,
      '',
      form.nama ? `Nama: ${form.nama}` : null,
      form.mobil ? `Mobil: ${form.mobil}` : null,
      form.datang ? `Rencana datang: ${form.datang}` : null,
      form.catatan ? `Catatan: ${form.catatan}` : null,
      '',
      'Mohon konfirmasi stok dan harganya. Terima kasih.',
    ].filter((x) => x !== null).join('\n')
    window.open(waLink(b.whatsapp, msg), '_blank')
  }

  if (!groups.length)
    return (
      <div className="px-4 py-20 text-center">
        <p className="text-lg font-semibold text-ink">Keranjang masih kosong</p>
        <Link href="/produk" className="mt-5 inline-block rounded-full bg-ink px-6 py-3 font-semibold text-paper">Belanja Sekarang</Link>
      </div>
    )

  const input = 'w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-ink'
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[1fr_380px] lg:px-8">
      <div className="space-y-5">
        {groups.map(({ b, list }) => (
          <section key={b.slug} className="rounded-3xl border border-line p-6">
            <h2 className="mb-4 font-bold text-ink">{b.name}</h2>
            {list.map((i) => (
              <div key={i.id} className="flex items-center gap-4 border-t border-line py-4">
                <img src={i.image} alt="" className="size-16 rounded-lg object-cover" />
                <div className="flex-1">
                  <Link href={`/produk/${i.slug}`} className="text-sm font-semibold text-ink">{i.name}</Link>
                  <p className="text-sm text-ink">{rupiah(i.price)}</p>
                </div>
                <div className="flex items-center rounded-lg border border-line">
                  <button onClick={() => setQty(i.id, b.slug, i.qty - 1)} className="size-9 text-ink" aria-label="Kurangi">−</button>
                  <span className="w-8 text-center text-sm font-semibold text-ink">{i.qty}</span>
                  <button onClick={() => setQty(i.id, b.slug, i.qty + 1)} className="size-9 text-ink" aria-label="Tambah">+</button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <button onClick={() => clear(b.slug)} className="text-xs text-mute underline">Kosongkan</button>
              <p className="font-bold text-ink">Total {rupiah(list.reduce((s, i) => s + i.price * i.qty, 0))}</p>
              <button onClick={() => checkout(b, list)} className="w-full rounded-full bg-ink py-3 text-sm font-semibold text-paper sm:w-auto sm:px-6">
                Pesan via WhatsApp {b.name.replace(/ \(.*\)/, '')}
              </button>
            </div>
          </section>
        ))}
      </div>
      <aside className="h-fit space-y-3 rounded-3xl bg-soft p-6">
        <h2 className="font-bold text-ink">Data Pemesan (opsional)</h2>
        <p className="text-xs text-mute">Ikut terkirim di pesan WhatsApp supaya admin cabang bisa langsung menyiapkan.</p>
        <input className={input} placeholder="Nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
        <input className={input} placeholder="Mobil (misal Innova 2015)" value={form.mobil} onChange={(e) => setForm({ ...form, mobil: e.target.value })} />
        <input className={input} placeholder="Rencana datang (misal Sabtu pagi)" value={form.datang} onChange={(e) => setForm({ ...form, datang: e.target.value })} />
        <textarea className={input} rows={3} placeholder="Catatan" value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} />
        <p className="text-xs text-mute">Pembayaran online menyusul. Saat ini pembayaran dikonfirmasi admin lewat WhatsApp.</p>
      </aside>
    </div>
  )
}
