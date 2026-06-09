import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeGlobalConfig, normalizeProjectConfig, readGlobalConfig, readProjectConfig } from "../src/config.js";

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

describe("project JSON configuration", () => {
  it("reads .autob.json when present", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "autob-project-config-"));

    try {
      await writeFile(
        join(cwd, ".autob.json"),
        JSON.stringify({
          llm: {
            provider: "custom",
            baseUrl: "https://llm.example/v1",
            model: "project-model",
            timeoutMs: 12_000
          }
        }),
        "utf8"
      );

      const config = await readProjectConfig({ cwd });

      expect(config.llm).toEqual({
        provider: "custom",
        baseUrl: "https://llm.example/v1",
        model: "project-model",
        timeoutMs: 12_000
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("returns an empty config when .autob.json is missing", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "autob-project-config-missing-"));

    try {
      await expect(readProjectConfig({ cwd })).resolves.toEqual({});
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("rejects apiKey values read from .autob.json", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "autob-project-config-secret-"));

    try {
      await writeFile(
        join(cwd, ".autob.json"),
        JSON.stringify({
          llm: {
            apiKey: "project-api-key",
            model: "project-model"
          }
        }),
        "utf8"
      );

      await expect(readProjectConfig({ cwd })).rejects.toThrow(/apiKey/i);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
