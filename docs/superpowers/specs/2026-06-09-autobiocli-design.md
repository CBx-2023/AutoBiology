# AutoBiology CLI Design Spec

## 1. Overview

**AutoBiology CLI** (`autobio`) is a command-line tool designed to implement the methodology outlined in `docs/需求挖掘.md`. It automates the process of extracting engineering requirements from biological Standard Operating Procedures (SOPs).

The tool follows a 5-stage pipeline:
1.  **SOP Atomization (Atomizer):** Parses raw SOP text into structural Operation (OP) tables.
2.  **Hypergraph Construction (Hypergraph Builder):** Converts OPs into a knowledge hypergraph (nodes and hyperedges).
3.  **Requirement Generation (Requirement Generator):** Infers requirements (R1-R10) using direct mapping and domain patterns.
4.  **LLM Inference (LLM Inference):** Uses Large Language Models to discover implicit requirements, re-write descriptions, and deduplicate.
5.  **Review & Coverage (Reviewer):** Verifies the completeness against a coverage matrix and provides interactive expert feedback.

The tool outputs intermediate JSON files at each stage, making it highly transparent and debuggable, and ultimately generates a comprehensive Markdown report enriched with Mermaid visualizations.

## 2. Architecture & Tech Stack

-   **Language:** TypeScript / Node.js
-   **Execution Mode:** Pipeline-based, providing both an all-in-one run command and step-by-step commands.
-   **Storage:** File-based (JSON) for intermediate and final outputs. No database required.
-   **LLM Provider:** DeepSeek (default), compatible with Anthropic/OpenAI formats via standard SDKs.
-   **Testing:** Vitest

### 2.1 Project Structure

```
autobio/
├── package.json
├── tsconfig.json
├── src/
│   ├── cli.ts                  # CLI entrypoint, command parsing (e.g., Commander.js)
│   ├── config.ts               # Configuration management (LLM keys, paths)
│   ├── pipeline/
│   │   ├── runner.ts           # Pipeline orchestrator
│   │   ├── types.ts            # Shared TypeScript interfaces (Data Contracts)
│   │   ├── atomizer/           # Stage 1: SOP Atomization
│   │   │   ├── index.ts
│   │   │   ├── action-dict.ts  # Action dictionary management
│   │   │   └── rules.ts        # OP splitting rules engine (A1-F5)
│   │   ├── hypergraph/         # Stage 2: Hypergraph Construction
│   │   │   ├── index.ts
│   │   │   ├── nodes.ts        # Node creation, deduplication, normalization
│   │   │   └── edges.ts        # Hyperedge assembly
│   │   ├── requirements/       # Stage 3: Requirement Generation
│   │   │   ├── index.ts
│   │   │   ├── mapping-rules.ts    # R1-R10 direct mapping logic
│   │   │   ├── domain-patterns.ts  # Domain pattern matching
│   │   │   └── dedup.ts            # Fingerprint-based deduplication
│   │   ├── inference/          # Stage 4: LLM Inference
│   │   │   ├── index.ts
│   │   │   ├── candidate-gen.ts    # Generates implicit candidate requirements
│   │   │   └── rewriter.ts         # Normalizes requirement phrasing
│   │   └── review/             # Stage 5: Review & Coverage
│   │       ├── index.ts
│   │       ├── coverage.ts         # Generates coverage matrix
│   │       └── feedback.ts         # Interactive CLI prompt for expert review
│   ├── llm/
│   │   ├── client.ts           # LLM client wrapper (OpenAI SDK)
│   │   └── prompts.ts          # Prompt templates
│   └── output/
│       ├── json-writer.ts      # Helper for saving stage outputs
│       ├── markdown-writer.ts  # Final report generation
│       └── mermaid/            # Diagram generation
│           ├── renderer.ts     # Orchestrator
│           ├── sop-flow.ts     # Flowchart TD
│           ├── hypergraph-viz.ts# Flowchart LR
│           ├── requirement-trace.ts
│           ├── risk-network.ts
│           ├── coverage.ts
│           └── styles.ts       # Shared Mermaid classDefs
├── data/
│   ├── action-dictionary.json  # Base action definitions
│   ├── synonyms.json           # Normalization mapping
│   └── domain-patterns.json    # Rules for specific actions (e.g., 离心, 弃液)
└── tests/
```

