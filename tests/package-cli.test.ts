import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("packaged CLI", () => {
  it("builds the package bin target and runs help from emitted JavaScript", async () => {
    await execFileAsync("npm", ["run", "build"], { cwd: process.cwd(), timeout: 20_000 });
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as { bin: { autobio: string } };
    const binPath = join(process.cwd(), packageJson.bin.autobio);

    const { stdout } = await execFileAsync("node", [binPath, "--help"], { cwd: process.cwd(), timeout: 20_000 });

    expect(stdout).toContain("run");
    expect(stdout).toContain("atomize");
    expect(stdout).toContain("review");
  });
});
