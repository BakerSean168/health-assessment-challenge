import "dotenv/config";

import { defineConfig } from "prisma/config";

const localTestDatabaseUrl =
  "postgresql://postgres:postgres@127.0.0.1:55432/health_assessment_test?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      process.env.TEST_DATABASE_URL ??
      localTestDatabaseUrl,
  },
});
