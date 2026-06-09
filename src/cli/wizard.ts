import { createInterface } from "node:readline/promises";
import type { LlmProvider } from "../config.js";

export interface PromptSession {
  ask(question: string): Promise<string>;
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
