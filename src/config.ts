import { OpenAiCompatibleLlmClient, type LlmClient, type OpenAiCompatibleLlmConfig } from "./llm/client.js";

export function resolveLlmConfigFromEnv(env: Record<string, string | undefined> = process.env): OpenAiCompatibleLlmConfig | undefined {
  const apiKey = firstPresent(env.AUTOBIO_LLM_API_KEY, env.DEEPSEEK_API_KEY, env.OPENAI_API_KEY);
  if (!apiKey) return undefined;

  const provider = env.OPENAI_API_KEY && !env.DEEPSEEK_API_KEY ? "openai" : "deepseek";
  const baseUrl =
    env.AUTOBIO_LLM_BASE_URL ??
    env.DEEPSEEK_BASE_URL ??
    env.OPENAI_BASE_URL ??
    (provider === "openai" ? "https://api.openai.com/v1" : "https://api.deepseek.com/v1");
  const model = env.AUTOBIO_LLM_MODEL ?? env.DEEPSEEK_MODEL ?? env.OPENAI_MODEL ?? (provider === "openai" ? "gpt-4o-mini" : "deepseek-chat");
  const timeoutMs = parsePositiveInteger(env.AUTOBIO_LLM_TIMEOUT_MS);

  return {
    baseUrl,
    apiKey,
    model,
    ...(timeoutMs ? { timeoutMs } : {})
  };
}

export function createLlmClientFromEnv(env: Record<string, string | undefined> = process.env): LlmClient | undefined {
  const config = resolveLlmConfigFromEnv(env);
  return config ? new OpenAiCompatibleLlmClient(config) : undefined;
}

export function describeLlmConfig(config: OpenAiCompatibleLlmConfig | undefined): string {
  if (!config) return "LLM not configured";
  return `LLM configured: model=${config.model}; baseUrl=${config.baseUrl}; apiKey=present`;
}

function firstPresent(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => Boolean(value?.trim()));
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
