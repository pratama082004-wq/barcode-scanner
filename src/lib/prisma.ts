// File: src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

// Mencegah koneksi database bocor/menumpuk saat kita sering nge-save file di VSCode (Hot Reload)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;