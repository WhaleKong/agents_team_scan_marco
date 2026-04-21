# Repository Guidelines

## Project Structure & Module Organization
This repository combines agent playbooks with a TypeScript MCP server. Core application code lives in `mcp-news-server/src/`, split by responsibility:
- `tools/` exposes MCP tool handlers.
- `sources/` wraps upstream data providers such as RSS, Finnhub, NewsAPI, and Alpha Vantage.
- `utils/` contains shared helpers like deduplication and rate limiting.
- `config/` stores market, API-source, and risk YAML files.
- `agents/` defines the macro, news, quant, and risk agent roles.
- `templates/` and `data/` hold reusable markdown templates and runtime state.

## Build, Test, and Development Commands
Run package commands from `mcp-news-server/`.

```bash
npm install
npm run build
npm start
npm run dev
```

`npm run build` compiles TypeScript into `dist/` and is the main validation command currently in use. `npm start` runs the compiled MCP server. `npm run dev` starts `tsc --watch` for iterative development; it recompiles on change but does not auto-run the server.

## Coding Style & Naming Conventions
Follow the existing TypeScript style: ES modules, strict typing, named exports, and 2-space indentation. Keep filenames kebab-cased (`breaking-news.ts`, `economic-calendar.ts`), functions camelCased (`getBreakingNews`), and config files descriptive and lowercase (`risk-params.yaml`). Prefer small modules with one clear responsibility and keep MCP tool descriptions actionable because they surface directly to clients.

## Testing Guidelines
There is no committed automated test suite yet. Until one is added, treat `npm run build` as the required gate and manually smoke-test affected MCP tools after changes. If you add tests, use `*.test.ts` naming and place them near the feature or under `mcp-news-server/src/__tests__/` so they stay close to the server code.

## Commit & Pull Request Guidelines
`main` currently has no commit history, so no established convention exists yet. Use short imperative subjects and prefer Conventional Commit prefixes such as `feat:`, `fix:`, or `docs:`. Pull requests should state the trading or data-flow impact, list changed configs or API dependencies, and include sample tool output when behavior changes.

## Configuration & Agent Notes
Keep secrets out of the repository and load provider keys through environment variables. When changing workflows, update both the implementation in `mcp-news-server/src/` and the corresponding agent definitions in `agents/*.md` so prompts, tooling, and risk assumptions stay aligned.
