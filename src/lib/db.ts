import { PrismaClient } from '@/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const g = globalThis as unknown as { prisma?: PrismaClient }

export const db =
  g.prisma ?? new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }) })

if (process.env.NODE_ENV !== 'production') g.prisma = db