### 2.2 CLI Commands

```bash
# Full Pipeline
autobio run <sop-file.md> -o <output-dir>
autobio run <sop-file.md> -o <output-dir> --interactive

# Step-by-Step Execution
autobio atomize <sop-file.md> -o <output-dir>
autobio hypergraph <output-dir>/01-ops.json -o <output-dir>
autobio requirements <output-dir>/02-nodes.json <output-dir>/03-hyperedges.json -o <output-dir>
autobio infer <output-dir>/04-requirements.json -o <output-dir>
autobio review <output-dir>/04-requirements.json -o <output-dir>

# Configuration
autobio config set llm.provider deepseek
autobio config set llm.apiKey <key>
autobio config set llm.model deepseek-chat
```

### 2.3 Output Directory Structure

Executing the full pipeline results in:

```
<output-dir>/
├── 01-ops.json            # Output of Atomizer
├── 02-nodes.json          # Output of Hypergraph (Nodes)
├── 03-hyperedges.json     # Output of Hypergraph (Edges)
├── 04-requirements.json   # Output of Generator & Inference
├── 05-coverage.json       # Output of Reviewer
├── 06-clarifications.json # Missing info or LLM questions
├── diagrams/              # Generated by output/mermaid/
│   ├── sop-flow.mmd
│   ├── hypergraph.mmd
│   ├── requirement-trace.mmd
│   ├── risk-network.mmd
│   └── coverage-matrix.mmd
├── report.md              # Final readable report embedding Mermaid diagrams
└── run-meta.json          # Execution metadata
```

## 3. Data Models (Pipeline Contracts)

All shared interfaces live in `src/pipeline/types.ts`.

### 3.1 Atomizer Output (Stage 1)

```typescript
interface OpTable {
  sopId: string;
  sopName: string;
  ops: Op[];
}

interface Op {
  opId: string;                // e.g., "OP-001"
  sourceText: string;
  parentStep: string;
  operationName: string;
  action: string;              // Standardized action verb
  precondition: string;
  inputs: string[];
  target: string;
  container: string[];
  location: string;
  tools: string[];
  outputState: string;
  parameters: ParameterEntry[];
  conditions: string[];
  humanJudgment: {
    required: boolean;
    content: string;
    basis: string;
  };
  risks: RiskEntry[];
}

interface ParameterEntry {
  name: string;
  value: number | null;
  unit: string;
  rawText: string;
  status: 'specified' | 'ambiguous' | 'missing';
}

interface RiskEntry {
  name: string;
  source: 'sop' | 'expert' | 'inferred';
  handling: string;
}
```

### 3.2 Hypergraph Output (Stage 2)

```typescript
type NodeType =
  | 'Action' | 'Precondition' | 'Input' | 'Target'
  | 'Container' | 'Location' | 'Tool' | 'OutputState'
  | 'Parameter' | 'Condition' | 'HumanJudgment'
  | 'Risk' | 'Handling';

interface NodeTable {
  nodes: HyperNode[];
}

interface HyperNode {
  nodeId: string;            // e.g., "ACT-001", "MAT-001"
  nodeType: NodeType;
  nodeName: string;          // Raw name
  normalizedName: string;    // E.g., "PBS缓冲液" -> "PBS"
  source: 'sop' | 'expert' | 'inferred';
  sourceOps: string[];       // References to OP-xxx
  sourceSop: string;
  attributes: Record<string, unknown>;
  synonyms: string[];
  notes: string;
}

interface HyperedgeTable {
  hyperedges: Hyperedge[];
}

interface Hyperedge {
  hyperedgeId: string;         // e.g., "H-OP-001"
  hyperedgeType: 'OperationHyperedge';
  sourceOp: string;
  sourceSop: string;
  sourceText: string;
  parentStep: string;
  connectedNodes: string[];    // Array of Node IDs
  nodeRoles: Record<NodeType, string[]>;
  missingInfo: string[];
  expertSupplement: string[];
  attributes: {
    operationName: string;
    isManualJudgmentRequired: boolean;
    automationRelevance: 'high' | 'medium' | 'low';
  };
  notes: string;
}

interface Hypergraph {
  nodes: NodeTable;
  edges: HyperedgeTable;
}
```

