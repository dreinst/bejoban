'use client'
import { useState } from 'react'
import { renderTemplate } from '@/lib/text/template'
import { SAMPLE_VARS, namaVariabel } from '@/lib/bot/templates'
import { TextAreaField } from './field'
import { CloseButton, SubmitButton } from './overlay'

type Aksi = (fd: FormData) => void | Promise<void>

// Form satu templat di dalam panel samping: satu kolom isian, pratinjau langsung dengan contoh isi,
// Simpan, dan "Kembalikan templat ini ke bawaan" (aksi lain pada form yang sama, tanpa validasi).
export function TemplateForm({
  kunci,
  nilai,
  when,
  vars,
  simpan,
  kembalikan,
}: {
  kunci: string
  nilai: string
  when: string
  vars: string[]
  simpan: Aksi
  kembalikan: Aksi
}) {
  const [v, setV] = useState(nilai)

  // Sisipkan {variabel} di posisi kursor, supaya admin tidak perlu mengetik kurung kurawal.
  const sisip = (nama: string) => {
    const el = document.getElementById('f-value') as HTMLTextAreaElement | null
    const tok = `{${nama}}`
    if (!el) return setV((x) => x + tok)
    const a = el.selectionStart
    const b = el.selectionEnd
    const baru = v.slice(0, a) + tok + v.slice(b)
    setV(baru)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(a + tok.length, a + tok.length)
    })
  }

  return (
    <form action={simpan} className="space-y-4">
      <input type="hidden" name="key" value={kunci} />
      <p className="text-sm text-mute">{when}</p>
      <TextAreaField label="Isi templat" name="value" required rows={8} maxLength={1000} value={v} onChange={(e) => setV(e.target.value)} />
      {vars.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-neutral-700" id={`var-${kunci}`}>Isi otomatis yang bisa disisipkan</p>
          <div role="group" aria-labelledby={`var-${kunci}`} className="flex flex-wrap gap-2">
            {vars.map((x) => (
              <button key={x} type="button" onClick={() => sisip(x)} className="adm-btn-line adm-btn-sm" aria-label={`Sisipkan ${namaVariabel(x)}`}>
                + {namaVariabel(x)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="mb-1 text-xs font-semibold text-neutral-700">Pratinjau dengan contoh isi</p>
        <pre aria-live="polite" className="min-h-[5rem] whitespace-pre-wrap break-words rounded-lg bg-soft px-3 py-2 font-sans text-sm text-ink">{renderTemplate(v, SAMPLE_VARS)}</pre>
      </div>
      <div className="adm-form-actions mt-5 flex flex-wrap items-center justify-end gap-2">
        <button type="submit" formAction={kembalikan} formNoValidate className="adm-btn-ghost mr-auto">Kembalikan templat ini ke bawaan</button>
        <CloseButton />
        <SubmitButton>Simpan templat</SubmitButton>
      </div>
    </form>
  )
}
