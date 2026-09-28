'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type CartItem = { id: number; slug: string; name: string; image: string; price: number; qty: number; branch: string }
type Ctx = { items: CartItem[]; add: (i: Omit<CartItem, 'qty'>, qty?: number) => void; setQty: (id: number, branch: string, qty: number) => void; clear: (branch: string) => void }

const CartCtx = createContext<Ctx | null>(null)
const KEY = 'bejo_cart'

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(JSON.parse(localStorage.getItem(KEY) || '[]'))
    } catch {}
  }, [])
  const save = (next: CartItem[]) => {
    setItems(next)
    localStorage.setItem(KEY, JSON.stringify(next))
  }
  const add: Ctx['add'] = (i, qty = 1) => {
    const found = items.find((x) => x.id === i.id && x.branch === i.branch)
    save(found ? items.map((x) => (x === found ? { ...x, qty: x.qty + qty } : x)) : [...items, { ...i, qty }])
  }
  const setQty: Ctx['setQty'] = (id, branch, qty) =>
    save(qty < 1 ? items.filter((x) => !(x.id === id && x.branch === branch)) : items.map((x) => (x.id === id && x.branch === branch ? { ...x, qty } : x)))
  const clear = (branch: string) => save(items.filter((x) => x.branch !== branch))
  return <CartCtx.Provider value={{ items, add, setQty, clear }}>{children}</CartCtx.Provider>
}

export const useCart = () => useContext(CartCtx)!

export function CartCount() {
  const n = useCart().items.reduce((s, i) => s + i.qty, 0)
  return n ? <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-[10px] font-bold text-paper">{n}</span> : null
}

export function AddToCart({ item, compact, dark, qty = 1 }: { item: Omit<CartItem, 'qty'>; compact?: boolean; dark?: boolean; qty?: number }) {
  const { add } = useCart()
  const [done, setDone] = useState(false)
  const click = () => {
    add(item, qty)
    setDone(true)
    setTimeout(() => setDone(false), 1500)
  }
  return (
    <button onClick={click} className={`font-semibold ${dark ? 'bg-paper text-ink hover:bg-paper/85' : 'bg-ink text-paper hover:bg-ink/85'} ${compact ? 'h-10 w-full rounded-full text-xs' : 'h-12 w-full rounded-full text-sm'}`}>
      {done ? '✓ Masuk keranjang' : 'Tambah ke keranjang'}
    </button>
  )
}
