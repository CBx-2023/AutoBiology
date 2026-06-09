export interface LlmClient {
  complete(prompt: string): Promise<string>;
}

export interface OpenAiCompatibleLlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

export interface RetryOptions {
  retries?: number;
}

export class OpenAiCompatibleLlmClient implements LlmClient {
  constructor(private readonly config: OpenAiCompatibleLlmConfig) {}

  async complete(prompt: string): Promise<string> {
    const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 30_000)
    });

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM response did not include message content");
    return content;
  }
}

export async function completeWithRetry(client: LlmClient, prompt: string, options: RetryOptions = {}): Promise<string> {
  const attempts = (options.retries ?? 2) + 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await client.complete(prompt);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("LLM request failed");
}
