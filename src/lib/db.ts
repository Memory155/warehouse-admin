import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set.");
}

const globalForDb = globalThis as unknown as {
  pool?: Pool;
  prisma?: PrismaClient;
};

const isSupabaseUrl =
  databaseUrl.includes("supabase.co") || databaseUrl.includes("pooler.supabase.com");
const hasSslModeInUrl = /(?:\?|&)sslmode=/i.test(databaseUrl);

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: databaseUrl,
    // Vercel + Supabase 场景下尽量使用短连接和更小连接池，避免连接被提前回收或打满。
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    ssl:
      isSupabaseUrl && !hasSslModeInUrl
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
  });

const prismaAdapter = new PrismaPg(pool);

const prisma =
  globalForDb.prisma ??
  new PrismaClient({
    adapter: prismaAdapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
  globalForDb.prisma = prisma;
}

export { prisma };
