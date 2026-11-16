'use client'
import { useState } from 'react'
import { renderTemplate } from '@/lib/text/template'
import { SAMPLE_VARS, TEMPLATE_INFO, TEMPLATE_KEYS, type Templates } from '@/lib/bot/templates'

const area = 'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-ink'

// Editor templat dengan pratinjau langsung memakai contoh isi variabel.
export function TemplateEditor({ initial }: { initial: Templates }) {
  const [v, setV] = useState(initial)
  return (
    <div className="space-y-5">
      {TEMPLATE_KEYS.map((k) => {
        const info = TEMPLATE_INFO[k]
        return (
          <div key={k} className="grid gap-3 md:grid-cols-2">
            <label className="block text-xs font-semibold text-neutral-700">
              {info.label}
              <span className="mb-1 block font-normal text-neutral-500">{info.when}</span>
              <textarea name={`tpl_${k}`} rows={5} maxLength={1000} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className={area} />
              <span className="mt-1 block font-normal text-neutral-500">Variabel: {info.vars.map((x) => `{${x}}`).join(' ')}</span>
            </label>
            <div>
              <p className="mb-1 text-xs font-semibold text-neutral-700">Pratinjau</p>
              <pre className="min-h-[7rem] whitespace-pre-wrap rounded-lg bg-neutral-100 px-3 py-2 font-sans text-sm text-neutral-800">{renderTemplate(v[k], SAMPLE_VARS)}</pre>
            </div>
          </div>
        )
      })}
    </div>
  )
}
