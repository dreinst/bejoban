'use client'
import { useState } from 'react'
import { toast } from './toast-bus'

// Alamat http biasa (bukan https atau localhost) tidak punya navigator.clipboard, jadi ada jalan cadangan.
async function salin(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    try {
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      el.remove()
    }
  }
}

/** Tombol salin teks. `pesan` memunculkan toast setelah tersalin; `className` mengganti ukuran tombol (mis. di baris tabel). */
export function CopyButton({ text, label = 'Salin ringkasan untuk WhatsApp', pesan, className = 'adm-btn-line', ariaLabel }: { text: string; label?: string; pesan?: string; className?: string; ariaLabel?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={async () => {
        if (!(await salin(text))) return toast('Teks tidak bisa disalin otomatis. Buka Ubah lalu salin dari pratinjau.', 'err')
        setDone(true)
        if (pesan) toast(pesan)
        setTimeout(() => setDone(false), 2000)
      }}
      className={className}
    >
      {done ? 'Tersalin' : label}
    </button>
  )
}
