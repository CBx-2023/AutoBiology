import { describe, expect, it } from "vitest";
import { loadKnowledgeBase } from "../src/knowledge/loader.js";
import { buildKnowledgeContext } from "../src/llm/context-builder.js";

describe("LLM knowledge context builder", () => {
  it("formats action-specific domain patterns, constraints, risks, and engineering hints", () => {
    const context = buildKnowledgeContext("离心", loadKnowledgeBase());

    expect(context).toContain("Action: 离心");
    expect(context).toContain("Required Parameters");
    expect(context).toContain("温度");
    expect(context).toContain("离心力");
    expect(context).toContain("±5%");
    expect(context).toContain("Related Requirements");
    expect(context).toContain("R3");
    expect(context).toContain("配平失败");
    expect(context).toContain("温升导致样本降解");
    expect(context).toContain("转子配平检测");
  });

  it("returns an explicit fallback for unknown actions", () => {
    const context = buildKnowledgeContext("未知动作", loadKnowledgeBase());

    expect(context).toContain("Action: 未知动作");
    expect(context).toContain("No domain pattern found");
  });
});
