import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function collectRouteTestFiles(startDir: string, rootDir = startDir): string[] {
  const files: string[] = [];
  const entries = readdirSync(startDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(startDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectRouteTestFiles(absolutePath, rootDir));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      files.push(path.relative(rootDir, absolutePath));
    }
  }

  return files;
}

describe("Expo Router route hygiene", () => {
  it("does not keep test files inside src/app route tree", () => {
    const appDirectory = path.resolve(process.cwd(), "src/app");

    expect(statSync(appDirectory).isDirectory()).toBe(true);

    const routeTestFiles = collectRouteTestFiles(appDirectory).sort();
    expect(routeTestFiles).toEqual([]);
  });
});
