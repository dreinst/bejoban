'use client'
import { useId, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { Field } from '@/lib/content'
import { ImagesInput } from './image-input'
import { inputCls } from './form-cls'
import { FormActions, TextAreaField, TextField } from './field'
import { SubmitButton } from './overlay'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Obj = Record<string, any>
type Opt = { id: number; name: string }

// `base` + `path` membentuk id unik tiap kolom, karena item daftar memakai kunci yang sama (judul, keterangan, dst).
function Fields({ fields, value, set, products, base, path }: { fields: Field[]; value: Obj; set: (v: Obj) => void; products: Opt[]; base: string; path: string }) {
  return (
    <div className="space-y-4">
      {fields.map((f) => {
        const v = value[f.key]
        const put = (x: unknown) => set({ ...value, [f.key]: x })
        const id = `${base}-${path}${f.key}`
        if (f.type === 'text') return <TextField key={f.key} id={id} label={f.label} hint={f.hint} value={v ?? ''} onChange={(e) => put(e.target.value)} />
        if (f.type === 'textarea') return <TextAreaField key={f.key} id={id} label={f.label} rows={3} value={v ?? ''} onChange={(e) => put(e.target.value)} />
        if (f.type === 'datetime') return <TextField key={f.key} id={id} type="datetime-local" label={f.label} hint={f.hint} value={v ?? ''} onChange={(e) => put(e.target.value)} />
        return (
          <fieldset key={f.key} className="min-w-0">
            <legend className="mb-1 block text-xs font-semibold text-neutral-700">{f.label}</legend>
            {f.type === 'image' && <ImagesInput value={v ? [v] : []} onChange={(l) => put(l[0] ?? '')} preset={f.preset} max={1} />}
            {f.type === 'images' && <ImagesInput value={v ?? []} onChange={put} preset={f.preset} max={f.max} />}
            {f.type === 'products' && (
              <div className="space-y-2">
                {Array.from({ length: f.max }).map((_, i) => (
                  <select
                    key={i}
                    aria-label={`${f.label}, pilihan ${i + 1}`}
                    className={`${inputCls} min-h-10`}
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
                {(v ?? []).map((item: Obj, i: number) => {
                  const geser = (a: number, b: number) => { const n = [...v]; [n[a], n[b]] = [n[b], n[a]]; put(n) }
                  const nama = `item ${i + 1}`
                  return (
                    <div key={i} className="rounded-[10px] border border-line bg-soft/60 p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-neutral-600">Item {i + 1}</span>
                        <span className="flex items-center gap-1.5">
                          <button type="button" className="adm-icon-btn" aria-label={`Naikkan ${nama}, ${f.label}`} disabled={i === 0} onClick={() => geser(i - 1, i)}>
                            <ArrowUp className="size-4" aria-hidden />
                          </button>
                          <button type="button" className="adm-icon-btn" aria-label={`Turunkan ${nama}, ${f.label}`} disabled={i === v.length - 1} onClick={() => geser(i, i + 1)}>
                            <ArrowDown className="size-4" aria-hidden />
                          </button>
                          <button type="button" className="adm-btn-ghost adm-btn-sm" aria-label={`Hapus ${nama}, ${f.label}`} onClick={() => put(v.filter((_: Obj, j: number) => j !== i))}>
                            Hapus
                          </button>
                        </span>
                      </div>
                      <Fields fields={f.fields} value={item} set={(x) => put(v.map((y: Obj, j: number) => (j === i ? x : y)))} products={products} base={base} path={`${path}${f.key}-${i}-`} />
                    </div>
                  )
                })}
                {(v ?? []).length < f.max && (
                  <button type="button" onClick={() => put([...(v ?? []), {}])} className="adm-btn-line adm-btn-sm !border-dashed">
                    + Tambah item
                  </button>
                )}
              </div>
            )}
          </fieldset>
        )
      })}
    </div>
  )
}

export function SectionEditor({ sectionKey, fields, initial, products, action }: { sectionKey: string; fields: Field[]; initial: Obj; products: Opt[]; action: (fd: FormData) => void }) {
  const [value, setValue] = useState(initial)
  const base = useId().replace(/:/g, '')
  return (
    <form action={action}>
      <input type="hidden" name="key" value={sectionKey} />
      <input type="hidden" name="value" value={JSON.stringify(value)} />
      <Fields fields={fields} value={value} set={setValue} products={products} base={`e${base}`} path="" />
      <FormActions><SubmitButton>Simpan</SubmitButton></FormActions>
    </form>
  )
}
