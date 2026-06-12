import { readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PROMPT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../data/prompts");
const SAFE_TEMPLATE_NAME = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

export function loadPromptTemplate(templateName: string, promptDir = DEFAULT_PROMPT_DIR): string {
  if (!SAFE_TEMPLATE_NAME.test(templateName)) {
    throw new Error(`Unsafe prompt template name: ${templateName}`);
  }

  const root = resolve(promptDir);
  const filePath = resolve(root, `${templateName}.md`);
  if (!isInsideDirectory(filePath, root)) {
    throw new Error(`Unsafe prompt template path: ${templateName}`);
  }

  try {
    return readFileSync(filePath, "utf8");
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Unable to load prompt template ${templateName}: ${detail}`);
  }
}

export function renderPrompt(template: string, variables: Record<string, string>): string {
  return template.replace(/{{\s*([A-Za-z0-9_]+)\s*}}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match
  );
}

function isInsideDirectory(filePath: string, directory: string): boolean {
  const normalizedDirectory = directory.endsWith(sep) ? directory : `${directory}${sep}`;
  return filePath.startsWith(normalizedDirectory);
}
