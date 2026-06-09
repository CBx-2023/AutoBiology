import { Readable, Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createPromptSession } from "../src/cli/wizard.js";

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
