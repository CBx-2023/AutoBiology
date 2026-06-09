import { describe, expect, it } from "vitest";
import { createProgram } from "../src/cli.js";

describe("CLI registration", () => {
  it("uses autob as the program name", () => {
    const help = createProgram().helpInformation();

    expect(help).toContain("Usage: autob");
    expect(help).not.toContain("Usage: autobio");
  });
});
