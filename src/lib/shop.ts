import 'server-only'
import { cookies } from 'next/headers'
import { db } from './db'
import { parseImages } from './format'
import type { Prisma } from '@/generated/prisma/client'

export const BRANCH_COOKIE = 'bejo_branch'

export const getBranches = () => db.branch.findMany({ orderBy: { sort: 'asc' } })

export async function currentBranch() {
  const branches = await getBranches()
  const slug = (await cookies()).get(BRANCH_COOKIE)?.value
  return { branches, branch: branches.find((b) => b.slug === slug) ?? branches[0] }
}

export type CardProduct = {
  id: number
  slug: string
  name: string
  spec: string
  brand: string
  image: string
  price: number
  comparePrice: number
  stock: number
  isSample: boolean
}

type Filter = { q?: string; category?: string; brand?: string; fitment?: string; flash?: boolean; ids?: number[] }

export async function listProducts(branchId: number, f: Filter = {}, opts: { take?: number; sort?: string } = {}) {
  const where: Prisma.ListingWhereInput = {
    branchId,
    available: true,
    ...(f.flash && { flashSale: true }),
    product: {
      active: true,
      ...(f.ids && { id: { in: f.ids } }),
      ...(f.category && { category: { slug: f.category } }),
      ...(f.brand && { brand: { name: f.brand } }),
      ...(f.fitment && { fitment: { contains: f.fitment } }),
      ...(f.q && {
        OR: [
          { name: { contains: f.q } },
          { spec: { contains: f.q } },
          { fitment: { contains: f.q } },
          { brand: { name: { contains: f.q } } },
          { category: { name: { contains: f.q } } },
        ],
      }),
    },
  }
  const orderBy: Prisma.ListingOrderByWithRelationInput =
    opts.sort === 'murah' ? { price: 'asc' } : opts.sort === 'mahal' ? { price: 'desc' } : { product: { createdAt: 'desc' } }
  const rows = await db.listing.findMany({ where, orderBy, take: opts.take, include: { product: { include: { brand: true } } } })
  return rows.map(toCard)
}

export function toCard(l: {
  price: number
  comparePrice: number
  stock: number
  product: { id: number; slug: string; name: string; spec: string; images: string; isSample: boolean; brand: { name: string } | null }
}): CardProduct {
  const p = l.product
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    spec: p.spec,
    brand: p.brand?.name ?? '',
    image: parseImages(p.images)[0] ?? '',
    price: l.price,
    comparePrice: l.comparePrice,
    stock: l.stock,
    isSample: p.isSample,
  }
}
