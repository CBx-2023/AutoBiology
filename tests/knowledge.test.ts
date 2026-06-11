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

  it("defines engineering constraints for core process parameters", async () => {
    const constraints = JSON.parse(await readFile("data/parameter-constraints.json", "utf8")) as Record<
      string,
      {
        unit: string;
        typicalRange: [number, number];
        criticalThresholds?: number[];
        tolerance: string;
        notes: string;
      }
    >;

    for (const parameter of ["温度", "离心力", "时间", "体积", "CO2浓度"]) {
      const constraint = constraints[parameter];
      expect(constraint.unit.trim().length, parameter).toBeGreaterThan(0);
      expect(constraint.typicalRange, parameter).toHaveLength(2);
      expect(constraint.typicalRange[0], parameter).toBeLessThanOrEqual(constraint.typicalRange[1]);
      expect(constraint.tolerance.trim().length, parameter).toBeGreaterThan(0);
      expect(constraint.notes.trim().length, parameter).toBeGreaterThan(0);
    }
  });

  it("defines a bounded standard risk catalog", async () => {
    const risks = JSON.parse(await readFile("data/risk-catalog.json", "utf8")) as Record<
      string,
      {
        category: string;
        severity: string;
        triggerActions: string[];
        standardHandling: string;
        verificationMethod: string;
      }
    >;
    const actionSet = new Set(ACTION_DICTIONARY.map((entry) => entry.action));
    const riskNames = Object.keys(risks);

    expect(riskNames.length).toBeGreaterThanOrEqual(15);
    expect(riskNames.length).toBeLessThanOrEqual(20);
    for (const [riskName, risk] of Object.entries(risks)) {
      expect(risk.category.trim().length, riskName).toBeGreaterThan(0);
      expect(["low", "medium", "high"]).toContain(risk.severity);
      expect(risk.triggerActions.length, riskName).toBeGreaterThan(0);
      expect(risk.triggerActions.every((action) => actionSet.has(action)), riskName).toBe(true);
      expect(risk.standardHandling.trim().length, riskName).toBeGreaterThan(0);
      expect(risk.verificationMethod.trim().length, riskName).toBeGreaterThan(0);
    }
  });
});
