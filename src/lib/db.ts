import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const g = globalThis as unknown as { prisma?: PrismaClient }

// Pool kecil karena PostgreSQL di server dijatah 768 MB. App memakai paling banyak 5 koneksi,
// worker bot:wa 2 (DB_POOL_MAX di package.json). Koneksi menganggur ditutup sesudah 30 detik.
const buat = () =>
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
      max: Number(process.env.DB_POOL_MAX) || 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    }),
  })

export const db = g.prisma ?? buat()

if (process.env.NODE_ENV !== 'production') g.prisma = db
