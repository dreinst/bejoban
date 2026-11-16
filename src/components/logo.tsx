/* eslint-disable @next/next/no-img-element */
// Logo Bejo Ban (putih, untuk latar hitam). Kalau admin mengunggah logo di Tampilan Web, itu yang dipakai.
export function Logo({ src, className = '' }: { src?: string; className?: string }) {
  return <img src={src || '/logo-bejoban-putih.svg'} alt="Bejo Ban" className={className} />
}
