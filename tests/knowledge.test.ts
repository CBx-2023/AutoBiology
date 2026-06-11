import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getDomainPattern,
  getParameterConstraint,
  getRisksForAction,
  loadKnowledgeBase,
  normalizeKnowledgeTerm
} from "../src/knowledge/loader.js";
import { ACTION_DICTIONARY } from "../src/pipeline/atomizer/action-dict.js";

describe("knowledge base files", () => {
  it("loads and validates the complete default knowledge base", () => {
    const knowledge = loadKnowledgeBase();

    expect(Object.keys(knowledge.synonyms).length).toBeGreaterThanOrEqual(50);
    expect(Object.keys(knowledge.domainPatterns)).toHaveLength(new Set(ACTION_DICTIONARY.map((entry) => entry.action)).size);
    expect(knowledge.parameterConstraints["温度"].unit).toBe("°C");
    expect(knowledge.riskCatalog["污染"].severity).toBe("high");
  });

  it("throws a file-specific validation error for invalid knowledge data", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "autobio-invalid-knowledge-"));
    try {
      await writeFile(join(dataDir, "synonyms.json"), JSON.stringify({ PBS: 42 }), "utf8");
      expect(() => loadKnowledgeBase(dataDir)).toThrow(/synonyms\.json.*PBS/);
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  it("queries normalized entities, action patterns, parameter constraints, and action risks", () => {
    const knowledge = loadKnowledgeBase();

    expect(normalizeKnowledgeTerm("  PBS buffer  ", knowledge)).toBe("PBS");
    expect(normalizeKnowledgeTerm("unknown entity", knowledge)).toBe("unknown entity");
    expect(getDomainPattern("离心", knowledge)?.requiredParameters).toEqual(["温度", "离心力", "时间"]);
    expect(getParameterConstraint("温度", knowledge)?.tolerance).toBe("±1°C");
    expect(getRisksForAction("离心", knowledge).map((risk) => risk.name)).toEqual(
      expect.arrayContaining(["配平失败", "温升导致样本降解"])
    );
  });

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
