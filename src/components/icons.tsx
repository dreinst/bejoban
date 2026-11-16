// Set ikon Bejo Ban (bentuk terisi dan tebal, viewBox 48). Diporting dari alat/ikon.py di folder aset.
// c = warna bentuk utama, d = warna detail (samakan dengan latar chip di belakangnya).
import type { ReactNode } from 'react'

export type IconName = 'spooring' | 'balancing' | 'nitrogen' | 'tire' | 'velg' | 'oli' | 'shield' | 'pin' | 'clock' | 'wa' | 'ig' | 'arrow' | 'branch'
export const ICON_NAMES: IconName[] = ['spooring', 'balancing', 'nitrogen', 'tire', 'velg', 'oli', 'shield', 'pin', 'clock', 'wa', 'ig', 'arrow', 'branch']

const SW = 3

function spokes(n: number, r0: number, r1: number, w: number, c: string, rot = -90, cap: 'round' | 'butt' = 'round') {
  return Array.from({ length: n }, (_, k) => {
    const a = ((rot + (k * 360) / n) * Math.PI) / 180
    return <line key={k} x1={24 + r0 * Math.cos(a)} y1={24 + r0 * Math.sin(a)} x2={24 + r1 * Math.cos(a)} y2={24 + r1 * Math.sin(a)} stroke={c} strokeWidth={w} strokeLinecap={cap} />
  })
}

