import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import type { ExecFileException } from "node:child_process";
import type { UpdateCheckCache, UpdateCheckResult } from "../src/update-checker.js";
import {
  checkForUpdate,
  compareVersions,
  fetchLatestVersion,
  isNewerVersion,
  printUpdateNotice,
  readCache,
  runSelfUpdate,
  writeCache
} from "../src/update-checker.js";

describe("update checker contracts", () => {
  it("exposes stable result and cache contracts", () => {
    const result: UpdateCheckResult = {
      currentVersion: "0.1.0",
      latestVersion: "0.2.0",
      updateAvailable: true,
      checkedAt: "2026-06-12T00:00:00.000Z"
    };
    const cache: UpdateCheckCache = { ...result, packageName: "autobiology-cli" };

    expect(cache.currentVersion).toBe("0.1.0");
    expect(cache.latestVersion).toBe("0.2.0");
    expect(cache.updateAvailable).toBe(true);
    expect(cache.packageName).toBe("autobiology-cli");
  });
});

describe("update cache", () => {
  it("reads and writes ~/.autob/update-check.json with a 24h TTL", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "autob-update-cache-"));
    const now = new Date("2026-06-12T12:00:00.000Z");
    try {
      const cache: UpdateCheckCache = {
        packageName: "autobiology-cli",
        currentVersion: "0.1.0",
        latestVersion: "0.2.0",
        updateAvailable: true,
        checkedAt: now.toISOString()
      };

      await writeCache(cache, { homeDir });

      expect(JSON.parse(await readFile(join(homeDir, ".autob", "update-check.json"), "utf8"))).toMatchObject(cache);
      expect(await readCache({ homeDir, now: new Date("2026-06-13T11:59:59.000Z") })).toMatchObject(cache);
      expect(await readCache({ homeDir, now: new Date("2026-06-13T12:00:01.000Z") })).toBeUndefined();
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  it("returns undefined for missing or malformed cache files", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "autob-update-cache-bad-"));
    try {
      expect(await readCache({ homeDir })).toBeUndefined();
      await writeFile(join(homeDir, ".autob", "update-check.json"), "{not-json", "utf8").catch(async () => {
        await writeCache(
          {
            packageName: "autobiology-cli",
            currentVersion: "0.1.0",
            latestVersion: "0.2.0",
            updateAvailable: true,
            checkedAt: new Date().toISOString()
          },
          { homeDir }
        );
        await writeFile(join(homeDir, ".autob", "update-check.json"), "{not-json", "utf8");
      });
      expect(await readCache({ homeDir })).toBeUndefined();
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });
});

describe("registry version fetch and semver comparison", () => {
  it("fetches the latest npm package version from the registry", async () => {
    const calls: Array<{ url: string; timeoutMs?: number }> = [];
    const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), timeoutMs: init?.signal ? 3000 : undefined });
      return new Response(JSON.stringify({ version: "0.2.0" }), { status: 200 });
    };

    await expect(fetchLatestVersion({ fetchFn })).resolves.toBe("0.2.0");
    expect(calls[0]?.url).toBe("https://registry.npmjs.org/autobiology-cli/latest");
  });

  it("returns undefined for invalid registry responses and fetch failures", async () => {
    await expect(fetchLatestVersion({ fetchFn: async () => new Response("{}", { status: 200 }) })).resolves.toBeUndefined();
    await expect(fetchLatestVersion({ fetchFn: async () => new Response("not found", { status: 404 }) })).resolves.toBeUndefined();
    await expect(fetchLatestVersion({ fetchFn: async () => { throw new Error("network down"); } })).resolves.toBeUndefined();
    await expect(fetchLatestVersion({ fetchFn: async () => { throw new DOMException("aborted", "AbortError"); } })).resolves.toBeUndefined();
  });

  it("compares major.minor.patch numerically and rejects malformed versions", () => {
    expect(compareVersions("0.1.9", "0.1.10")).toBe(-1);
    expect(compareVersions("1.2.0", "1.1.9")).toBe(1);
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
    expect(compareVersions("1.2", "1.2.3")).toBeUndefined();
    expect(isNewerVersion("0.1.10", "0.1.9")).toBe(true);
    expect(isNewerVersion("0.1.9", "0.1.10")).toBe(false);
    expect(isNewerVersion("bad", "0.1.0")).toBe(false);
  });
});

