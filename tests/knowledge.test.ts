import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("knowledge base files", () => {
  it("provides broad biological entity synonym normalization mappings", async () => {
    const synonyms = JSON.parse(await readFile("data/synonyms.json", "utf8")) as Record<string, string>;

    expect(Object.keys(synonyms).length).toBeGreaterThanOrEqual(50);
    expect(synonyms["PBS buffer"]).toBe("PBS");
    expect(synonyms["Falcon管"]).toBe("离心容器");
    expect(synonyms.BSC).toBe("洁净工作台");
    expect(synonyms["移液枪"]).toBe("移液器");
  });
});