function body(name: IconName, c: string, d: string): ReactNode {
  const ln = (x1: number, y1: number, x2: number, y2: number, k?: string | number) => (
    <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={SW} strokeLinecap="round" />
  )
  switch (name) {
    case 'spooring': {
      const bar = (y: number) => (
        <g key={y}>
          {ln(6.5, y, 41.5, y)}
          {ln(6.5, y - 3.5, 6.5, y + 3.5)}
          {ln(41.5, y - 3.5, 41.5, y + 3.5)}
        </g>
      )
      return (
        <>
          {bar(5)}
          {bar(43)}
          <rect x="14" y="10" width="20" height="28" rx="6" fill={c} />
          <rect x="18.5" y="14" width="11" height="20" rx="3" fill={d} />
          <rect x="21.6" y="14" width="4.8" height="20" rx="1.2" fill={c} />
        </>
      )
    }
    case 'balancing':
      return (
        <>
          <circle cx="24" cy="24" r="21" fill={c} />
          <circle cx="24" cy="24" r="14.5" fill={d} />
          <circle cx="24" cy="24" r="12" fill={c} />
          {spokes(5, 0, 9.5, 4.6, d, -90, 'butt')}
          <circle cx="24" cy="24" r="4" fill={c} />
          <circle cx="24" cy="24" r="1.6" fill={d} />
          <rect x="19" y="9" width="10" height="5" rx="1.6" fill={d} />
          <rect x="19" y="34" width="10" height="5" rx="1.6" fill={d} />
          <rect x="20.6" y="10.6" width="6.8" height="1.8" rx=".6" fill={c} />
          <rect x="20.6" y="35.6" width="6.8" height="1.8" rx=".6" fill={c} />
        </>
      )
    case 'nitrogen':
      return (
        <>
          <rect x="21" y="3" width="10" height="9" rx="3" fill={c} />
          <rect x="16.5" y="9" width="19" height="6" rx="3" fill={c} />
          <rect x="9" y="14" width="26" height="31" rx="9" fill={c} />
          <path d="M33 7 H38.5 a5 5 0 0 1 5 5 V30" fill="none" stroke={c} strokeWidth={SW} strokeLinecap="round" />
          <rect x="40" y="29" width="7" height="8" rx="2.4" fill={c} />
          <path d="M14.5 37 V25 L22 37 V25" fill="none" stroke={d} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M24.8 27.5 a3.3 3.3 0 0 1 6.4 1 c0 2.6 -3.5 4 -6.4 8.5 h6.6" fill="none" stroke={d} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )
    case 'tire':
      return (
        <>
          <ellipse cx="32" cy="24" rx="9" ry="20" fill={c} />
          <rect x="18" y="4" width="14" height="40" fill={c} />
          {[10, 16, 22, 28, 34].map((y) => <line key={y} x1="18" y1={y} x2="31" y2={y + 4} stroke={d} strokeWidth="2.4" strokeLinecap="round" />)}
          <ellipse cx="17" cy="24" rx="9.5" ry="20" fill={c} />
          <ellipse cx="17" cy="24" rx="5.6" ry="12.5" fill={d} />
          <ellipse cx="17" cy="24" rx="3.2" ry="7.5" fill={c} />
          <ellipse cx="17" cy="24" rx="1.2" ry="2.6" fill={d} />
        </>
      )
    case 'velg':
      return (
        <>
          <circle cx="24" cy="24" r="21" fill={c} />
          <circle cx="24" cy="24" r="16.5" fill={d} />
          {spokes(5, 0, 15, 6.4, c)}
          <circle cx="24" cy="24" r="6.8" fill={c} />
          <circle cx="24" cy="24" r="2.4" fill={d} />
        </>
      )
    case 'oli':
      return (
        <>
          <rect x="6" y="19" width="26" height="26" rx="6" fill={c} />
          <rect x="9" y="14.5" width="20" height="7" rx="3" fill={c} />
          <path d="M7.5 25 h-1.5 a4 4 0 0 0 -4 4 v6 a4 4 0 0 0 4 4 h1.5" fill="none" stroke={c} strokeWidth={SW} strokeLinecap="round" />
          <line x1="29" y1="17" x2="41" y2="9" stroke={c} strokeWidth="5" strokeLinecap="round" />
          <path d="M42 21 c3.6 4.2 5.2 6.6 5.2 9 a5.2 5.2 0 0 1 -10.4 0 c0 -2.4 1.6 -4.8 5.2 -9z" fill={c} />
          <path d="M19 26.5 c3.2 3.8 4.6 5.8 4.6 7.8 a4.6 4.6 0 0 1 -9.2 0 c0 -2 1.4 -4 4.6 -7.8z" fill={d} />
        </>
      )
    case 'shield':
      return (
        <>
          <path d="M24 2.5 L40.5 8 V22 c0 10.5 -6.6 18.2 -16.5 23 C14.1 40.2 7.5 32.5 7.5 22 V8 Z" fill={c} stroke={c} strokeWidth="3" strokeLinejoin="round" />
          <path d="M15.5 23.5 l6 6 11-12.5" fill="none" stroke={d} strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )
    case 'pin':
      return (
        <>
          <path d="M24 45 C13 33.5 8.5 27.5 8.5 19.5 a15.5 15.5 0 0 1 31 0 C39.5 27.5 35 33.5 24 45 Z" fill={c} stroke={c} strokeWidth="2.4" strokeLinejoin="round" />
          <circle cx="24" cy="19.5" r="6.2" fill={d} />
        </>
      )
    case 'clock':
      return (
        <>
          <circle cx="24" cy="24" r="21" fill={c} />
          <path d="M24 11.5 V25 l9 5.5" fill="none" stroke={d} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )
    case 'wa':
      return (
        <>
          <path d="M24 3.5 a20.5 20.5 0 0 0 -17.6 31 L3.5 44.5 l10.4 -2.8 A20.5 20.5 0 1 0 24 3.5 Z" fill={c} />
          <path d="M17 14.5 c.5 -1 1.2 -1 1.9 -1 h1.1 c.5 0 .9.1 1.3 1.2 l1.6 3.9 c.2.5.1.9 -.2 1.3 l-1.1 1.3 c-.3.4 -.4.7 -.1 1.3 1.1 2.1 3.4 4.4 6 5.5 .6.3 1 .2 1.3 -.2 l1.4 -1.6 c.4 -.4.7 -.5 1.3 -.2 l3.7 1.8 c.6.3 .9.5 .9 1 0 1.2 -.5 2.7 -1.4 3.4 -1.1 .9 -2.7 1.3 -4.6 .9 -3.2 -.7 -6.9 -2.8 -9.9 -6.1 -2.8 -3 -4.3 -6 -4.8 -8.5 -.2 -1.9 .5 -3.5 1.4 -4.3 Z" fill={d} />
        </>
      )
    case 'ig':
      return (
        <>
          <rect x="3.5" y="3.5" width="41" height="41" rx="12" fill={c} />
          <circle cx="24" cy="24" r="9.2" fill="none" stroke={d} strokeWidth="4.2" />
          <circle cx="35" cy="13" r="2.8" fill={d} />
        </>
      )
    case 'arrow':
      return <path d="M7 24 H39 M26 11 L39 24 L26 37" fill="none" stroke={c} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    case 'branch':
      return (
        <>
          <circle cx="24" cy="24" r="8" fill={c} />
          <path d="M24 3 V12 M24 36 V45 M3 24 H12 M36 24 H45" stroke={c} strokeWidth="6" strokeLinecap="round" />
        </>
      )
  }
}

const DETAIL: Record<string, string> = { '#0a0a0a': '#ffffff', '#ffffff': '#1a1a1a', '#fff': '#1a1a1a' }

export function Icon({ name, size = 24, c = '#ffffff', d }: { name: IconName; size?: number; c?: string; d?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      {body(name, c, d ?? DETAIL[c] ?? '#ffffff')}
    </svg>
  )
}

// Chip hitam berdepth dengan ikon putih.
export function IconChip({ name, size, box, className = '' }: { name: IconName; size: number; box: number; className?: string }) {
  return (
    <div className={`chip-k ${className}`} style={{ width: box, height: box }}>
      <Icon name={name} size={size} c="#ffffff" d="#161616" />
    </div>
  )
}
