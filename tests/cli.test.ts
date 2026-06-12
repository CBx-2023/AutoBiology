import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Writable } from "node:stream";
import { createProgram, runCliEntrypoint } from "../src/cli.js";
import type { UpdateCheckResult } from "../src/update-checker.js";

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

  it("starts update checking before entrypoint command actions and prints notice after parse", async () => {
    let updateStarted = false;
    let configRendered = false;
    const stdout = createSink();
    const stderr = createSink();

    await runCliEntrypoint(["node", "autob", "config", "show"], {
      configShow: async () => {
        expect(updateStarted).toBe(true);
        configRendered = true;
        return "rendered config\n";
      },
      updateCheck: async () => {
        updateStarted = true;
        while (!configRendered) await new Promise((resolve) => setTimeout(resolve, 0));
        return updateResult();
      },
      output: stdout,
      errorOutput: stderr
    });

    expect(stdout.text).toBe("rendered config\n");
    expect(stderr.text).toContain("AutoBiology update available");
  });

  it("registers update --check without running self update", async () => {
    let selfUpdateCalled = false;
    const stderr = createSink();
    const program = createProgram({
      updateCheck: async () => updateResult(),
      selfUpdate: async () => {
        selfUpdateCalled = true;
        return { success: true, stdout: "updated", stderr: "" };
      },
      errorOutput: stderr
    });

    expect(program.helpInformation()).toContain("update");

    await program.parseAsync(["node", "autob", "update", "--check"]);

    expect(selfUpdateCalled).toBe(false);
    expect(stderr.text).toContain("npm install -g autobiology-cli@latest");
  });

  it("runs self update from the update command", async () => {
    let selfUpdateCalled = false;
    const stdout = createSink();
    const program = createProgram({
      selfUpdate: async () => {
        selfUpdateCalled = true;
        return { success: true, stdout: "updated", stderr: "" };
      },
      output: stdout
    });

    await program.parseAsync(["node", "autob", "update"]);

    expect(selfUpdateCalled).toBe(true);
    expect(stdout.text).toContain("updated");
    expect(stdout.text).toContain("AutoBiology CLI update completed.");
  });
});

function updateResult(): UpdateCheckResult {
  return {
    currentVersion: "0.1.0",
    latestVersion: "0.2.0",
    updateAvailable: true,
    checkedAt: "2026-06-12T00:00:00.000Z"
  };
}

function createSink(): Writable & { text: string } {
  let text = "";
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      text += chunk.toString();
      callback();
    }
  }) as Writable & { text: string };
  Object.defineProperty(sink, "text", { get: () => text });
  return sink;
}
