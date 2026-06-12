import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Writable } from "node:stream";
import { createProgram } from "../src/cli.js";

const packageVersion = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

describe("CLI registration", () => {
  it("uses autob as the program name", () => {
    const help = createProgram().helpInformation();

    expect(help).toContain("Usage: autob");
    expect(help).not.toContain("Usage: autobio");
  });

  it("uses the package version for the command version", () => {
    expect(createProgram().version()).toBe(packageVersion);
  });

  it("registers init command and delegates to the wizard", async () => {
    let called = false;
    const program = createProgram({
      initWizard: async () => {
        called = true;
      }
    });

    expect(program.helpInformation()).toContain("init");

    await program.parseAsync(["node", "autob", "init"]);

    expect(called).toBe(true);
  });

  it("registers config show command and writes rendered config", async () => {
    let output = "";
    const program = createProgram({
      configShow: async () => "rendered config\n",
      output: new Writable({
        write(chunk, _encoding, callback) {
          output += chunk.toString();
          callback();
        }
      })
    });

    expect(program.helpInformation()).toContain("config");

    await program.parseAsync(["node", "autob", "config", "show"]);

    expect(output).toBe("rendered config\n");
  });
});
