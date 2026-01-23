# Repository Guidelines


## Talking to the user

If you have questions, number them for easier responses.

## Finding your way around

Almost every project has a Justfile.   just --list  will help a lot when you
look at other projects.
Every project should have a 'just install' for installing things.  If your
Justfile doesn't have it, add it.



## Project Structure & Module Organization
- Monorepo managed by Bun workspaces. Key packages: `apps/web` (React + Vite UI) and `apps/api` (Express JSON API). Shared types and Zod schemas live in `packages/shared`. Configs live in `tsconfig*.json`; product spec is in `docs/SPEC.md`.
- Web app uses Tailwind-style utility classes and shadcn/ui components under `apps/web/src` (`components/ui`, `lib/utils.ts`). API entrypoints are `apps/api/src/index.js` (server) and `apps/api/src/dev.js` (dev runner).

## Agent CLI Usage
- When running shell commands, set the `workdir` parameter instead of prefixing commands with `cd`; use `/Users/lherron/projects/workboard` as the workspace root.

## Create under a different project (overrides WRKQ_PROJECT_ROOT)
wrkq touch --project rex inbox/new-task -t "New Task"


## Build, Test, and Development Commands
- Install: `bun install`.
- Develop both surfaces: `bun dev` (runs web + api in parallel).
- Build all packages: `bun run build`.
- Web-only: `bun run --filter '@workboard/web' dev|build|preview`.
- API-only: `bun run --filter '@workboard/api' dev|start`.

## Coding Style & Naming Conventions
- TypeScript + ES modules across all packages. Prefer named exports; keep files small and feature-scoped.
- Formatting is enforced via Biome (`bun run lint` to check, `bun run lint:fix` to fix). Use Biome + TS for consistency.
- React components: PascalCase filenames; hooks/utilities use camelCase. Tailwind utility strings go in className; shared class merging via `cn()`.
- API route handlers stay in `apps/api/src`; reuse types from `@workboard/shared` to avoid drift.

## Testing Guidelines
- Always run the relevant tests after making changes; if no automated tests cover the change, do the manual smoke checks.
- No automated test runner is configured yet. When adding tests, prefer Vitest for React code and supertest+vitest (or jest) for API routes. Co-locate as `*.test.ts(x)` beside source or under `__tests__`. Start with unit coverage on schemas and API handlers.
- Until tests exist, do manual smoke checks: `pnpm dev`, hit `http://localhost:5151/api/health`, and load the web landing page.

## Commit & Pull Request Guidelines
- No git history is present in this workspace; if/when you initialize git, follow Conventional Commits (`feat:`, `fix:`, `chore:`) to keep CI/release automation options open.
- Pull requests should include: summary, linked issue (if any), notes or screenshots for UI changes, and a checklist of commands run (build, manual smoke steps, tests). Keep diffs small and typed; update `docs/SPEC.md` if behavior changes the contract.

## Security & Configuration Tips
- Keep secrets out of the repo; use `.env` files locally (dotenv is loaded by the API). Document required vars in PRs.
- Prefer mock modes for demos; flip off in real environments. Validate request bodies with shared Zod schemas to prevent drift between client and server.
- Local defaults: `.env.local` sets `WRKQ_DB_PATH=./.wrkq/wrkq.db` and `WRKQ_ACTOR=codex-agent`; `pnpm dev` and CLI commands pick these up automatically. Override in your shell if you need a different DB/actor.

## Using `wrkq` in this Project
- `wrkq` is the canonical CLI for projects/tasks backed by the same SQLite schema described in `docs/SPEC.md`. It is available on PATH.
- **Always invoke `wrkq` directly from PATH (e.g., `wrkq ...`); do not call `../wrkq/bin/wrkq` or other relative paths.** The binary is already available on PATH for this workspace and picks up `.env.local` automatically.
- This project has a `.env.local` with WRKQ env vars, and `.env.local` is read automatically by `wrkq`; you do not need to specify WRKQ env vars when you run it.
- Copy/paste usage examples (all assume PATH invocation):
  - `wrkq tree workboard` - show the project/task tree under this repo.
  - `wrkq touch workboard/m2/new-task --title "My new task"` - create a task with a friendly title.
  - `wrkq cat T-00005` - inspect a task's front matter + body.
  - `wrkq apply T-00005 - --body-only --format md <<'EOF'
Body text here
EOF` - update body via stdin while keeping metadata.
- If you see commands trying to run `../wrkq/bin/wrkq`, stop and switch to the PATH form above; the PATH binary already respects `.env.local` defaults.
- Basic workflow:
  - Initialize a DB if needed with `wrkq init` (uses `WRKQ_DB_PATH` by default).
  - Create and organize work with `wrkq mkdir`, `wrkq touch`, `wrkq ls`, and `wrkq tree` (for example a `workboard/` container subtree for this repo).
  - Update task fields with `wrkq set T-00012 state=in_progress priority=1` and edit task bodies/specs with `wrkq edit T-00012` or `wrkq apply`.
  - Inspect history and debug issues with `wrkq log <ID>`, `wrkq stat`, `wrkq find`, and `wrkq watch`.
- When designing or changing the web/API surfaces in this repo, treat `wrkq` as the source of truth for data shape and behavior:
  - Prefer looking at `wrkq cat <task>` output and the existing database schema before inventing new fields.
  - Keep any browser UI/API contracts compatible with `wrkq` IDs, slugs, etags, and event-log semantics.
- For personal task tracking while working on this repo, you can create a dedicated container tree (for example `wrkq/workboard/**`) and manage your work entirely via `wrkq` instead of ad-hoc TODO files.
