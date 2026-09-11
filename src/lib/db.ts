import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";

const DEFAULT_DATABASE_POOL_MAX = 4;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function databasePoolMax(): number {
  const configured = process.env.DATABASE_POOL_MAX;
  if (!configured) return DEFAULT_DATABASE_POOL_MAX;

  const parsed = Number.parseInt(configured, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("DATABASE_POOL_MAX must be a positive integer.");
  }

  return parsed;
}

export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({
    connectionString,
    max: databasePoolMax(),
  });
  return new PrismaClient({ adapter });
}

export function getPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create the application Prisma client.");
  }

  // Next.js route bundles share one Node.js process in the standalone runtime.
  // Cache on globalThis in every environment so production requests do not
  // create a new pg Pool (and therefore up to N connections) per invocation.
  globalForPrisma.prisma ??= createPrismaClient(connectionString);
  return globalForPrisma.prisma;
}
