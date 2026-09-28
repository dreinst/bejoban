export const rupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export const waLink = (phone: string, text = '') =>
  `https://wa.me/${phone.replace(/\D/g, '').replace(/^0/, '62')}${text ? '?text=' + encodeURIComponent(text) : ''}`

export const parseImages = (s: string): string[] => {
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export const isFuture = (s: string) => !!s && new Date(s).getTime() > Date.now()
