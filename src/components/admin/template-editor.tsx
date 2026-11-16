'use client'
import { useState } from 'react'
import { renderTemplate } from '@/lib/text/template'
import { SAMPLE_VARS, TEMPLATE_INFO, TEMPLATE_KEYS, type Templates } from '@/lib/bot/templates'
import { TextAreaField } from './field'

// Editor templat dengan pratinjau langsung memakai contoh isi variabel.
// Nama kolom yang dikirim tetap tpl_<kunci>.
export function TemplateEditor({ initial }: { initial: Templates }) {
  const [v, setV] = useState(initial)
  return (
    <div className="space-y-6">
      {TEMPLATE_KEYS.map((k) => {
        const info = TEMPLATE_INFO[k]
        return (
          <div key={k} className="grid gap-4 border-b border-line pb-6 last:border-b-0 last:pb-0 md:grid-cols-2">
            <TextAreaField
              label={info.label}
              name={`tpl_${k}`}
              rows={5}
              maxLength={1000}
              value={v[k]}
              onChange={(e) => setV({ ...v, [k]: e.target.value })}
              hint={
                <>
                  {info.when}
                  <span className="mt-0.5 block">Variabel: {info.vars.map((x) => `{${x}}`).join(' ')}</span>
                </>
              }
            />
            <div>
              <p className="mb-1 text-xs font-semibold text-neutral-700">Pratinjau</p>
              <pre className="min-h-[7rem] whitespace-pre-wrap rounded-lg bg-soft px-3 py-2 font-sans text-sm text-ink">{renderTemplate(v[k], SAMPLE_VARS)}</pre>
            </div>
          </div>
        )
      })}
    </div>
  )
}
