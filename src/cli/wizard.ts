import { createInterface } from "node:readline/promises";
import type { LlmProvider } from "../config.js";

export interface PromptSession {
  ask(question: string): Promise<string>;
  write(message: string): void;
  close(): void;
}

export interface ProviderSelection {
  provider: LlmProvider;
  baseUrl: string;
  model: string;
}

const PROVIDER_PRESETS: Record<LlmProvider, ProviderSelection> = {
  deepseek: {
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat"
  },
  openai: {
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini"
  },
  custom: {
    provider: "custom",
    baseUrl: "",
    model: ""
  }
};

export const DEFAULT_TIMEOUT_MS = 30_000;

export function createPromptSession(options: {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
} = {}): PromptSession {
  const rl = createInterface({
    input: options.input ?? process.stdin,
    output: options.output ?? process.stdout,
    terminal: isTty(options.input ?? process.stdin)
  });

  return {
    async ask(question: string): Promise<string> {
      return (await rl.question(question)).trim();
    },
    write(message: string): void {
      (options.output ?? process.stdout).write(message);
    },
    close(): void {
      rl.close();
    }
  };
}

export async function promptForProvider(session: PromptSession): Promise<ProviderSelection> {
  const answer = await session.ask("LLM provider [1=DeepSeek, 2=OpenAI, 3=Custom] (1): ");
  const provider = normalizeProviderChoice(answer);
  return { ...PROVIDER_PRESETS[provider] };
}

export async function promptForApiKey(session: PromptSession): Promise<string> {
  const apiKey = await session.ask("API key (stored in ~/.autob/config.json): ");
  session.write(`API key: ${redactApiKey(apiKey)}\n`);
  return apiKey;
}

export function redactApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 4) return "****";
  return `${"*".repeat(Math.max(4, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

export async function promptForModel(session: PromptSession, defaultModel: string): Promise<string> {
  const answer = await session.ask(`Model (${defaultModel || "required"}): `);
  return answer || defaultModel;
}

export async function promptForTimeoutMs(session: PromptSession, defaultTimeoutMs = DEFAULT_TIMEOUT_MS): Promise<number> {
  const answer = await session.ask(`Timeout in milliseconds (${defaultTimeoutMs}): `);
  const parsed = Number.parseInt(answer, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultTimeoutMs;
}

export async function promptForBaseUrl(session: PromptSession, provider: ProviderSelection): Promise<string> {
  if (provider.provider !== "custom") return provider.baseUrl;
  const answer = await session.ask("Custom OpenAI-compatible base URL: ");
  return answer || provider.baseUrl;
}

function isTty(input: NodeJS.ReadableStream): boolean {
  return "isTTY" in input && Boolean(input.isTTY);
}

function normalizeProviderChoice(value: string): LlmProvider {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "1" || normalized === "deepseek") return "deepseek";
  if (normalized === "2" || normalized === "openai") return "openai";
  if (normalized === "3" || normalized === "custom") return "custom";
  return "deepseek";
}
