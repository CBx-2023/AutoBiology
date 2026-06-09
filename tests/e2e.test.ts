import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("autobio run CLI", () => {
  it("executes all pipeline stages and writes the final output structure", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "autobio-e2e-"));

    try {
      await execFileAsync("npx", ["tsx", "src/cli.ts", "run", "tests/fixtures/sample-sop-cell-collection.txt", "-o", outputDir], {
        cwd: process.cwd(),
        timeout: 20_000
      });

      const expectedFiles = [
        "01-ops.json",
        "02-nodes.json",
        "03-hyperedges.json",
        "04-requirements.json",
        "05-coverage.json",
        "06-clarifications.json",
        "report.md",
        "run-meta.json"
      ];
      const existing = await Promise.all(expectedFiles.map(async (fileName) => Boolean(await readFile(join(outputDir, fileName), "utf8"))));
      const meta = JSON.parse(await readFile(join(outputDir, "run-meta.json"), "utf8"));
      const report = await readFile(join(outputDir, "report.md"), "utf8");

      expect(existing).toEqual(expectedFiles.map(() => true));
      expect(meta.stats.opCount).toBe(4);
      expect(meta.stats.requirementCount).toBeGreaterThanOrEqual(10);
      expect(report).toContain("AutoBiology Requirement Review");
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
