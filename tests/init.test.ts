import { Readable, Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createPromptSession, promptForProvider } from "../src/cli/wizard.js";

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
