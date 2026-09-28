import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { getContent } from '@/lib/settings'
import './globals.css'

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] })

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
    <html lang="id" className={`${inter.variable} antialiased`}>
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
