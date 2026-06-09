# AutoBioCLI Implementation Review Log

## REVIEW-01 - 2026-06-09

Result: gaps_found

Reviewer: same-model sub-agent `019eab96-c5b4-7ef0-8ef0-ef762c8ec453`

Inputs:
- Approved design spec: `docs/superpowers/specs/2026-06-09-autobiocli-design.md`
- Task CSV: `issues/20260609-autobiocli-implementation.csv`
- Implementation commits: `81a8c60` through `acdfea4`
- Current source, tests, and CLI behavior

Independent findings:

1. P0 packaging gap: `package.json` declares `bin.autobio=dist/cli.js`, but the build emits `dist/src/cli.js`.
2. P0 LLM wiring gap: CLI and runner do not construct an `OpenAiCompatibleLlmClient`; source CLI runs always degrade unless a client is injected by tests.
3. P1 interactive review gap: `--interactive` currently applies `confirm-all` rather than prompting for per-candidate expert decisions.
4. P1 review warning gap: report warnings can say `None` even when the coverage matrix has missing required mappings.

Independent verification reported by reviewer:
- `npx tsc -p tsconfig.json --noEmit` passed.
- `npm test` passed: 7 files, 18 tests.
- Full source-run CLI produced the expected output folder and R1-R10 deterministic requirements, with LLM degraded.

Main-agent corroborating evidence:
- `npm run build` passed.
- `npm test` passed: 7 files, 18 tests.
- Fresh `npx tsx src/cli.ts run tests/fixtures/sample-sop-cell-collection.txt -o /tmp/autobio-review-audit` produced all expected files, R1-R10, 4 OPs, and 4 hyperedges.

Follow-up rows appended:
- `FOLLOWUP-01`
- `FOLLOWUP-02`
- `FOLLOWUP-03`
- `FOLLOWUP-04`
- `REVIEW-02`

## REVIEW-02 - 2026-06-09

Result: gaps_found

Reviewer: same-model sub-agent `019eaba9-b6bf-7142-8c2f-396d2a310ccb`

Inputs:
- Approved design spec: `docs/superpowers/specs/2026-06-09-autobiocli-design.md`
- Task CSV: `issues/20260609-autobiocli-implementation.csv`
- Prior review log: `issues/20260609-autobiocli-implementation.review.md`
- Follow-up commits: `70c2879..ee31d4f`
- Current source, tests, package metadata, and CLI behavior

Independent verification reported by reviewer:
- `npm run build` passed.
- `node dist/cli.js --help` passed and listed expected commands.
- `npm test` with LLM env vars unset passed: 9 files, 28 tests.
- Full source-run CLI produced 4 OPs, 41 nodes, 4 hyperedges, 34 requirements, R1-R10, 5 diagrams, and 85% coverage.
- Local OpenAI-compatible HTTP server plus CLI `infer` produced an `LLM-Candidate`, sent auth in headers, and did not put the API key in request bodies.
- Non-TTY `run --interactive` preserved candidate requirements and added a non-TTY clarification.
- `npm pack`, temp-prefix install, and executing installed `.bin/autobio --help` failed behaviorally: exit 0 with 0 bytes stdout.

Main-agent corroborating evidence:
- Reproduced installed `.bin/autobio --help` failure after `npm run build`, `npm pack`, and temp-prefix install: exit 0 with 0 bytes stdout.
- `npm run build && npm test` passed: 9 files, 28 tests.
- `npm run build && node dist/cli.js --help` passed and listed expected commands.
- Fresh source-run CLI with LLM env unset produced 4 OPs, 4 hyperedges, R1-R10, 34 requirements, 4 coverage rows, 85% coverage, and a report.

Findings:

1. P0 packaged install gap remains: direct `node dist/cli.js --help` works, but npm's installed `.bin/autobio` symlink does not parse commands because the CLI entry guard compares `import.meta.url` with `process.argv[1]`, which diverges through symlinks.
2. P1 evidence alignment gap: local/mock OpenAI-compatible LLM behavior is committed and reproducible, but the external DeepSeek smoke is credential-dependent and must be recorded as optional, redacted, and non-replayable from repo state.

Evidence alignment note:
- Committed automated LLM evidence is limited to local/mock OpenAI-compatible tests and no-credential fallback tests.
- Optional real-provider smoke evidence, when referenced, is credential-dependent and not replayable from repository state alone.
- Optional real-provider smoke run recorded on 2026-06-09 used this redacted command shape: `DEEPSEEK_API_KEY` supplied via stdin to a Node script that called `createLlmClientFromEnv().complete(...)`; model `deepseek-chat`; exit code 0; response matched an expected JSON marker; credentials were not recorded.

Confirmed fixes from REVIEW-01:
- Environment-configured OpenAI-compatible LLM wiring works for `run` and `infer`, while unconfigured mode degrades gracefully.
- Interactive review now uses explicit per-candidate decisions and non-TTY mode does not silently confirm candidates.
- Coverage warnings now emit concrete role-to-requirement gaps for Action/R1, Parameter/R3, Risk/R7, Handling/R8, plus Condition/R4 and HumanJudgment/R6.
- Sample SOP still flows through atomize, hypergraph, requirements, infer fallback, review, coverage, and report generation with R1-R10 present.

Follow-up rows appended:
- `FOLLOWUP-05`
- `FOLLOWUP-06`
- `REVIEW-03`
