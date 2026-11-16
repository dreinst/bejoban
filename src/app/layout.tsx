import type { Metadata, Viewport } from 'next'
import { DM_Sans, Rubik } from 'next/font/google'
import { getContent } from '@/lib/settings'
import './globals.css'

// Judul memakai Rubik, isi memakai DM Sans.
const rubik = Rubik({ variable: '--font-rubik', subsets: ['latin'], weight: ['500', '700', '800', '900'] })
const dmSans = DM_Sans({ variable: '--font-dm-sans', subsets: ['latin'] })

export const viewport: Viewport = { themeColor: '#0a0a0a' }

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getContent()
  return {
    title: site.seoTitle,
    description: site.seoDescription,
    openGraph: site.ogImage ? { images: [site.ogImage] } : undefined,
  }
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="id" className={`${rubik.variable} ${dmSans.variable} antialiased`}>
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