describe("checkForUpdate", () => {
  it("uses fresh cache without fetching and only returns update-available results", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "autob-update-check-cache-"));
    const now = new Date("2026-06-12T12:00:00.000Z");
    try {
      await writeCache(
        {
          packageName: "autobiology-cli",
          currentVersion: "0.1.0",
          latestVersion: "0.2.0",
          updateAvailable: true,
          checkedAt: now.toISOString()
        },
        { homeDir }
      );

      const result = await checkForUpdate({
        homeDir,
        currentVersion: "0.1.0",
        now: new Date("2026-06-12T13:00:00.000Z"),
        fetchFn: async () => {
          throw new Error("fetch should not be called");
        }
      });

      expect(result?.latestVersion).toBe("0.2.0");
      expect(result?.updateAvailable).toBe(true);
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  it("fetches after cache expiry, writes cache, and returns undefined when latest is not newer", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "autob-update-check-expired-"));
    const now = new Date("2026-06-12T12:00:00.000Z");
    let fetchCount = 0;
    try {
      await writeCache(
        {
          packageName: "autobiology-cli",
          currentVersion: "0.1.0",
          latestVersion: "0.2.0",
          updateAvailable: true,
          checkedAt: "2026-06-10T00:00:00.000Z"
        },
        { homeDir }
      );

      const noUpdate = await checkForUpdate({
        homeDir,
        currentVersion: "0.2.0",
        now,
        fetchFn: async () => {
          fetchCount += 1;
          return new Response(JSON.stringify({ version: "0.2.0" }), { status: 200 });
        }
      });

      expect(noUpdate).toBeUndefined();
      expect(fetchCount).toBe(1);
      expect(JSON.parse(await readFile(join(homeDir, ".autob", "update-check.json"), "utf8"))).toMatchObject({
        currentVersion: "0.2.0",
        latestVersion: "0.2.0",
        updateAvailable: false
      });
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  it("silently returns undefined on fetch failures", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "autob-update-check-fail-"));
    try {
      await expect(
        checkForUpdate({
          homeDir,
          currentVersion: "0.1.0",
          fetchFn: async () => {
            throw new Error("network down");
          }
        })
      ).resolves.toBeUndefined();
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });
});

describe("update notice and self update", () => {
  it("renders a boxed notice to stderr only when an update is available", () => {
    const output = createSink();
    printUpdateNotice(
      {
        currentVersion: "0.1.0",
        latestVersion: "0.2.0",
        updateAvailable: true,
        checkedAt: "2026-06-12T00:00:00.000Z"
      },
      output
    );
    printUpdateNotice(undefined, output);
    printUpdateNotice(
      {
        currentVersion: "0.2.0",
        latestVersion: "0.2.0",
        updateAvailable: false,
        checkedAt: "2026-06-12T00:00:00.000Z"
      },
      output
    );

    expect(output.text).toContain("AutoBiology update available");
    expect(output.text).toContain("0.1.0 -> 0.2.0");
    expect(output.text).toContain("npm install -g autobiology-cli@latest");
    expect(output.text.match(/AutoBiology update available/g)).toHaveLength(1);
  });

  it("runs npm install -g without shell interpolation and returns structured results", async () => {
    const calls: Array<{ file: string; args: string[] }> = [];
    const success = await runSelfUpdate({
      execFileFn: (file, args, callback) => {
        calls.push({ file, args });
        callback(null, "updated", "");
      }
    });
    const failure = await runSelfUpdate({
      execFileFn: (_file, _args, callback) => {
        callback(Object.assign(new Error("install failed"), { code: 1 }) as ExecFileException, "", "permission denied");
      }
    });

    expect(calls).toEqual([{ file: "npm", args: ["install", "-g", "autobiology-cli@latest"] }]);
    expect(success).toEqual({ success: true, stdout: "updated", stderr: "" });
    expect(failure.success).toBe(false);
    expect(failure.stderr).toContain("permission denied");
    expect(failure.error).toContain("install failed");
  });
});

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
