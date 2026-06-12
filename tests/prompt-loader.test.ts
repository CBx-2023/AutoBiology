import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPromptTemplate, renderPrompt } from "../src/llm/prompt-loader.js";

describe("prompt template loader", () => {
  it("loads bundled prompt templates by stable template name", () => {
    const template = loadPromptTemplate("generate-candidates");

    expect(template).toContain("{{existing_requirements}}");
    expect(template).toContain("source_hyperedge");
    expect(template).toContain("reasoning");
  });

  it("loads the rewrite-requirement prompt contract", () => {
    const template = loadPromptTemplate("rewrite-requirement");
    const rendered = renderPrompt(template, {
      description: "设备应支持低温离心。",
      source_hyperedge: "H-OP-002",
      knowledge_context: "Action: 离心"
    });

    expect(rendered).toContain("设备应支持低温离心。");
    expect(rendered).toContain("H-OP-002");
    expect(rendered).toContain("\"description\"");
    expect(rendered).toContain("\"reasoning\"");
    expect(rendered).toContain("unsupported values");
  });

  it("renders known mustache-style variables and preserves unknown placeholders", () => {
    const rendered = renderPrompt("Hello {{name}}. Keep {{unknown}}. JSON: {{ value_json }}", {
      name: "AutoBiology",
      value_json: "{\"ok\":true}"
    });

    expect(rendered).toBe('Hello AutoBiology. Keep {{unknown}}. JSON: {"ok":true}');
  });

  it("loads templates from an explicit prompt directory", async () => {
    const promptDir = await mkdtemp(join(tmpdir(), "autobio-prompts-"));
    await writeFile(join(promptDir, "custom-template.md"), "Custom {{value}}", "utf8");

    expect(loadPromptTemplate("custom-template", promptDir)).toBe("Custom {{value}}");
  });

  it("rejects missing templates and unsafe template names", () => {
    expect(() => loadPromptTemplate("missing-template")).toThrow(/missing-template/);
    expect(() => loadPromptTemplate("../secrets")).toThrow(/Unsafe prompt template name/);
    expect(() => loadPromptTemplate("nested/template")).toThrow(/Unsafe prompt template name/);
  });
});
