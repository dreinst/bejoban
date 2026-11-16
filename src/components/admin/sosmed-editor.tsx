'use client'
import { useState } from 'react'
import { renderTemplate } from '@/lib/text/template'
import { CHANNELS, CHANNEL_LABEL, type Sosmed } from '@/lib/bot/templates'
import { TextAreaField } from './field'
import { CopyButton } from './copy-button'

// Templat balasan otomatis per kanal sosmed. Admin menyalinnya ke fitur balasan otomatis tiap aplikasi.
export function SosmedEditor({ initial, tautanWa }: { initial: Sosmed; tautanWa: string }) {
  const [v, setV] = useState(initial)
  return (
    <div className="space-y-5">
      {CHANNELS.map((c) => {
        const text = renderTemplate(v[c], { tautanWa })
        return (
          <div key={c} className="grid gap-4 md:grid-cols-2">
            <TextAreaField
              label={CHANNEL_LABEL[c]}
              hint={<>Variabel: {'{tautanWa}'} (tautan WhatsApp tiap cabang)</>}
              name={`sosmed_${c}`}
              rows={5}
              maxLength={1000}
              value={v[c]}
              onChange={(e) => setV({ ...v, [c]: e.target.value })}
            />
            <div className="space-y-2">
              <p className="text-xs font-semibold text-neutral-700">Pratinjau yang disalin</p>
              <pre className="whitespace-pre-wrap break-all rounded-lg bg-soft px-3 py-2 font-sans text-sm text-ink">{text}</pre>
              <CopyButton text={text} label={`Salin untuk ${CHANNEL_LABEL[c]}`} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
