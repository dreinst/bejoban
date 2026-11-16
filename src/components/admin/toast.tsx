'use client'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, CircleAlert, X } from 'lucide-react'
import { TOAST_EVENT, type ToastKind } from './toast-bus'

type Item = { id: number; msg: string; kind: ToastKind }
const AKSES = 'Akun kamu tidak punya akses ke halaman itu.'
let seq = 0

// Pesan singkat setelah simpan. Sumbernya ?ok= dan ?err= di alamat (dari redirect aksi server) atau toast() di toast-bus.
// Setelah dibaca, ?ok dan ?err dihapus dari alamat supaya pesan yang sama bisa muncul lagi pada simpan berikutnya.
// Pesan berhasil hilang sendiri setelah 4 detik (berhenti selama disorot); pesan galat tetap sampai ditutup.
export function Toast() {
  const sp = useSearchParams()
  const ok = sp.get('ok')
  const err = sp.get('err') || (sp.get('e') === 'akses' ? AKSES : null)
  const [items, setItems] = useState<Item[]>([])
  const kunci = `${ok ?? ''}\u0000${err ?? ''}`
  const [lalu, setLalu] = useState('\u0000')
  if (kunci !== lalu) {
    setLalu(kunci)
    if (ok || err) setItems((l) => [...l.slice(-2), { id: ++seq, msg: (err || ok)!, kind: err ? 'err' : 'ok' }])
  }

  useEffect(() => {
    if (!ok && !err) return
    const u = new URL(window.location.href)
    for (const k of ['ok', 'err', 'e']) u.searchParams.delete(k)
    window.history.replaceState(null, '', `${u.pathname}${u.search}${u.hash}`)
  }, [ok, err])

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ msg: string; kind: ToastKind }>).detail
      setItems((l) => [...l.slice(-2), { id: ++seq, msg: d.msg, kind: d.kind }])
    }
    window.addEventListener(TOAST_EVENT, on)
    return () => window.removeEventListener(TOAST_EVENT, on)
  }, [])

  const tutup = useCallback((id: number) => setItems((l) => l.filter((x) => x.id !== id)), [])
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 md:inset-x-auto md:right-6 md:bottom-6 md:items-end">
      <div role="status" aria-live="polite" className="flex w-full flex-col items-center gap-2 md:items-end">
        {items.filter((x) => x.kind === 'ok').map((x) => <Pesan key={x.id} item={x} tutup={tutup} />)}
      </div>
      <div role="alert" aria-live="assertive" className="flex w-full flex-col items-center gap-2 md:items-end">
        {items.filter((x) => x.kind === 'err').map((x) => <Pesan key={x.id} item={x} tutup={tutup} />)}
      </div>
    </div>
  )
}

function Pesan({ item, tutup }: { item: Item; tutup: (id: number) => void }) {
  const [tahan, setTahan] = useState(false)
  useEffect(() => {
    if (item.kind === 'err' || tahan) return
    const t = setTimeout(() => tutup(item.id), 4000)
    return () => clearTimeout(t)
  }, [item, tahan, tutup])
  const err = item.kind === 'err'
  return (
    <div
      onMouseEnter={() => setTahan(true)}
      onMouseLeave={() => setTahan(false)}
      onFocus={() => setTahan(true)}
      onBlur={() => setTahan(false)}
      className={`adm-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[10px] px-4 py-3 text-sm shadow-lg md:w-96 ${err ? 'border border-red-200 bg-red-50 text-red-800' : 'bg-ink text-white'}`}
    >
      {err ? <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Check className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <p className="min-w-0 flex-1 font-semibold">{item.msg}</p>
      <button type="button" onClick={() => tutup(item.id)} aria-label="Tutup pesan" className="-my-2 -mr-2 grid size-10 shrink-0 place-items-center rounded-md hover:bg-black/10">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}
