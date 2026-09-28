'use client'
import { useState } from 'react'
import Link from 'next/link'
import { AddToCart, type CartItem } from './cart'

export function QtyAdd({ item }: { item: Omit<CartItem, 'qty'> }) {
  const [qty, setQty] = useState(4)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-ink">Jumlah</span>
        <div className="flex items-center rounded-full border border-line">
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="size-10 text-lg text-ink" aria-label="Kurangi">−</button>
          <span className="w-10 text-center font-semibold text-ink">{qty}</span>
          <button onClick={() => setQty(qty + 1)} className="size-10 text-lg text-ink" aria-label="Tambah">+</button>
        </div>
      </div>
      <AddToCart item={item} qty={qty} />
      <Link href="/keranjang" className="block py-2 text-center text-sm font-medium underline underline-offset-4">Lihat Keranjang</Link>
    </div>
  )
}
