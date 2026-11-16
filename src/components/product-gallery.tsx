'use client'
import { useState } from 'react'

/* eslint-disable @next/next/no-img-element */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [i, setI] = useState(0)
  if (!images.length) return <div className="aspect-square rounded-[10px] bg-soft" />
  return (
    <div>
      <img src={images[i]} alt={name} className="aspect-square w-full rounded-[10px] bg-soft object-contain p-4" />
      {images.length > 1 && (
        <div className="mt-3 flex gap-2">
          {images.map((src, n) => (
            <button key={src} onClick={() => setI(n)} className={`size-16 overflow-hidden rounded-lg border-2 ${n === i ? 'border-ink' : 'border-transparent'}`}>
              <img src={src} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
