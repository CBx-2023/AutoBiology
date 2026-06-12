import { execFile } from "node:child_process";
import type { ExecFileException } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Writable } from "node:stream";
import { VERSION } from "./version.js";

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  checkedAt: string;
}

export interface UpdateCheckCache extends UpdateCheckResult {
  packageName: string;
}

export interface SelfUpdateResult {
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}

export interface CacheOptions {
  homeDir?: string;
  now?: Date;
  ttlMs?: number;
}

export interface FetchLatestVersionOptions {
  fetchFn?: typeof fetch;
  packageName?: string;
  registryUrl?: string;
  timeoutMs?: number;
}

export interface CheckForUpdateOptions extends CacheOptions, FetchLatestVersionOptions {
  currentVersion?: string;
}

export type ExecFileFn = (
  file: string,
  args: string[],
  callback: (error: ExecFileException | null, stdout: string | Buffer, stderr: string | Buffer) => void
) => void;

export interface SelfUpdateOptions {
  execFileFn?: ExecFileFn;
  packageName?: string;
}

const PACKAGE_NAME = "autobiology-cli";
const UPDATE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;

export async function readCache(options: CacheOptions = {}): Promise<UpdateCheckCache | undefined> {
  try {
    const parsed = JSON.parse(await readFile(cachePath(options), "utf8")) as unknown;
    const cache = normalizeCache(parsed);
    if (!cache) return undefined;
    const now = options.now ?? new Date();
    const ttlMs = options.ttlMs ?? UPDATE_CACHE_TTL_MS;
    if (now.getTime() - Date.parse(cache.checkedAt) > ttlMs) return undefined;
    return cache;
  } catch {
    return undefined;
  }
}

export async function writeCache(cache: UpdateCheckCache, options: CacheOptions = {}): Promise<void> {
  const filePath = cachePath(options);
  await mkdir(join(options.homeDir ?? homedir(), ".autob"), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

export async function fetchLatestVersion(options: FetchLatestVersionOptions = {}): Promise<string | undefined> {
  const packageName = options.packageName ?? PACKAGE_NAME;
  const registryUrl = options.registryUrl ?? "https://registry.npmjs.org";
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;

  try {
    const response = await fetchFn(`${registryUrl.replace(/\/$/, "")}/${packageName}/latest`, {
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) return undefined;
    const payload = (await response.json()) as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
    const version = (payload as { version?: unknown }).version;
    return typeof version === "string" && parseVersion(version) ? version : undefined;
  } catch {
    return undefined;
  }
}

export function compareVersions(left: string, right: string): -1 | 0 | 1 | undefined {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return undefined;

  for (let index = 0; index < 3; index += 1) {
    if (a[index] < b[index]) return -1;
    if (a[index] > b[index]) return 1;
  }
  return 0;
}

export function isNewerVersion(latestVersion: string, currentVersion: string): boolean {
  return compareVersions(currentVersion, latestVersion) === -1;
}

export async function checkForUpdate(options: CheckForUpdateOptions = {}): Promise<UpdateCheckResult | undefined> {
  try {
    const cached = await readCache(options);
    if (cached) return cached.updateAvailable ? stripCacheFields(cached) : undefined;

    const currentVersion = options.currentVersion ?? VERSION;
    const latestVersion = await fetchLatestVersion(options);
    if (!latestVersion) return undefined;

    const updateAvailable = isNewerVersion(latestVersion, currentVersion);
    const result: UpdateCheckCache = {
      packageName: options.packageName ?? PACKAGE_NAME,
      currentVersion,
      latestVersion,
      updateAvailable,
      checkedAt: (options.now ?? new Date()).toISOString()
    };
    await writeCache(result, options).catch(() => undefined);
    return updateAvailable ? stripCacheFields(result) : undefined;
  } catch {
    return undefined;
  }
}

export function printUpdateNotice(result: UpdateCheckResult | undefined, output: Writable = process.stderr): void {
  if (!result?.updateAvailable) return;
  const command = "npm install -g autobiology-cli@latest";
  const lines = [
    `AutoBiology update available: ${result.currentVersion} -> ${result.latestVersion}`,
    `Run: ${command}`
  ];
  const width = Math.max(...lines.map((line) => line.length));
  output.write(
    [
      `+${"-".repeat(width + 2)}+`,
      ...lines.map((line) => `| ${line.padEnd(width)} |`),
      `+${"-".repeat(width + 2)}+`,
      ""
    ].join("\n")
  );
}

export async function runSelfUpdate(options: SelfUpdateOptions = {}): Promise<SelfUpdateResult> {
  const packageName = options.packageName ?? PACKAGE_NAME;
  const execFileFn = options.execFileFn ?? execFile;
  try {
    const { stdout, stderr } = await execFilePromise(execFileFn, "npm", ["install", "-g", `${packageName}@latest`]);
    return { success: true, stdout, stderr };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; message?: string };
    return {
      success: false,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? "",
      error: failure.message ?? "self update failed"
    };
  }
}

function cachePath(options: CacheOptions): string {
  return join(options.homeDir ?? homedir(), ".autob", "update-check.json");
}

function normalizeCache(value: unknown): UpdateCheckCache | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const cache = value as Partial<UpdateCheckCache>;
  if (cache.packageName !== PACKAGE_NAME) return undefined;
  if (!isString(cache.currentVersion) || !isString(cache.latestVersion) || !isString(cache.checkedAt)) return undefined;
  if (typeof cache.updateAvailable !== "boolean") return undefined;
  if (!parseVersion(cache.currentVersion) || !parseVersion(cache.latestVersion) || Number.isNaN(Date.parse(cache.checkedAt))) {
    return undefined;
  }
  return {
    packageName: cache.packageName,
    currentVersion: cache.currentVersion,
    latestVersion: cache.latestVersion,
    updateAvailable: cache.updateAvailable,
    checkedAt: cache.checkedAt
  };
}

function stripCacheFields(cache: UpdateCheckCache): UpdateCheckResult {
  return {
    currentVersion: cache.currentVersion,
    latestVersion: cache.latestVersion,
    updateAvailable: cache.updateAvailable,
    checkedAt: cache.checkedAt
  };
}

function parseVersion(version: string): [number, number, number] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function execFilePromise(execFileFn: ExecFileFn, file: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFileFn(file, args, (error, stdout, stderr) => {
      if (error) {
        reject({
          message: error.message,
          stdout: bufferToString(stdout),
          stderr: bufferToString(stderr)
        });
        return;
      }
      resolve({ stdout: bufferToString(stdout), stderr: bufferToString(stderr) });
    });
  });
}

function bufferToString(value: string | Buffer | undefined): string {
  return typeof value === "string" ? value : value?.toString() ?? "";
}
