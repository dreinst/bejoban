// Memunculkan toast dari komponen klien tanpa pindah halaman (mis. setelah sakelar by order disimpan).
// Berkas biasa, bukan 'use client', supaya bisa diimpor dari komponen klien mana pun.
export type ToastKind = 'ok' | 'err'
export const TOAST_EVENT = 'adm-toast'

export function toast(msg: string, kind: ToastKind = 'ok') {
  if (typeof window === 'undefined' || !msg) return
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { msg, kind } }))
}