### 3.3 Requirement Output (Stage 3 & 4)

```typescript
type RequirementType = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8' | 'R9' | 'R10';

type RequirementStatus = 'candidate' | 'confirmed' | 'clarification' | 'rejected' | 'frozen';

interface RequirementTable {
  requirements: Requirement[];
  clarifications: Clarification[];
}

interface Requirement {
  requirementId: string;       // e.g., "REQ-001"
  type: RequirementType;
  description: string;
  sourceOps: string[];
  sourceHyperedges: string[];
  sourceFields: string[];      // e.g., ["Action", "Risk"]
  applicableTo: string;
  keyMetrics: string[];
  constraints: string[];
  relatedRisks: string[];
  responsibleModule: string;
  verificationMethod: string;
  priority: 'high' | 'medium' | 'low' | 'unset';
  status: RequirementStatus;
  inferenceRule: string;       // e.g., "DM-R1" or "LLM-Candidate"
  confidence: number;          // 0.0 - 1.0
  fingerprint: string;         // Hash for deduplication
}

interface Clarification {
  id: string;
  question: string;
  sourceOps: string[];
  sourceHyperedges: string[];
  relatedRequirements: string[];
  priority: 'high' | 'medium' | 'low';
}
```

### 3.4 Review Output (Stage 5)

```typescript
interface CoverageMatrix {
  rows: CoverageRow[];
  summary: {
    totalHyperedges: number;
    coveredTypes: Record<RequirementType, number>;
    missingTypes: Record<RequirementType, number>;
    coverageRate: number;
  };
}

interface CoverageRow {
  hyperedgeId: string;
  coverage: Record<RequirementType, 'covered' | 'missing' | 'clarification'>;
}

interface RunMeta {
  version: string;
  timestamp: string;
  sopFile: string;
  config: {
    llmModel: string;
    interactive: boolean;
  };
  stageDurations: Record<string, number>;
  stats: {
    opCount: number;
    nodeCount: number;
    hyperedgeCount: number;
    requirementCount: number;
    clarificationCount: number;
    coverageRate: number;
  };
}
```

## 4. Pipeline Logic

### 4.1 Stage 1: Atomizer
-   **Step 1a-1d (Rule Engine):** Splits SOP into paragraphs -> sentences. Matches verbs against `action-dictionary.json`. Applies splitting rules (A1-F5). Priority: Atomicity (A) > Composite (C) > Variance (B) > Flow (D).
-   **Step 1e (LLM Assist):** For each identified chunk, calls LLM (Prompt: `EXTRACT_OP_FIELDS`) to populate the 17-field `Op` interface.
-   **Step 1f (Validation):** Applies the 6 final checklist rules to ensure the OP is valid.

### 4.2 Stage 2: Hypergraph Builder
-   **Step 2a-2b:** Extracts node candidates from OP fields. Applies `Normalizer` using `synonyms.json`.
-   **Step 2c:** Reuses existing Node IDs if semantics match; else creates new IDs (`ACT-001`, `MAT-001`).
-   **Step 2d:** Assembles `Hyperedge` per OP, grouping connected node IDs by role.
-   **Step 2e-2f:** Tracks "未说明" (missing) and "专家补充" (expert) tags.

