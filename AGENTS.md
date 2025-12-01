# Repository Guidelines

## Project Structure & Module Organization
- `src/index.ts` is the plugin entry that wires PicGo CLI/GUI commands, config schema, and migration flow.
- `src/lib/Migrater.ts` orchestrates URL discovery and upload; `src/lib/FileHandler.ts` reads/writes markdown and rewrites URLs; `src/utils.ts` hosts small helpers.
- `src/i18n` holds locale strings; keep keys stable when adding translations.
- `src/types` contains type declarations used by the compiler.
- `dist/` is the compiled output from TypeScript—do not edit by hand.
- `test/` includes sample markdown/assets, and `test.js` is a Node integration script that exercises `dist/index.js`.

## Build, Test, and Development Commands
```bash
pnpm install           # install deps (uses pnpm-lock.yaml)
pnpm build             # compile TypeScript to dist/
pnpm dev               # watch & rebuild during development
pnpm lint              # eslint on src + type-check (tsc --noEmit)
pnpm test              # runs test.js against dist; run build first
```
Run commands from the repo root. Avoid editing `dist/` manually; regenerate via `pnpm build` when needed.

## Coding Style & Naming Conventions
- TypeScript, CommonJS target es2017; 2-space indentation and single quotes to match existing files.
- Classes in PascalCase (e.g., `FileHandler`), functions/variables in camelCase, constants in SCREAMING_SNAKE_CASE.
- Keep plugin config keys under `picgo-plugin-pic-migrater.*`; prefer explicit types and early returns.
- ESLint extends `eslint-config-love`; `pnpm lint` is the source of truth—fix or annotate intentionally justified cases.

## Testing Guidelines
- `pnpm test` migrates `test/test.md` via compiled `dist/`; ensure `pnpm build` has run and sample files remain intact.
- When adding tests, prefer integration-style checks in `test/` that assert rewritten markdown output and file creation.
- If adding new migration cases, include minimal fixtures and document expected suffixes (`newFileSuffix`) to avoid accidental overwrites.

## Commit & Pull Request Guidelines
- Use commitizen for messages: `pnpm cz`. Commitlint follows the PicGo convention (emoji scopes such as `:bug: Fix: ...`, `:tada: Release: ...`); keep messages imperative and scoped.
- Keep commits small and focused; only update `dist/` for releases or when explicitly required.
- PRs should describe the change, link related issues, and note how to reproduce or verify. Provide CLI output or screenshots/gifs when affecting user-facing flows (CLI help, GUI notifications).

## Security & Configuration Tips
- The plugin reads/writes markdown files; double-check glob patterns before running migrations to avoid unwanted edits.
- Avoid logging sensitive paths or credentials in PicGo configs; sanitize sample configs in docs and tests.
