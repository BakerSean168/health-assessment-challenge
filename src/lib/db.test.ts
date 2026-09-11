import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("production Prisma lifecycle", () => {
  it("reuses one application Prisma client instead of creating a pool per request", () => {
    const tsx = path.join(process.cwd(), "node_modules", ".bin", "tsx");
    const script = [
      'import { getPrismaClient } from "./src/lib/db.ts";',
      "const first = getPrismaClient();",
      "const second = getPrismaClient();",
      "console.log(first === second);",
    ].join(" ");

    const output = execFileSync(tsx, ["-e", script], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "production",
        DATABASE_URL:
          "postgresql://postgres:postgres@127.0.0.1:55432/health_assessment_test?schema=public",
      },
    });

    expect(output.trim()).toBe("true");
  });
});
