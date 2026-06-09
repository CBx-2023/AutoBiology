import { execFile } from "node:child_process";
import { createServer } from "node:http";
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
        timeout: 20_000,
        env: withoutLlmEnv()
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

  it("passes configured LLM env into the full run command without real credentials", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "autobio-e2e-llm-"));
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
      await execFileAsync("npx", ["tsx", "src/cli.ts", "run", "tests/fixtures/sample-sop-cell-collection.txt", "-o", outputDir], {
        cwd: process.cwd(),
        timeout: 20_000,
        env: {
          ...withoutLlmEnv(),
          AUTOBIO_LLM_API_KEY: "test-key",
          AUTOBIO_LLM_BASE_URL: `http://127.0.0.1:${address.port}/v1`,
          AUTOBIO_LLM_MODEL: "test-model"
        }
      });

      const requirements = JSON.parse(await readFile(join(outputDir, "04-requirements.json"), "utf8"));
      const meta = JSON.parse(await readFile(join(outputDir, "run-meta.json"), "utf8"));

      expect(requests).toHaveLength(3);
      expect(requirements.requirements.some((requirement: { inferenceRule: string }) => requirement.inferenceRule === "LLM-Candidate")).toBe(true);
      expect(meta.config.llmModel).toBe("test-model");
    } finally {
      server.close();
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});

function withoutLlmEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.AUTOBIO_LLM_API_KEY;
  delete env.AUTOBIO_LLM_BASE_URL;
  delete env.AUTOBIO_LLM_MODEL;
  delete env.AUTOBIO_LLM_TIMEOUT_MS;
  delete env.DEEPSEEK_API_KEY;
  delete env.DEEPSEEK_BASE_URL;
  delete env.DEEPSEEK_MODEL;
  delete env.OPENAI_API_KEY;
  delete env.OPENAI_BASE_URL;
  delete env.OPENAI_MODEL;
  return env;
}
