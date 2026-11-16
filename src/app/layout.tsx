import type { Metadata, Viewport } from 'next'
import { DM_Sans, Rubik } from 'next/font/google'
import { getContent } from '@/lib/settings'
import './globals.css'

// Judul memakai Rubik, isi memakai DM Sans.
const rubik = Rubik({ variable: '--font-rubik', subsets: ['latin'], weight: ['500', '700', '800', '900'] })
const dmSans = DM_Sans({ variable: '--font-dm-sans', subsets: ['latin'] })

export const viewport: Viewport = { themeColor: '#0a0a0a' }

// Dasar alamat untuk gambar Open Graph, dari SITE_URL. Tanpa ini Next memakai http://localhost:3000,
// sehingga pratinjau tautan di WhatsApp dan sosial media tidak memuat gambarnya.
function dasarAlamat(): URL | undefined {
  const s = (process.env.SITE_URL ?? '').trim()
  try {
    return s ? new URL(s) : undefined
  } catch {
    return undefined
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getContent()
  return {
    metadataBase: dasarAlamat(),
    title: site.seoTitle,
    description: site.seoDescription,
    openGraph: site.ogImage ? { images: [site.ogImage] } : undefined,
  }
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="id" data-scroll-behavior="smooth" className={`${rubik.variable} ${dmSans.variable} antialiased`}>
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
