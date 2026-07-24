# workboard

Web UI for tasks and agentic workflows. Bun monorepo: `apps/web` (React + Vite +
shadcn/ui), `apps/api` (Express), `packages/shared` (shared types + Zod schemas).
`docs/SPEC.md` is the product contract — update it when behavior changes it.

Task tracking: run `wrkq info`.

## Dev

- `just --list` for the lifecycle; `bun dev` runs web + api in parallel.
- Web tests: `bun run test`. Keep validation proportional; smoke anything untested by hand (`/api/health` on the API, then the web landing page).
- Ports come from `.env.local`: API `18461`, web `18460`. The same file points wrkq at the canonical remote DB (`WRKQ_DB=rpc://mini` + `WRKQD_TOKEN_FILE`) and sets `WRKQ_PROJECT_ROOT=workboard` — do not initialize a local wrkq DB here.
- Validate request bodies with the shared Zod schemas in `@workboard/shared` to prevent client/server drift; keep secrets in `.env` files, out of the repo.
