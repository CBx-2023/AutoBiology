import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { execCommand } from "./helpers/exec-command";

const packageCliTimeoutMs = 30_000;
const npmSmokeEnv = { ...process.env, npm_config_dry_run: "false" };

describe("packaged CLI", () => {
  it("builds the package bin target and runs help from emitted JavaScript", async () => {
    await execCommand("npm", ["run", "build"], { cwd: process.cwd(), timeout: 20_000 });
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as { bin: { autob: string; autobio?: string } };
    const binPath = join(process.cwd(), packageJson.bin.autob);

    expect(packageJson.bin.autobio).toBeUndefined();
    const { stdout } = await execCommand("node", [binPath, "--help"], { cwd: process.cwd(), timeout: 20_000 });

    expect(stdout).toContain("run");
    expect(stdout).toContain("atomize");
    expect(stdout).toContain("review");
  }, packageCliTimeoutMs);

  it("installs the packed tarball and runs the npm bin through the package symlink", async () => {
    const packageDir = await mkdtemp(join(tmpdir(), "autobio-pack-"));
    const prefixDir = join(packageDir, "prefix");

    try {
      await execCommand("npm", ["run", "build"], { cwd: process.cwd(), timeout: 20_000 });
      const { stdout: packStdout } = await execCommand("npm", ["pack", "--pack-destination", packageDir], {
        cwd: process.cwd(),
        env: npmSmokeEnv,
        timeout: 20_000
      });
      const tarballName = packStdout.trim().split(/\r?\n/).at(-1);
      if (!tarballName) throw new Error("npm pack did not report a tarball name");

      await mkdir(prefixDir, { recursive: true });
      await execCommand("npm", ["install", "--prefix", prefixDir, join(packageDir, tarballName)], {
        cwd: process.cwd(),
        env: npmSmokeEnv,
        timeout: 20_000
      });
      const binPath = join(prefixDir, "node_modules", ".bin", process.platform === "win32" ? "autob.cmd" : "autob");

      const { stdout } = await execCommand(binPath, ["--help"], { cwd: process.cwd(), timeout: 20_000 });

      expect(stdout).toContain("run");
      expect(stdout).toContain("atomize");
      expect(stdout).toContain("review");
    } finally {
      await rm(packageDir, { recursive: true, force: true });
    }
  }, packageCliTimeoutMs);
});
