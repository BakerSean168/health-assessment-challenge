import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";

const DEFAULT_DATABASE_POOL_MAX = 4;

declare global {
  var __healthAssessmentPrisma: PrismaClient | undefined;
}

export function resolveDatabasePoolMax(configured?: string): number {
  if (!configured) return DEFAULT_DATABASE_POOL_MAX;

  const parsed = Number(configured);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("DATABASE_POOL_MAX must be a positive integer.");
  }

  return parsed;
}

export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({
    connectionString,
    max: resolveDatabasePoolMax(process.env.DATABASE_POOL_MAX),
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
  globalThis.__healthAssessmentPrisma ??= createPrismaClient(connectionString);
  return globalThis.__healthAssessmentPrisma;
}
