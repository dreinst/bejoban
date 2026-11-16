// Membuat ikon situs (favicon, ikon tab, ikon layar utama, manifest) dan gambar Open Graph dari logo Bejo Ban.
// Roda diambil dari vektor logo asli (public/logo-bejoban-putih.svg), satu roda paling kanan, tanpa digambar ulang.
//   npx tsx scripts/buat-ikon.ts
// Hasilnya masuk git: src/app/icon.svg, favicon.ico, apple-icon.png, opengraph-image.png, public/icon-192.png dan icon-512.png.
import { execFileSync } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import sharp from 'sharp'

const ROOT = process.cwd()
const logo = readFileSync(path.join(ROOT, 'public/logo-bejoban-putih.svg'), 'utf8')
// Isi <g> berisi seluruh logo sebagai satu jalur. Dipotong lewat viewBox ke roda paling kanan.
const g = /<g\b[\s\S]*<\/g>/.exec(logo)![0]
// Roda paling kanan di kanvas logo 2370 x 666: bagian roda dan ban dipotong dengan lingkaran supaya sisa ban roda sebelahnya tidak ikut.
const CROP = { x: 1780, y: 0, w: 500, h: 500 }
const CLIP = { cx: 2035, cy: 250, r: 245 }

// Kotak membulat dengan roda di tengah. pad = ruang tepi dalam persen sisi.
function iconSvg(size: number, bg: string, fg: string, pad = 0.2, radius = 0.2) {
  const inner = size * (1 - pad * 2)
  const off = size * pad
  const coloured = g.replace(/fill="#ffffff"/g, `fill="${fg}"`)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${size * radius}" fill="${bg}"/><svg x="${off}" y="${off}" width="${inner}" height="${inner}" viewBox="${CROP.x} ${CROP.y} ${CROP.w} ${CROP.h}"><defs><clipPath id="roda"><circle cx="${CLIP.cx}" cy="${CLIP.cy}" r="${CLIP.r}"/></clipPath></defs><g clip-path="url(#roda)">${coloured}</g></svg></svg>`
}

async function png(svg: string, size: number) {
  return sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png().toBuffer()
}

// ICO berisi PNG 16, 32, dan 48 px.
function ico(images: { size: number; data: Buffer }[]) {
  const head = Buffer.alloc(6)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(images.length, 4)
  let offset = 6 + images.length * 16
  const dirs = images.map((im) => {
    const d = Buffer.alloc(16)
    d.writeUInt8(im.size >= 256 ? 0 : im.size, 0)
    d.writeUInt8(im.size >= 256 ? 0 : im.size, 1)
    d.writeUInt16LE(1, 4)
    d.writeUInt16LE(32, 6)
    d.writeUInt32LE(im.data.length, 8)
    d.writeUInt32LE(offset, 12)
    offset += im.data.length
    return d
  })
  return Buffer.concat([head, ...dirs, ...images.map((i) => i.data)])
}

async function main() {
  mkdirSync(path.join(ROOT, 'public'), { recursive: true })
  const dark = '#0a0a0a'
  // icon.svg: hitam dengan roda putih di tab terang, putih dengan roda hitam di tab gelap.
  const light = iconSvg(512, dark, '#ffffff', 0.18)
  const reverse = iconSvg(512, '#ffffff', dark, 0.18)
  const styled = light.replace('<svg xmlns="http://www.w3.org/2000/svg"', '<svg xmlns="http://www.w3.org/2000/svg"').replace('</svg></svg>', '</svg></svg>')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><style>.a{display:inline}.b{display:none}@media (prefers-color-scheme:dark){.a{display:none}.b{display:inline}}</style><g class="a">${styled.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g><g class="b">${reverse.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g></svg>`
  writeFileSync(path.join(ROOT, 'src/app/icon.svg'), svg)

  const small = iconSvg(64, dark, '#ffffff', 0.12, 0.18) // ruang tepi lebih kecil supaya roda terbaca di 16 px
  // Pada 16 px detail jari-jari kabur, jadi ukuran terkecil memakai ruang tepi lebih tipis dan dipertajam sedikit.
  const tiny = iconSvg(64, dark, '#ffffff', 0.04, 0.16)
  const sharpPng = (svg: string, size: number) => sharp(Buffer.from(svg), { density: 400 }).resize(size, size).sharpen({ sigma: 0.8 }).png().toBuffer()
  writeFileSync(path.join(ROOT, 'src/app/favicon.ico'), ico([{ size: 16, data: await sharpPng(tiny, 16) }, { size: 32, data: await png(small, 32) }, { size: 48, data: await png(small, 48) }]))
  writeFileSync(path.join(ROOT, 'src/app/apple-icon.png'), await png(iconSvg(180, dark, '#ffffff', 0.18, 0), 180)) // iOS membulatkan sendiri
  writeFileSync(path.join(ROOT, 'public/icon-192.png'), await png(iconSvg(192, dark, '#ffffff', 0.2, 0.2), 192))
  writeFileSync(path.join(ROOT, 'public/icon-512.png'), await png(iconSvg(512, dark, '#ffffff', 0.2, 0.2), 512))

  // Gambar Open Graph 1200 x 630: hitam, logo putih, tagline. Dirender lewat Chrome supaya memakai font Rubik.
  const html = `<!doctype html><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Rubik:wght@800&display=swap" rel="stylesheet"><body style="margin:0;width:1200px;height:630px;background:#0a0a0a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px"><img src="data:image/svg+xml;base64,${Buffer.from(logo).toString('base64')}" style="width:640px"><p style="margin:0;font:800 38px/1.2 Rubik,sans-serif;color:#fff;text-align:center;max-width:1040px;text-wrap:balance">Toko Ban, Velg &amp; Oli Mobil di Batu dan Karanglo Malang</p></body>`
  const tmp = '/tmp/og-bejoban.html'
  writeFileSync(tmp, html)
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1200,630', '--virtual-time-budget=6000', `--screenshot=${path.join(ROOT, 'src/app/opengraph-image.png')}`, `file://${tmp}`], { stdio: 'ignore' })
  console.log('Ikon dan gambar Open Graph dibuat.')
}

main()
