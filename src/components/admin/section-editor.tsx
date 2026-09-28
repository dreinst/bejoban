'use client'
import { useState } from 'react'
import type { Field } from '@/lib/content'
import { ImagesInput } from './image-input'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Obj = Record<string, any>
type Opt = { id: number; name: string }

export const inputCls = 'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-ink'

function Fields({ fields, value, set, products }: { fields: Field[]; value: Obj; set: (v: Obj) => void; products: Opt[] }) {
  return (
    <div className="space-y-4">
      {fields.map((f) => {
        const v = value[f.key]
        const put = (x: unknown) => set({ ...value, [f.key]: x })
        return (
          <div key={f.key}>
            <label className="mb-1 block text-sm font-semibold text-neutral-800">{f.label}</label>
            {f.type === 'text' && <input className={inputCls} value={v ?? ''} onChange={(e) => put(e.target.value)} />}
            {f.type === 'textarea' && <textarea className={inputCls} rows={3} value={v ?? ''} onChange={(e) => put(e.target.value)} />}
            {f.type === 'datetime' && <input type="datetime-local" className={inputCls} value={v ?? ''} onChange={(e) => put(e.target.value)} />}
            {'hint' in f && f.hint && <p className="mt-1 text-[11px] text-neutral-500">{f.hint}</p>}
            {f.type === 'image' && <ImagesInput value={v ? [v] : []} onChange={(l) => put(l[0] ?? '')} preset={f.preset} max={1} />}
            {f.type === 'images' && <ImagesInput value={v ?? []} onChange={put} preset={f.preset} max={f.max} />}
            {f.type === 'products' && (
              <div className="space-y-2">
                {Array.from({ length: f.max }).map((_, i) => (
                  <select
                    key={i}
                    className={inputCls}
                    value={(v ?? [])[i] ?? ''}
                    onChange={(e) => {
                      const n = [...(v ?? [])]
                      n[i] = Number(e.target.value)
                      put(n.filter(Boolean))
                    }}
                  >
                    <option value="">(kosong)</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                ))}
              </div>
            )}
            {f.type === 'list' && (
              <div className="space-y-3">
                {(v ?? []).map((item: Obj, i: number) => (
                  <div key={i} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="mb-3 flex items-center justify-between text-xs font-bold text-neutral-500">
                      <span>#{i + 1}</span>
                      <span className="flex gap-3">
                        {i > 0 && <button type="button" onClick={() => { const n = [...v]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; put(n) }}>▲ Naik</button>}
                        <button type="button" className="text-red-600" onClick={() => put(v.filter((_: Obj, j: number) => j !== i))}>Hapus</button>
                      </span>
                    </div>
                    <Fields fields={f.fields} value={item} set={(x) => put(v.map((y: Obj, j: number) => (j === i ? x : y)))} products={products} />
                  </div>
                ))}
                {(v ?? []).length < f.max && (
                  <button type="button" onClick={() => put([...(v ?? []), {}])} className="rounded-lg border-2 border-dashed border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-600">
                    + Tambah
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function SectionEditor({ sectionKey, fields, initial, products, action }: { sectionKey: string; fields: Field[]; initial: Obj; products: Opt[]; action: (fd: FormData) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="key" value={sectionKey} />
      <input type="hidden" name="value" value={JSON.stringify(value)} />
      <Fields fields={fields} value={value} set={setValue} products={products} />
      <button className="rounded-lg bg-ink px-6 py-3 text-sm font-bold text-white">Simpan</button>
    </form>
  )
}
