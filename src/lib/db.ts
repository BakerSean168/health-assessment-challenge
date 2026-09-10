import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export function getPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create the application Prisma client.");
  }

  if (process.env.NODE_ENV === "production") {
    return createPrismaClient(connectionString);
  }

  globalForPrisma.prisma ??= createPrismaClient(connectionString);
  return globalForPrisma.prisma;
}
