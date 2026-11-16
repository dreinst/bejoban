'use client'
import { useState } from 'react'
import { renderTemplate } from '@/lib/text/template'
import { CHANNELS, CHANNEL_LABEL, type Sosmed } from '@/lib/bot/templates'
import { CopyButton } from './copy-button'

const area = 'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-ink'

// Templat balasan otomatis per kanal sosmed. Admin menyalinnya ke fitur balasan otomatis tiap aplikasi.
export function SosmedEditor({ initial, tautanWa }: { initial: Sosmed; tautanWa: string }) {
  const [v, setV] = useState(initial)
  return (
    <div className="space-y-5">
      {CHANNELS.map((c) => {
        const text = renderTemplate(v[c], { tautanWa })
        return (
          <div key={c} className="grid gap-3 md:grid-cols-2">
            <label className="block text-xs font-semibold text-neutral-700">
              {CHANNEL_LABEL[c]}
              <textarea name={`sosmed_${c}`} rows={5} maxLength={1000} value={v[c]} onChange={(e) => setV({ ...v, [c]: e.target.value })} className={`${area} mt-1`} />
              <span className="mt-1 block font-normal text-neutral-500">Variabel: {'{tautanWa}'} (tautan WhatsApp tiap cabang)</span>
            </label>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-neutral-700">Pratinjau yang disalin</p>
              <pre className="whitespace-pre-wrap break-all rounded-lg bg-neutral-100 px-3 py-2 font-sans text-sm text-neutral-800">{text}</pre>
              <CopyButton text={text} label={`Salin untuk ${CHANNEL_LABEL[c]}`} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
