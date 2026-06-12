import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadKnowledgeBase } from "../src/knowledge/loader.js";
import { runPipeline } from "../src/pipeline/runner.js";

import { execCommand } from "./helpers/exec-command";

const e2eTimeoutMs = 30_000;
const packageVersion = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

describe("autobio run CLI", () => {
  it("passes one injected knowledge base through every knowledge-aware stage", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "autobio-e2e-knowledge-"));
    const sopFile = join(workspace, "injected-sop.txt");
    const outputDir = join(workspace, "output");
    const knowledge = loadKnowledgeBase();
    knowledge.synonyms["测试试剂"] = "中间别名";
    knowledge.synonyms["中间别名"] = "最终实体";
    knowledge.domainPatterns["加液"] = {
      ...knowledge.domainPatterns["加液"],
      requiredParameters: ["注入参数"]
    };

    try {
      await writeFile(sopFile, "加入 1 mL 测试试剂。", "utf8");

      await runPipeline(sopFile, outputDir, { knowledgeBase: knowledge });

      const ops = JSON.parse(await readFile(join(outputDir, "01-ops.json"), "utf8"));
      const nodes = JSON.parse(await readFile(join(outputDir, "02-nodes.json"), "utf8"));
      const clarifications = JSON.parse(await readFile(join(outputDir, "06-clarifications.json"), "utf8"));

      expect(ops.ops[0].inputs).toContain("中间别名");
      expect(
        nodes.nodes.some(
          (node: { nodeType: string; normalizedName: string }) =>
            node.nodeType === "Input" && node.normalizedName === "最终实体"
        )
      ).toBe(true);
      expect(
        clarifications.some((clarification: { question: string }) =>
          clarification.question.includes("注入参数")
        )
      ).toBe(true);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

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
        "06-verification.json",
        "report.md",
        "run-meta.json"
      ];
      const existing = await Promise.all(expectedFiles.map(async (fileName) => Boolean(await readFile(join(outputDir, fileName), "utf8"))));
      const ops = JSON.parse(await readFile(join(outputDir, "01-ops.json"), "utf8"));
      const nodes = JSON.parse(await readFile(join(outputDir, "02-nodes.json"), "utf8"));
      const clarifications = JSON.parse(await readFile(join(outputDir, "06-clarifications.json"), "utf8"));
      const verification = JSON.parse(await readFile(join(outputDir, "06-verification.json"), "utf8"));
      const meta = JSON.parse(await readFile(join(outputDir, "run-meta.json"), "utf8"));
      const report = await readFile(join(outputDir, "report.md"), "utf8");

      expect(existing).toEqual(expectedFiles.map(() => true));
      expect(
        ops.ops.some((op: { risks: Array<{ name: string; source: string }> }) =>
          op.risks.some((risk) => risk.name === "污染" && risk.source === "expert")
        )
      ).toBe(true);
      expect(
        nodes.nodes.some(
          (node: { nodeType: string; normalizedName: string }) =>
            node.nodeType === "Container" && node.normalizedName === "离心容器"
        )
      ).toBe(true);
      expect(
        clarifications.some((clarification: { question: string }) =>
          clarification.question.includes("操作缺少")
        )
      ).toBe(true);
      expect(meta.stats.opCount).toBe(4);
      expect(meta.version).toBe(packageVersion);
      expect(meta.stats.nodeCount).toBe(nodes.nodes.length);
      expect(meta.stats.clarificationCount).toBe(clarifications.length);
      expect(meta.stats.requirementCount).toBeGreaterThanOrEqual(10);
      expect(verification).toEqual(
        expect.objectContaining({
          overallAssessment: expect.stringMatching(/^(pass|warn|fail)$/),
          averageQuality: expect.any(Number),
          qualityScores: expect.any(Array),
          dedupResult: expect.any(Object),
          riskCoverage: expect.any(Object),
          traceability: expect.any(Object)
        })
      );
      expect(verification.qualityScores.length).toBe(meta.stats.requirementCount);
      expect(report).toContain("## Verification Report");
      expect(Object.keys(meta.stageDurations)).toEqual(
        expect.arrayContaining(["atomize", "hypergraph", "requirements", "infer", "review"])
      );
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
