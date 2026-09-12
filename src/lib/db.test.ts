
describe("database pool configuration", () => {
  it("rejects partially numeric or fractional pool limits", () => {
    expect(resolveDatabasePoolMax(undefined)).toBe(4);
    expect(resolveDatabasePoolMax("8")).toBe(8);
    expect(() => resolveDatabasePoolMax("4junk")).toThrow(
      "DATABASE_POOL_MAX must be a positive integer.",
    );
    expect(() => resolveDatabasePoolMax("4.5")).toThrow(
      "DATABASE_POOL_MAX must be a positive integer.",
    );
  });
});

import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveDatabasePoolMax } from "./db";

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
