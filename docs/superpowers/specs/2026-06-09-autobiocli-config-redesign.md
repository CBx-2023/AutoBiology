# AutoBiology CLI Config and Command Redesign Spec

## 1. Overview
The AutoBiology CLI requires a redesign of its command structure and configuration system to improve user experience. The entrypoint will change from `autobio` to `autob`, adopting a more unified CLI feel. Environment variables for LLM configuration will be completely replaced by a structured JSON configuration system (global and project-level) accompanied by an interactive `init` wizard. Comprehensive documentation will also be added.

## 2. CLI Refactoring
- Rename the bin entrypoint from `autobio` to `autob` in `package.json`.
- Keep the subcommand architecture: `autob run`, `autob atomize`, etc.
- Add new management commands: `autob init` and `autob config show`.
- Update the program name in commander.

## 3. Configuration System
- **Global Config:** `~/.autob/config.json` stores base settings (e.g., `llm.provider`, `llm.apiKey`, `llm.model`).
- **Project Config:** `.autob.json` in the current working directory overrides non-sensitive global settings (e.g., `llm.model`, `llm.timeoutMs`).
- **Merge Strategy:** Shallow merge of the `llm` object where project config takes precedence. `apiKey` should not be stored in project config.
- **Cleanup:** Remove `resolveLlmConfigFromEnv` and `createLlmClientFromEnv` environment variable parsing. Remove support for `AUTOBIO_LLM_*`, `DEEPSEEK_*`, and `OPENAI_*` environment variables.

## 4. Interactive `init` Wizard
- Implement an interactive wizard using Node.js built-in `readline`. No new heavy dependencies like Inquirer.js.
- Flow:
  1. Select LLM Provider (DeepSeek / OpenAI / Custom)
  2. Input API Key (display as mask, e.g., showing only the last 4 characters)
  3. Select/Input Model
  4. Prompt for base URL (if custom) and timeoutMs.
  5. Save to `~/.autob/config.json`.
  6. (Optional) Run a quick connectivity test via a simple LLM completion request.
- Provide `autob config show` to clearly display the merged configuration and indicate the source of each field (Global vs. Project).

## 5. Documentation Construction
- `docs/getting-started.md`: 5-minute quick start guide (Installation, initialization, running the pipeline).
- `docs/configuration.md`: Detailed configuration guide (files, merging, examples).
- `docs/pipeline-guide.md`: Explanation of the 5-stage pipeline, intermediate JSON files, and debugging.
- `docs/cli-reference.md`: Complete command reference, arguments, options, and exit codes.
- Update `README.md` to be a concise project introduction linking to `docs/`.

## 6. Testing Strategy
- Update/Rewrite `tests/config.test.ts` for file reading, merging, missing files, and validation.
- Add `tests/init.test.ts` to mock `readline` and test the wizard flow and file generation.
- Add `tests/cli.test.ts` to verify the `autob` command registration and management commands.
- Ensure existing pipeline tests still pass with the new configuration injection logic.
