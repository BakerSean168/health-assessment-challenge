import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

type PackageManifest = {
  packageManager?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

async function readManifest(relativePath: string): Promise<PackageManifest> {
  const contents = await readFile(path.resolve(process.cwd(), relativePath), "utf8");
  return JSON.parse(contents) as PackageManifest;
}

describe("deployment toolchain alignment", () => {
  it("keeps the migration image on the same Prisma and pnpm versions as the app", async () => {
    const [app, migrator] = await Promise.all([
      readManifest("package.json"),
      readManifest("docker/migrator/package.json"),
    ]);

    expect(migrator.dependencies?.prisma).toBe(app.devDependencies?.prisma);
    expect(migrator.packageManager).toBe(app.packageManager);
  });
});
