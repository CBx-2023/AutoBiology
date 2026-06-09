import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { execCommand } from "./helpers/exec-command";

const e2eTimeoutMs = 30_000;

describe("autobio run CLI", () => {
  it("executes all pipeline stages and writes the final output structure", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "autobio-e2e-"));
    const homeDir = await mkdtemp(join(tmpdir(), "autobio-e2e-home-empty-"));

    try {
      await execCommand("npx", ["tsx", "src/cli.ts", "run", "tests/fixtures/sample-sop-cell-collection.txt", "-o", outputDir], {
        cwd: process.cwd(),
        timeout: 20_000,
        env: testHomeEnv(homeDir)
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
      await rm(homeDir, { recursive: true, force: true });
      await rm(outputDir, { recursive: true, force: true });
    }
  }, e2eTimeoutMs);

  it("passes configured global JSON config into the full run command without real credentials", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "autobio-e2e-llm-"));
    const homeDir = await mkdtemp(join(tmpdir(), "autobio-e2e-home-"));
    const requests: string[] = [];
    const server = createServer((request, response) => {
      let body = "";
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        requests.push(body);
        const content =
          requests.length === 1
            ? JSON.stringify({
                requirements: [
                  {
                    type: "R4",
                    description: "维持低温",
                    source_hyperedge: "H-OP-002",
                    source_ops: ["OP-002"],
                    applicable_to: "细胞悬液",
                    confidence: 0.7
                  }
                ]
              })
            : requests.length === 2
              ? JSON.stringify({ description: "设备应在离心过程中维持低温条件。" })
              : JSON.stringify({ is_duplicate: false });
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ choices: [{ message: { content } }] }));
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind to a local port");

    try {
      await mkdir(join(homeDir, ".autob"), { recursive: true });
      await writeFile(
        join(homeDir, ".autob", "config.json"),
        JSON.stringify({
          llm: {
            provider: "custom",
            apiKey: "test-key",
            baseUrl: `http://127.0.0.1:${address.port}/v1`,
            model: "test-model"
          }
        }),
        "utf8"
      );

      await execCommand("npx", ["tsx", "src/cli.ts", "run", "tests/fixtures/sample-sop-cell-collection.txt", "-o", outputDir], {
        cwd: process.cwd(),
        timeout: 20_000,
        env: testHomeEnv(homeDir)
      });

      const requirements = JSON.parse(await readFile(join(outputDir, "04-requirements.json"), "utf8"));
      const meta = JSON.parse(await readFile(join(outputDir, "run-meta.json"), "utf8"));

      expect(requests).toHaveLength(3);
      expect(requirements.requirements.some((requirement: { inferenceRule: string }) => requirement.inferenceRule === "LLM-Candidate")).toBe(true);
      expect(meta.config.llmModel).toBe("test-model");
    } finally {
      server.close();
      await rm(homeDir, { recursive: true, force: true });
      await rm(outputDir, { recursive: true, force: true });
    }
  }, e2eTimeoutMs);

  it("passes configured global JSON config into the infer command without real credentials", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "autobio-infer-llm-"));
    const homeDir = await mkdtemp(join(tmpdir(), "autobio-infer-home-"));
    const inputFile = join(outputDir, "requirements.json");
    const requests: string[] = [];
    const server = createServer((request, response) => {
      let body = "";
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        requests.push(body);
        const content =
          requests.length === 1
            ? JSON.stringify({
                requirements: [
                  {
                    type: "R4",
                    description: "维持低温",
                    source_hyperedge: "H-JSON-CONFIG",
                    source_ops: ["OP-JSON-CONFIG"],
                    applicable_to: "样本",
                    confidence: 0.7
                  }
                ]
              })
            : requests.length === 2
              ? JSON.stringify({ description: "设备应维持低温条件。" })
              : JSON.stringify({ is_duplicate: false });
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ choices: [{ message: { content } }] }));
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind to a local port");

    try {
      await mkdir(join(homeDir, ".autob"), { recursive: true });
      await writeFile(
        join(homeDir, ".autob", "config.json"),
        JSON.stringify({
          llm: {
            provider: "custom",
            apiKey: "test-key",
            baseUrl: `http://127.0.0.1:${address.port}/v1`,
            model: "test-model"
          }
        }),
        "utf8"
      );
      await writeFile(inputFile, JSON.stringify({ requirements: [], clarifications: [] }), "utf8");

      await execCommand("npx", ["tsx", "src/cli.ts", "infer", inputFile, "-o", outputDir], {
        cwd: process.cwd(),
        timeout: 20_000,
        env: testHomeEnv(homeDir)
      });

      const requirements = JSON.parse(await readFile(join(outputDir, "04-requirements.json"), "utf8"));

      expect(requests).toHaveLength(3);
      expect(requirements.requirements.some((requirement: { inferenceRule: string }) => requirement.inferenceRule === "LLM-Candidate")).toBe(true);
    } finally {
      server.close();
      await rm(homeDir, { recursive: true, force: true });
      await rm(outputDir, { recursive: true, force: true });
    }
  }, e2eTimeoutMs);
});

function testHomeEnv(homeDir: string): NodeJS.ProcessEnv {
  return { ...process.env, HOME: homeDir, USERPROFILE: homeDir };
}
