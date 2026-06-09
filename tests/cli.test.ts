import { describe, expect, it } from "vitest";
import { createProgram } from "../src/cli.js";

describe("CLI registration", () => {
  it("uses autob as the program name", () => {
    const help = createProgram().helpInformation();

    expect(help).toContain("Usage: autob");
    expect(help).not.toContain("Usage: autobio");
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
});
