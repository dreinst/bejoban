'use client'
import { useState } from 'react'

export function CopyButton({ text, label = 'Salin ringkasan untuk WhatsApp' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setDone(true)
        setTimeout(() => setDone(false), 2000)
      }}
      className="rounded-lg border border-ink px-4 py-2 text-sm font-semibold text-ink hover:bg-ink hover:text-white"
    >
      {done ? 'Tersalin' : label}
    </button>
  )
}
