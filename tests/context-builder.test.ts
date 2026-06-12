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

  it("formats liquid-handling constraints, risk controls, and missing parameter constraints", () => {
    const context = buildKnowledgeContext("加液", loadKnowledgeBase());

    expect(context).toContain("Action: 加液");
    expect(context).toContain("体积: unit mL");
    expect(context).toContain("流速");
    expect(context).toContain("加液位置: no constraint available");
    expect(context).toContain("体积误差");
    expect(context).toContain("气泡引入");
    expect(context).toContain("液面检测");
    expect(context).toContain("液体处理模块");
  });
});
