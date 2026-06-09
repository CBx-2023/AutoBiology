import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { OpenAiCompatibleLlmClient, type LlmClient, type OpenAiCompatibleLlmConfig } from "./llm/client.js";

export type LlmProvider = "deepseek" | "openai" | "custom";

export interface GlobalConfig {
  llm?: {
    provider?: LlmProvider;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    timeoutMs?: number;
  };
}

export interface ProjectConfig {
  llm?: {
    provider?: LlmProvider;
    baseUrl?: string;
    model?: string;
    timeoutMs?: number;
  };
}

export function normalizeGlobalConfig(input: unknown): GlobalConfig {
  const config = asConfigObject(input, "global config");
  return normalizeConfig(config, { allowApiKey: true });
}

export function normalizeProjectConfig(input: unknown): ProjectConfig {
  const config = asConfigObject(input, "project config");
  return normalizeConfig(config, { allowApiKey: false }) as ProjectConfig;
}

export async function readGlobalConfig(options: { homeDir?: string } = {}): Promise<GlobalConfig> {
  const filePath = join(options.homeDir ?? homedir(), ".autob", "config.json");
  try {
    return normalizeGlobalConfig(JSON.parse(await readFile(filePath, "utf8")));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return {};
    throw error;
  }
}

export async function readProjectConfig(options: { cwd?: string } = {}): Promise<ProjectConfig> {
  const filePath = join(options.cwd ?? process.cwd(), ".autob.json");
  try {
    return normalizeProjectConfig(JSON.parse(await readFile(filePath, "utf8")));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return {};
    throw error;
  }
}

export async function loadConfig(options: { homeDir?: string; cwd?: string } = {}): Promise<GlobalConfig> {
  const [globalConfig, projectConfig] = await Promise.all([
    readGlobalConfig({ homeDir: options.homeDir }),
    readProjectConfig({ cwd: options.cwd })
  ]);
  return mergeConfig(globalConfig, projectConfig);
}

export function mergeConfig(globalConfig: GlobalConfig, projectConfig: ProjectConfig): GlobalConfig {
  return {
    llm: {
      ...globalConfig.llm,
      ...projectConfig.llm,
      ...(globalConfig.llm?.apiKey ? { apiKey: globalConfig.llm.apiKey } : {})
    }
  };
}

export function resolveLlmConfigFromConfig(config: GlobalConfig): OpenAiCompatibleLlmConfig | undefined {
  const llm = config.llm;
  if (!llm?.apiKey || !llm.baseUrl || !llm.model) return undefined;
  return {
    apiKey: llm.apiKey,
    baseUrl: llm.baseUrl,
    model: llm.model,
    ...(llm.timeoutMs ? { timeoutMs: llm.timeoutMs } : {})
  };
}

export function createLlmClientFromConfig(config: GlobalConfig): LlmClient | undefined {
  const llmConfig = resolveLlmConfigFromConfig(config);
  return llmConfig ? new OpenAiCompatibleLlmClient(llmConfig) : undefined;
}

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

function normalizeConfig(input: Record<string, unknown>, options: { allowApiKey: boolean }): GlobalConfig {
  const llm = input.llm === undefined ? undefined : asConfigObject(input.llm, "llm config");
  if (!llm) return {};

  if (!options.allowApiKey && llm.apiKey !== undefined) {
    throw new Error("Project config must not include llm.apiKey; store API keys in ~/.autob/config.json");
  }

  const config: GlobalConfig = { llm: {} };
  if (llm.provider !== undefined) config.llm!.provider = normalizeProvider(llm.provider);
  if (llm.baseUrl !== undefined) config.llm!.baseUrl = normalizeString(llm.baseUrl, "llm.baseUrl");
  if (llm.apiKey !== undefined) config.llm!.apiKey = normalizeString(llm.apiKey, "llm.apiKey");
  if (llm.model !== undefined) config.llm!.model = normalizeString(llm.model, "llm.model");
  if (llm.timeoutMs !== undefined) config.llm!.timeoutMs = normalizeTimeout(llm.timeoutMs);
  return config;
}

function asConfigObject(input: unknown, label: string): Record<string, unknown> {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`Invalid ${label}: expected object`);
  }
  return input as Record<string, unknown>;
}

function normalizeProvider(value: unknown): LlmProvider {
  if (value === "deepseek" || value === "openai" || value === "custom") return value;
  throw new Error("Invalid llm.provider: expected deepseek, openai, or custom");
}

function normalizeString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid ${label}: expected non-empty string`);
  }
  return value.trim();
}

function normalizeTimeout(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error("Invalid llm.timeoutMs: expected positive integer");
  }
  return value;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
