import { Readable, Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMEOUT_MS,
  createPromptSession,
  promptForApiKey,
  promptForBaseUrl,
  promptForModel,
  promptForProvider,
  promptForTimeoutMs,
  redactApiKey
} from "../src/cli/wizard.js";

describe("init wizard prompt utilities", () => {
  it("reads scripted answers and closes the readline interface", async () => {
    let output = "";
    const input = Readable.from(["  answer  \n"]);
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      }
    });

    const session = createPromptSession({ input, output: sink });

    const answer = await session.ask("Question? ");
    session.close();

    expect(answer).toBe("answer");
    expect(output).toContain("Question?");
  });
});

describe("init wizard provider selection", () => {
  it("maps OpenAI selection to provider defaults", async () => {
    const session = createPromptSession({ input: Readable.from(["2\n"]), output: new Writable({ write(_chunk, _encoding, callback) { callback(); } }) });

    const provider = await promptForProvider(session);
    session.close();

    expect(provider).toEqual({
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini"
    });
  });

  it("maps Custom selection without provider defaults", async () => {
    const session = createPromptSession({ input: Readable.from(["3\n"]), output: new Writable({ write(_chunk, _encoding, callback) { callback(); } }) });

    const provider = await promptForProvider(session);
    session.close();

    expect(provider).toEqual({
      provider: "custom",
      baseUrl: "",
      model: ""
    });
  });
});

describe("init wizard API key handling", () => {
  it("returns the entered API key without printing it in full", async () => {
    const apiKey = ["secret", "api", "key", "1234"].join("-");
    let output = "";
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      }
    });
    const session = createPromptSession({ input: Readable.from([`${apiKey}\n`]), output: sink });

    const capturedApiKey = await promptForApiKey(session);
    session.close();

    expect(capturedApiKey).toBe(apiKey);
    expect(output).toContain(redactApiKey(apiKey));
    expect(output).not.toContain(apiKey);
  });
});

describe("init wizard model and timeout prompts", () => {
  it("uses provider default model when model input is blank", async () => {
    const session = createPromptSession({ input: Readable.from(["\n"]), output: new Writable({ write(_chunk, _encoding, callback) { callback(); } }) });

    const model = await promptForModel(session, "deepseek-chat");
    session.close();

    expect(model).toBe("deepseek-chat");
  });

  it("falls back to default timeout when input is invalid", async () => {
    const session = createPromptSession({ input: Readable.from(["not-a-number\n"]), output: new Writable({ write(_chunk, _encoding, callback) { callback(); } }) });

    const timeoutMs = await promptForTimeoutMs(session);
    session.close();

    expect(timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
  });
});

describe("init wizard base URL prompt", () => {
  it("prompts for custom provider base URL", async () => {
    const session = createPromptSession({ input: Readable.from(["https://custom.example/v1\n"]), output: new Writable({ write(_chunk, _encoding, callback) { callback(); } }) });

    const baseUrl = await promptForBaseUrl(session, { provider: "custom", baseUrl: "", model: "" });
    session.close();

    expect(baseUrl).toBe("https://custom.example/v1");
  });

  it("uses provider default base URL without prompting for built-in providers", async () => {
    const session = createPromptSession({ input: Readable.from([]), output: new Writable({ write(_chunk, _encoding, callback) { callback(); } }) });

    const baseUrl = await promptForBaseUrl(session, {
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat"
    });
    session.close();

    expect(baseUrl).toBe("https://api.deepseek.com/v1");
  });
});
