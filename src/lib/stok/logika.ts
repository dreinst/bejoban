// Logika murni perubahan stok: validasi tipe dan hitung saldo. Tidak menyentuh database.

// Tipe baris buku_stok. Lima pertama mengikuti ERD BejoStock, impor dan koreksi tambahan dari sini.
export const TIPE_BUKU_STOK = ['jual', 'masuk', 'opname', 'transfer', 'void', 'impor', 'koreksi'] as const
export type TipeBukuStok = (typeof TIPE_BUKU_STOK)[number]

export const isTipeBukuStok = (v: unknown): v is TipeBukuStok => typeof v === 'string' && (TIPE_BUKU_STOK as readonly string[]).includes(v)

export class GalatStok extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GalatStok'
  }
}

export type PerubahanStok = {
  tipe: string
  delta?: number // tambah atau kurangi
  setKe?: number // atau langsung setel ke angka ini
  izinkanNegatif?: boolean // hanya untuk tipe koreksi
}

// Hasil: selisih dan saldo akhir. Melempar GalatStok kalau masukan tidak sah atau stok jadi negatif.
export function hitungSaldo(saldoLama: number, p: PerubahanStok): { perubahan: number; saldoAkhir: number } {
  if (!isTipeBukuStok(p.tipe)) throw new GalatStok(`Tipe buku stok tidak dikenal: "${p.tipe}"`)
  const adaDelta = p.delta !== undefined
  const adaSet = p.setKe !== undefined
  if (adaDelta === adaSet) throw new GalatStok('Isi salah satu: delta atau setKe')
  const angka = adaDelta ? p.delta! : p.setKe!
  if (!Number.isInteger(angka)) throw new GalatStok('Jumlah stok harus bilangan bulat')
  if (!Number.isInteger(saldoLama)) throw new GalatStok('Saldo lama tidak valid')
  if (p.izinkanNegatif && p.tipe !== 'koreksi') throw new GalatStok('Stok negatif hanya boleh untuk tipe koreksi')
  const saldoAkhir = adaDelta ? saldoLama + angka : angka
  if (saldoAkhir < 0 && !p.izinkanNegatif) throw new GalatStok(`Stok tidak cukup: sisa ${saldoLama}, perubahan ${saldoAkhir - saldoLama}`)
  return { perubahan: saldoAkhir - saldoLama, saldoAkhir }
}
