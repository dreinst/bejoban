// Status percakapan chatbot dan peralihannya. Modul murni.
export const STATUSES = ['BARU', 'DIJAWAB_BOT', 'DISERAHKAN', 'SELESAI_ADA', 'SELESAI_TIDAK_ADA'] as const
export type Status = (typeof STATUSES)[number]

export const STATUS_LABEL: Record<Status, string> = {
  BARU: 'Baru',
  DIJAWAB_BOT: 'Dijawab bot',
  DISERAHKAN: 'Diserahkan ke admin',
  SELESAI_ADA: 'Selesai, tersedia',
  SELESAI_TIDAK_ADA: 'Selesai, tidak tersedia',
}

export const isClosed = (s: string) => s === 'SELESAI_ADA' || s === 'SELESAI_TIDAK_ADA'

export type Event = 'bot_menjawab' | 'bot_serahkan' | 'admin_membalas' | 'luar_jam' | 'tandai_ada' | 'tandai_tidak_ada'

// Percakapan yang sudah selesai tidak berubah lagi (pesan baru membuka percakapan baru).
export function nextStatus(cur: Status, ev: Event): Status {
  if (isClosed(cur)) return cur
  switch (ev) {
    case 'bot_menjawab':
      return cur === 'DISERAHKAN' ? cur : 'DIJAWAB_BOT'
    case 'bot_serahkan':
    case 'admin_membalas':
      return 'DISERAHKAN'
    case 'luar_jam':
      return cur
    case 'tandai_ada':
      return 'SELESAI_ADA'
    case 'tandai_tidak_ada':
      return 'SELESAI_TIDAK_ADA'
  }
}

export const isMuted = (c: { status: string; mutedUntil: Date | null }, now: Date) =>
  !isClosed(c.status) && !!c.mutedUntil && c.mutedUntil.getTime() > now.getTime()

export const muteUntil = (now: Date, hours: number) => new Date(now.getTime() + hours * 3600_000)

// Pilihan cabang pelanggan diingat selama `days` hari sejak dipilih.
export const memoryFresh = (m: { chosenAt: Date } | null | undefined, now: Date, days: number) =>
  !!m && now.getTime() - m.chosenAt.getTime() < days * 86400_000
