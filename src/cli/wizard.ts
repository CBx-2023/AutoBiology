import { createInterface } from "node:readline/promises";

export interface PromptSession {
  ask(question: string): Promise<string>;
  close(): void;
}

export function createPromptSession(options: {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
} = {}): PromptSession {
  const rl = createInterface({
    input: options.input ?? process.stdin,
    output: options.output ?? process.stdout,
    terminal: isTty(options.input ?? process.stdin)
  });

  return {
    async ask(question: string): Promise<string> {
      return (await rl.question(question)).trim();
    },
    close(): void {
      rl.close();
    }
  };
}

function isTty(input: NodeJS.ReadableStream): boolean {
  return "isTTY" in input && Boolean(input.isTTY);
}
