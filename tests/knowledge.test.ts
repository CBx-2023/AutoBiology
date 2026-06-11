import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { ACTION_DICTIONARY } from "../src/pipeline/atomizer/action-dict.js";

describe("knowledge base files", () => {
  it("provides broad biological entity synonym normalization mappings", async () => {
    const synonyms = JSON.parse(await readFile("data/synonyms.json", "utf8")) as Record<string, string>;

    expect(Object.keys(synonyms).length).toBeGreaterThanOrEqual(50);
    expect(synonyms["PBS buffer"]).toBe("PBS");
    expect(synonyms["Falcon管"]).toBe("离心容器");
    expect(synonyms.BSC).toBe("洁净工作台");
    expect(synonyms["移液枪"]).toBe("移液器");
  });

  it("covers every standard action with domain patterns", async () => {
    const patterns = JSON.parse(await readFile("data/domain-patterns.json", "utf8")) as Record<
      string,
      {
        requiredParameters: string[];
        optionalParameters: string[];
        typicalRisks: string[];
        relatedRequirements: string[];
        engineeringHints: string;
      }
    >;
    const actions = [...new Set(ACTION_DICTIONARY.map((entry) => entry.action))];

    expect(Object.keys(patterns).sort()).toEqual([...actions].sort());
    for (const action of actions) {
      const pattern = patterns[action];
      expect(pattern.requiredParameters, action).toBeInstanceOf(Array);
      expect(pattern.optionalParameters, action).toBeInstanceOf(Array);
      expect(pattern.typicalRisks.length, action).toBeGreaterThan(0);
      expect(pattern.relatedRequirements.every((type) => /^R(?:10|[1-9])$/.test(type)), action).toBe(true);
      expect(pattern.engineeringHints.trim().length, action).toBeGreaterThan(0);
    }
  });
});
