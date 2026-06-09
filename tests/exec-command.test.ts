import { describe, expect, it } from "vitest";

import { resolveExecFileCommand } from "./helpers/exec-command";

describe("resolveExecFileCommand", () => {
  it("wraps npm and npx through cmd.exe on Windows", () => {
    const environment = { platform: "win32" as const, comspec: "C:\\Windows\\System32\\cmd.exe" };

    expect(resolveExecFileCommand("npm", ["run", "build"], environment)).toEqual({
      file: "C:\\Windows\\System32\\cmd.exe",
      args: ["/d", "/s", "/c", "npm", "run", "build"]
    });
    expect(resolveExecFileCommand("npx", ["tsx", "--version"], environment)).toEqual({
      file: "C:\\Windows\\System32\\cmd.exe",
      args: ["/d", "/s", "/c", "npx", "tsx", "--version"]
    });
  });

  it("wraps Windows command scripts through cmd.exe", () => {
    expect(resolveExecFileCommand("C:\\tmp\\autob.cmd", ["--help"], { platform: "win32" as const, comspec: "cmd.exe" })).toEqual({
      file: "cmd.exe",
      args: ["/d", "/s", "/c", "C:\\tmp\\autob.cmd", "--help"]
    });
  });

  it("keeps ordinary executables and non-Windows commands unchanged", () => {
    expect(resolveExecFileCommand("node", ["dist/cli.js"], { platform: "win32" as const, comspec: "cmd.exe" })).toEqual({
      file: "node",
      args: ["dist/cli.js"]
    });
    expect(resolveExecFileCommand("npm", ["run", "build"], { platform: "linux" as const })).toEqual({
      file: "npm",
      args: ["run", "build"]
    });
  });
});
