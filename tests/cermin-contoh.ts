// Payload WAHA buatan untuk tes cermin chat. Nomor dan isi karangan, bukan data toko.
export const PEL = '6280000000001@c.us'
export const GRUP = '120363000000000001@g.us'
export const KUNCI = 'kunci-uji-contoh'

// Bentuk mengikuti toWAMessage engine GOWS di WAHA.
export const pesanGows = (o: { id: string; fromMe?: boolean; chat?: string; body?: string; ts?: number; Message?: object; participant?: string; pushName?: string; media?: object | null; hasMedia?: boolean }) => {
  const chat = o.chat ?? PEL
  const fromMe = o.fromMe ?? false
  return {
    id: `${fromMe}_${chat}_${o.id}${o.participant ? `_${o.participant}` : ''}`,
    timestamp: o.ts ?? 1_795_000_000,
    from: fromMe ? '6289999999999@c.us' : chat,
    to: fromMe ? chat : '6289999999999@c.us',
    fromMe,
    source: 'app',
    body: o.body ?? '',
    participant: o.participant ?? null,
    hasMedia: o.hasMedia ?? false,
    media: o.media ?? null,
    _data: { Info: { Chat: chat.replace('@c.us', '@s.whatsapp.net'), IsFromMe: fromMe, PushName: o.pushName ?? '' }, Message: o.Message ?? { conversation: o.body ?? '' } },
  }
}