### 4.3 Stage 3: Requirement Generator
-   **Step 3a (Direct Mapping):** Applies deterministic rules (e.g., if Action exists -> R1).
-   **Step 3b (Domain Patterns):** Looks up `domain-patterns.json` (e.g., if Action="离心", ensure Parameters include ["温度", "离心力", "时间"]).
-   **Step 3c-3d:** Calculates requirement fingerprint `hash(type + sourceFields + normalized_desc)`. Merges exact or subset matches.
-   **Step 3e:** Ambiguous parameters or missing required fields generate `Clarification` entries.

### 4.4 Stage 4: LLM Inference
Executes three subtasks via the `LlmClient`:
1.  **Candidate Gen (`GENERATE_CANDIDATES`):** Analyzes the hyperedge to infer implicit requirements (e.g., 4°C implies temp maintenance). Output must include `source_hyperedge`. Without source, it is rejected.
2.  **Rewriter (`REWRITE_REQUIREMENT`):** Normalizes phrasing to "设备应..." (The equipment shall...).
3.  **Semantic Dedup:** Detects near-duplicates missed by the fingerprint hash.

*All LLM-generated requirements start with status `candidate`.*

### 4.5 Stage 5: Review
-   **Coverage Check:** Generates `CoverageMatrix`. Flags warnings if an Action lacks an R1, a Risk lacks an R7, etc.
-   **Rule Verification:** Enforces 3.3 rules (e.g., no hardcoded implementation plans).
-   **Interactive Mode:** If `--interactive` is passed, drops into a CLI prompt for the user to review each `candidate` requirement.
    ```text
    ━━━ 需求确认 [1/12] ━━━
    REQ-003 [R6 感知与判断需求] (候选)
    ...
    [c] 确认  [r] 拒绝  [q] 标记待澄清  [s] 跳过  [a] 全部确认
    >
    ```

## 5. Visualizations (Mermaid)

The `src/output/mermaid` module generates `.mmd` files which are embedded in `report.md`.

1.  **`sop-flow.mmd` (Flowchart TD):** Shows the sequence of OPs. Shapes denote action categories (e.g., `[ ]` liquid, `{ }` decision).
2.  **`hypergraph.mmd` (Flowchart LR):** Shows hyperedges as subgraphs. Node shapes and colors depend on their `NodeType`. Uses `styles.ts` for consistent `classDef`s.
3.  **`requirement-trace.mmd` (Flowchart LR):** 3-column layout: `Source Text -> Hyperedge -> Requirement`. Colors indicate status (Candidate=Yellow, Confirmed=Green).
4.  **`risk-network.mmd` (Flowchart TD):** Centered on Risk nodes, showing links to OPs, Handlings, and Requirements.
5.  **`coverage-matrix.mmd`:** Rendered as a markdown table inside `report.md` (better layout), supplemented with a Mermaid pie chart of coverage stats.

## 6. Error Handling & Fallbacks

-   **I/O Errors:** Fatal exit.
-   **SOP Parsing Fails:** Warn, mark OP as "不可充分原子化" (inadequately atomized), continue.
-   **LLM Failures (Timeout/Rate Limit):** Retry up to 3 times (configured in `LlmConfig`). If total failure, **degrade gracefully**: skip Stage 4, generate requirements using only rules (Stage 3), and flag "LLM 辅助层未启用" in `run-meta.json`.
-   **Exit Codes:** `0` (Success), `1` (Fatal Error), `2` (Success with warnings/degradations).

## 7. Testing Strategy

Using `Vitest`.

-   **Fixtures:** `tests/fixtures/sample-sop-cell-collection.txt` acting as the golden source based on the markdown documentation.
-   **Unit Tests:**
    -   Atomizer: Test split rules (A1-F5) independently.
    -   Hypergraph: Test synonym normalization and node reuse.
    -   Requirements: Test direct mapping and fingerprint deduplication.
    -   Mermaid: Validate `.mmd` syntax generation.
-   **Integration/E2E:**
    -   Mock LLM responses (`tests/integration/llm-mock.test.ts`) to test pipeline flow without API costs.
    -   CLI invocation tests.
