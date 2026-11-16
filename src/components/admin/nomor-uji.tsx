'use client'
import { useState } from 'react'
import { CheckField, TextAreaField } from './field'

/** "Hanya membalas nomor uji" dan daftar nomornya. Memberi peringatan langsung kalau pilihan menyala tetapi daftarnya kosong. */
export function NomorUji({ restrict, nomor }: { restrict: boolean; nomor: string[] }) {
  const [nyala, setNyala] = useState(restrict)
  const [teks, setTeks] = useState(nomor.join('\n'))
  const kosong = !teks.trim()
  return (
    <>
      <CheckField
        className="sm:col-span-3"
        label="Hanya membalas nomor uji"
        name="restrictNumbers"
        checked={nyala}
        onChange={(e) => setNyala(e.target.checked)}
        hint="Bot hanya menjawab nomor di daftar bawah. Matikan kalau sudah siap melayani pelanggan."
      />
      <TextAreaField className="sm:col-span-3" label="Nomor uji" hint="Satu nomor per baris." name="testNumbers" rows={3} value={teks} onChange={(e) => setTeks(e.target.value)} />
      {nyala && kosong && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 sm:col-span-3">
          Bot akan diam ke semua orang. &quot;Hanya membalas nomor uji&quot; menyala, tetapi daftar nomor uji kosong. Isi nomor uji, atau matikan pilihan itu.
        </p>
      )}
    </>
  )
}
