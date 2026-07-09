# Repository Guidelines

## Project Structure & Module Organization
This repository combines agent playbooks with a TypeScript MCP server. Core application code lives in `mcp-news-server/src/`, split by responsibility:
- `tools/` exposes MCP tool handlers.
- `sources/` wraps upstream data providers such as RSS, Finnhub, NewsAPI, Alpha Vantage, and FRED.
- `utils/` contains shared helpers like deduplication and rate limiting.
- `src/config/` holds TypeScript constants (e.g. `fomc-schedule.ts` — FOMC decision dates that must be extended each year from federalreserve.gov) and RSS source lists.
- `config/` (repo root) stores market, API-source, and risk YAML files.
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
Follow the existing TypeScript style: ES modules, strict typing, named exports, and 2-space indentation. Keep filenames kebab-cased (`breaking-news.ts`, `economic-calendar.ts`), functions camelCased (`getBreakingNews`), and config files descriptive and lowercase (`instruments.yaml`). Prefer small modules with one clear responsibility and keep MCP tool descriptions actionable because they surface directly to clients.

## Testing Guidelines
Run `npm test` from `mcp-news-server/` — it builds then runs `node --test` over `dist/__tests__/*.test.js`. Tests are pure-function and network-free: fetch orchestration stays in thin wrappers while computation (e.g. `summarizeSeries`, `formatReleaseCalendar`) is exported for direct testing. Keep new tests under `mcp-news-server/src/__tests__/` with `*.test.ts` naming, and treat `npm test` as the required gate before shipping tool changes.

## Commit & Pull Request Guidelines
`main` currently has no commit history, so no established convention exists yet. Use short imperative subjects and prefer Conventional Commit prefixes such as `feat:`, `fix:`, or `docs:`. Pull requests should state the trading or data-flow impact, list changed configs or API dependencies, and include sample tool output when behavior changes.

## Configuration & Agent Notes
Keep secrets out of the repository and load provider keys through environment variables. When changing workflows, update both the implementation in `mcp-news-server/src/` and the corresponding agent definitions in `agents/*.md` so prompts, tooling, and risk assumptions stay aligned.
