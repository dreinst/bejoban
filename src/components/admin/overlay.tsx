'use client'
import { createContext, useContext, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { X } from 'lucide-react'

// Panel samping (Drawer) dan dialog konfirmasi (ConfirmDialog) di atas elemen <dialog> modal:
// fokus terkunci di dalamnya, Escape atau klik di luar menutup, lalu fokus kembali ke tombol pemicu.
// Isi hanya dipasang saat terbuka, jadi tiap baris tabel boleh punya Drawer sendiri tanpa menggandakan form.
// Setelah aksi server berhasil (alamat mendapat ?ok=), panel yang terbuka menutup sendiri.
// Kalau aksi gagal (?err=), panel tetap terbuka dan galatnya tampil di dalam panel.

const Ctx = createContext<{ close: () => void } | null>(null)
const diam = () => () => {}
// true hanya di browser setelah hidrasi; portal tidak boleh dirender di server.
const useDiKlien = () => useSyncExternalStore(diam, () => true, () => false)

type Base = {
  trigger: ReactNode // isi tombol pemicu
  triggerClassName?: string
  triggerLabel?: string // aria-label tombol pemicu bila teksnya terlalu pendek (mis. "Ubah Hankook")
  title: string
  description?: ReactNode
  children: ReactNode
  /** Terbuka saat halaman dimuat, mis. tautan dari halaman lain yang langsung menuju form tambah. */
  defaultOpen?: boolean
}

function Overlay({ variant, trigger, triggerClassName, triggerLabel, title, description, children, defaultOpen = false }: Base & { variant: 'drawer' | 'modal' }) {
  const [open, setOpen] = useState(defaultOpen)
  const diKlien = useDiKlien()
  const [terkirim, setTerkirim] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const dlg = useRef<HTMLDialogElement>(null)
  const pernah = useRef(false)
  const titleId = useId()
  const descId = useId()
  const sp = useSearchParams()
  const ok = sp.get('ok')
  const err = sp.get('err')

  // Tutup sendiri saat aksi berhasil. Pola "simpan nilai sebelumnya" dari dokumentasi React, tanpa efek.
  const [okLalu, setOkLalu] = useState(ok)
  if (ok !== okLalu) {
    setOkLalu(ok)
    if (ok && open) {
      setOpen(false)
      setTerkirim(false)
    }
  }

  useEffect(() => {
    const d = dlg.current
    if (open && diKlien && d) {
      if (!d.open) d.showModal()
      const pertama = d.querySelector<HTMLElement>('[autofocus], [data-autofocus], input:not([type=hidden]):not([disabled]), select, textarea, [data-body] button, [data-body] a')
      ;(pertama ?? d.querySelector<HTMLElement>('[data-close]'))?.focus()
      pernah.current = true
    } else if (!open && pernah.current) {
      btn.current?.focus()
    }
  }, [open, diKlien])

  const close = () => {
    setOpen(false)
    setTerkirim(false)
  }
  const drawer = variant === 'drawer'
  return (
    <>
      <button ref={btn} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={triggerLabel} className={triggerClassName ?? 'adm-btn-line adm-btn-sm'}>
        {trigger}
      </button>
      {open &&
        diKlien &&
        createPortal(
          <dialog
            ref={dlg}
            data-variant={variant}
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            className="adm-overlay"
            onCancel={(e) => {
              e.preventDefault()
              close()
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) close()
            }}
            onSubmit={() => setTerkirim(true)}
          >
            <Ctx.Provider value={{ close }}>
              <div className={`flex flex-col ${drawer ? 'h-full' : 'max-h-[calc(100dvh-2rem)]'}`}>
                <header className={`flex items-start gap-3 border-b border-line ${drawer ? 'px-5 py-4' : 'px-5 pb-3 pt-5'}`}>
                  <div className="min-w-0 flex-1">
                    <h2 id={titleId} className="font-display text-lg font-extrabold leading-tight text-ink">{title}</h2>
                    {description && <div id={descId} className="mt-1 text-sm text-mute">{description}</div>}
                  </div>
                  <button type="button" data-close onClick={close} aria-label="Tutup" className="adm-icon-btn -mr-1 border-transparent">
                    <X className="size-5" aria-hidden />
                  </button>
                </header>
                <div data-body className="min-h-0 flex-1 overflow-y-auto p-5">
                  {terkirim && err && (
                    <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{err}</p>
                  )}
                  {children}
                </div>
              </div>
            </Ctx.Provider>
          </dialog>,
          document.body,
        )}
    </>
  )
}

/** Panel samping untuk form tambah dan ubah. Lebar form sekitar 640 px; di layar kecil penuh. */
export function Drawer(props: Base) {
  return <Overlay variant="drawer" {...props} />
}

/** Dialog kecil di tengah. Dipakai ConfirmDialog; boleh juga untuk isi pendek lain. */
export function Modal(props: Base) {
  return <Overlay variant="modal" {...props} />
}

/** Tombol "Batal" yang menutup panel atau dialog tempatnya berada. */
export function CloseButton({ children = 'Batal', className = 'adm-btn-line' }: { children?: ReactNode; className?: string }) {
  const ctx = useContext(Ctx)
  return (
    <button type="button" onClick={() => ctx?.close()} className={className}>
      {children}
    </button>
  )
}

/** Tombol kirim yang menonaktifkan diri selama aksi berjalan. */
export function SubmitButton({ children, pending = 'Menyimpan...', className = 'adm-btn', name, value }: { children: ReactNode; pending?: string; className?: string; name?: string; value?: string }) {
  const s = useFormStatus()
  return (
    <button type="submit" name={name} value={value} disabled={s.pending} aria-disabled={s.pending} className={className}>
      {s.pending ? pending : children}
    </button>
  )
}

type Aksi = (fd: FormData) => void | Promise<void>
type Pilihan = { action: Aksi; fields?: Record<string, string | number>; label: string }

const Tersembunyi = ({ fields }: { fields?: Record<string, string | number> }) =>
  Object.entries(fields ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)

/**
 * Dialog konfirmasi untuk hapus dan aksi berisiko. Sebut nama item dan akibatnya di `message`.
 * - `confirm`: aksi berbahaya (tombol merah). Kosongkan kalau item tidak boleh dihapus.
 * - `alternative`: aksi lain yang lebih aman, mis. Nonaktifkan untuk item yang masih dipakai.
 */
export function ConfirmDialog({
  trigger = 'Hapus',
  triggerLabel,
  triggerClassName,
  title,
  message,
  confirm,
  alternative,
}: {
  trigger?: ReactNode
  triggerLabel?: string
  triggerClassName?: string
  title: string
  message: ReactNode
  confirm?: Pilihan
  alternative?: Pilihan
}) {
  return (
    <Modal trigger={trigger} triggerLabel={triggerLabel} triggerClassName={triggerClassName} title={title}>
      <div className="space-y-2 text-sm text-ink">{message}</div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <CloseButton>{confirm || alternative ? 'Batal' : 'Tutup'}</CloseButton>
        {alternative && (
          <form action={alternative.action}>
            <Tersembunyi fields={alternative.fields} />
            <SubmitButton className={confirm ? 'adm-btn-line w-full' : 'adm-btn w-full'} pending="Memproses...">{alternative.label}</SubmitButton>
          </form>
        )}
        {confirm && (
          <form action={confirm.action}>
            <Tersembunyi fields={confirm.fields} />
            <SubmitButton className="adm-btn-danger w-full" pending="Memproses...">{confirm.label}</SubmitButton>
          </form>
        )}
      </div>
    </Modal>
  )
}
