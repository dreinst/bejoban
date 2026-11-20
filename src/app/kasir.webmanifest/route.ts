// Manifest web app untuk kasir. Dipasang dari bagian Kasir (src/app/admin/(panel)/kasir/layout.tsx), jadi aplikasi yang
// dipasang di HP, tablet, atau PC langsung membuka layar kasir. Sengaja di luar /admin supaya bisa diambil tanpa login.
export const dynamic = 'force-static'

export function GET() {
  return Response.json(
    {
      id: '/admin/kasir',
      name: 'Kasir Bejo Ban',
      short_name: 'Kasir',
      description: 'Kasir toko Bejo Ban',
      start_url: '/admin/kasir',
      scope: '/admin/',
      display: 'standalone',
      orientation: 'any',
      background_color: '#0a0a0a',
      theme_color: '#0a0a0a',
      lang: 'id',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' } },
  )
}
