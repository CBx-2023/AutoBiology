import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeGlobalConfig, normalizeProjectConfig, readGlobalConfig } from "../src/config.js";

describe("JSON configuration contracts", () => {
  it("accepts global LLM configuration fields", () => {
    const config = normalizeGlobalConfig({
      llm: {
        provider: "deepseek",
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: "test-api-key",
        model: "deepseek-chat",
        timeoutMs: 45_000
      }
    });

    expect(config.llm).toEqual({
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "test-api-key",
      model: "deepseek-chat",
      timeoutMs: 45_000
    });
  });

  it("rejects API keys in project configuration", () => {
    expect(() =>
      normalizeProjectConfig({
        llm: {
          apiKey: "project-secret",
          model: "project-model"
        }
      })
    ).toThrow(/apiKey/i);
  });
});

describe("global JSON configuration", () => {
  it("reads ~/.autob/config.json when present", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "autob-global-config-"));

    try {
      await mkdir(join(homeDir, ".autob"), { recursive: true });
      await writeFile(
        join(homeDir, ".autob", "config.json"),
        JSON.stringify({
          llm: {
            provider: "openai",
            baseUrl: "https://api.openai.com/v1",
            apiKey: "global-api-key",
            model: "gpt-4o-mini"
          }
        }),
        "utf8"
      );

      const config = await readGlobalConfig({ homeDir });

      expect(config.llm?.provider).toBe("openai");
      expect(config.llm?.apiKey).toBe("global-api-key");
      expect(config.llm?.model).toBe("gpt-4o-mini");
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  it("returns an empty config when ~/.autob/config.json is missing", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "autob-global-config-missing-"));

    try {
      await expect(readGlobalConfig({ homeDir })).resolves.toEqual({});
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });
});
