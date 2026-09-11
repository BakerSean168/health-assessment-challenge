import { spawnSync } from "node:child_process";

const defaultDatabaseUrl =
  "postgresql://postgres:postgres@127.0.0.1:55432/health_assessment_test?schema=public";
const databaseUrl = process.env.TEST_DATABASE_URL ?? defaultDatabaseUrl;

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("docker", ["compose", "-f", "compose.test.yaml", "up", "-d", "--wait"]);
run("pnpm", ["exec", "prisma", "migrate", "deploy"], {
  DATABASE_URL: databaseUrl,
});
run("pnpm", ["exec", "playwright", "test", ...process.argv.slice(2)], {
  DATABASE_URL: databaseUrl,
  TEST_DATABASE_URL: databaseUrl,
});
