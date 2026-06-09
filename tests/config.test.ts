import { describe, expect, it } from "vitest";
import { normalizeGlobalConfig, normalizeProjectConfig } from "../src/config.js";

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
