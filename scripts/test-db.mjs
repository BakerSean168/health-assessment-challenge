import { spawnSync } from "node:child_process";

const defaultTestDatabaseUrl =
  "postgresql://postgres:postgres@127.0.0.1:55432/health_assessment_test?schema=public";

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? defaultTestDatabaseUrl;
const action = process.argv[2];

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function migrate() {
  run("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    DATABASE_URL: testDatabaseUrl,
  });
}

if (action === "migrate") {
  migrate();
} else if (action === "test") {
  migrate();
  run(
    "pnpm",
    ["exec", "vitest", "run", "--config", "vitest.integration.config.mts"],
    { TEST_DATABASE_URL: testDatabaseUrl },
  );
} else {
  console.error("Usage: node scripts/test-db.mjs <migrate|test>");
  process.exit(2);
}
