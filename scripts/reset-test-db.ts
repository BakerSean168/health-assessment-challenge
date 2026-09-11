import { createPrismaClient } from "../src/lib/db";

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55432/health_assessment_test?schema=public";

async function main() {
  const prisma = createPrismaClient(databaseUrl);

  try {
    // AnonymousSession is the aggregate root for test data. Cascades remove the
    // single assessment, its result snapshot, and simulated payment events.
    await prisma.anonymousSession.deleteMany();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
