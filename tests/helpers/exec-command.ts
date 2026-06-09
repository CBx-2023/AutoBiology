import { execFile } from "node:child_process";
import { extname } from "node:path";
import { promisify } from "node:util";
import type { ExecFileOptions } from "node:child_process";

const rawExecFileAsync = promisify(execFile);

type Platform = NodeJS.Platform;

type CommandEnvironment = {
  platform?: Platform;
  comspec?: string;
};

type ResolvedCommand = {
  file: string;
  args: string[];
};

const WINDOWS_SHELL_COMMANDS = new Set(["npm", "npx"]);

export function resolveExecFileCommand(command: string, args: readonly string[] = [], environment: CommandEnvironment = {}): ResolvedCommand {
  const platform = environment.platform ?? process.platform;
  if (platform !== "win32" || !needsWindowsShell(command)) {
    return { file: command, args: [...args] };
  }

  return {
    file: environment.comspec ?? process.env.ComSpec ?? "cmd.exe",
    args: ["/d", "/s", "/c", command, ...args]
  };
}

export async function execCommand(command: string, args: readonly string[] = [], options: ExecFileOptions = {}) {
  const resolved = resolveExecFileCommand(command, args);
  return rawExecFileAsync(resolved.file, resolved.args, options);
}

function needsWindowsShell(command: string): boolean {
  const extension = extname(command).toLowerCase();
  return WINDOWS_SHELL_COMMANDS.has(command.toLowerCase()) || extension === ".cmd" || extension === ".bat";
}
