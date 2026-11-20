// Bagian Kasir memakai manifest sendiri, supaya bisa dipasang sebagai aplikasi yang langsung membuka layar kasir.
export const metadata = { manifest: '/kasir.webmanifest' }

export default function KasirLayout({ children }: LayoutProps<'/admin/kasir'>) {
  return children
}
