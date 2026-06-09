import { describe, expect, it } from "vitest";
import {
  createLlmClientFromEnv,
  describeLlmConfig,
  resolveLlmConfigFromEnv
} from "../src/config.js";
import { OpenAiCompatibleLlmClient } from "../src/llm/client.js";

describe("LLM env configuration", () => {
  it("creates an OpenAI-compatible client from explicit AutoBiology env without exposing the API key", () => {
    const env = {
      AUTOBIO_LLM_API_KEY: "secret-test-key",
      AUTOBIO_LLM_BASE_URL: "https://llm.example/v1",
      AUTOBIO_LLM_MODEL: "model-x"
    };

    const config = resolveLlmConfigFromEnv(env);
    const client = createLlmClientFromEnv(env);
    const description = describeLlmConfig(config);

    expect(config?.model).toBe("model-x");
    expect(client).toBeInstanceOf(OpenAiCompatibleLlmClient);
    expect(description).toContain("model-x");
    expect(description).not.toContain("secret-test-key");
  });

  it("returns undefined when no supported API key is configured", () => {
    expect(resolveLlmConfigFromEnv({})).toBeUndefined();
    expect(createLlmClientFromEnv({})).toBeUndefined();
  });
});
