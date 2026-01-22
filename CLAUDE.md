# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## WRKQ Usage Reference
** Always use `wrkq` to track task progress. **
Run `wrkq info` for instructions on using wrkq.


## Front-end
<frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight. Focus on:

Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.

Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.

Motion: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. 

Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.

Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!
</frontend_aesthetics>


## Project Overview

This is **webwrkq**, a browser UI for the `wrkq` CLI task management system. The project is a Bun monorepo:
- `apps/web` - React + Vite frontend with Tailwind CSS and shadcn/ui
- `apps/api` - Express.js API proxy
- `packages/shared` - Shared TypeScript types and Zod schemas

The web UI connects to the **control-plane API** (separate service) which manages the wrkq databases. This codebase does **not** implement the core task management logic; it provides a read-heavy interface for browsing and basic editing.


**We dogfood wrkq**: This project uses wrkq to manage its own development tasks. The wrkq database tracks active work, and agents working on this codebase should use wrkq commands to view, update, and comment on tasks.





## Development Commands

**Install dependencies:**
```bash
bun install
```

**Development:**
```bash
bun dev           # Start web + api dev servers (requires control-plane on port 7420)
```

**Build:**
```bash
bun run build     # Build all packages
```

**Code Quality:**
```bash
bun run typecheck # Type check all packages
bun run lint      # Lint with Biome
bun run lint:fix  # Auto-fix lint issues
```

## Architecture & Data Flow

### Control-Plane API

The web UI talks to control-plane (separate service, port 7420) which manages wrkq databases:
- All API calls go through `/admin/wrkq/*` endpoints (proxied by Vite dev server)
- Authentication via `x-cp-token` header
- Schema contracts defined in `@webwrkq/shared`

### Web Layer (apps/web/src)

React SPA using:
- **Routing:** Wouter (lightweight React router)
- **Styling:** Tailwind CSS + shadcn/ui components
- **State:** No global state library; React hooks + URL params
- **API Client:** `apps/web/src/api/client.ts` with Zod validation

Component structure:
```
apps/web/src/
  App.tsx              - Main app shell & routing
  components/
    Sidebar.tsx        - Project/container tree navigation
    TaskList.tsx       - List of tasks for selected container
    TaskDetail.tsx     - Full task view with metadata & body
    CommentsTimeline.tsx - Comment list with actor badges
    TaskBadges.tsx     - State/priority/label pills
    ui/                - shadcn/ui primitives (button, etc.)
  lib/
    utils.ts           - cn() for className merging
    datetime.ts        - Date formatting helpers
    useQueryParam.ts   - URL param state hook
  api/
    client.ts          - Typed API client with validation
```

### Shared Package (packages/shared/src)

Zod schemas + TypeScript types for API contracts:
```
schema/
  wrkq.ts        - Core types: ContainerNode, TaskDetail, TaskComment
  items.ts       - Other item schemas (if any)
  jobs.ts        - Job schemas (if any)
featureFlags.ts  - Feature flag definitions
```

Use these schemas to validate control-plane API responses.

## Key Concepts from wrkq SPEC

The web UI surface mirrors the CLI data model (see `docs/SPEC.md` for full details):

- **Containers (Projects/Subprojects):** Hierarchical organization with slugs, paths, and friendly IDs (e.g. `P-00007`)
- **Tasks:** Leaves under containers with `T-xxxxx` IDs, slugs, state, priority, labels, body (Markdown), and timestamps
- **Comments:** Append-only collaboration on tasks with `C-xxxxx` IDs, actor attribution
- **Actors:** Human, agent, or system. All mutations track `created_by` and `updated_by` actors
- **ETags:** Bigint version field for optimistic concurrency (not fully wired in web UI yet)
- **Slugs:** Normalized `[a-z0-9-]` identifiers, unique among siblings

### Path & ID Addressing

The CLI uses both friendly IDs (`T-00123`) and container paths (`portal/auth/login-ux`). The API typically uses UUIDs or friendly IDs in URLs, but returns both in responses for UI display.

## Git Commits

When committing changes:
- Do NOT add "Generated with Claude Code" footers
- Do NOT add "Co-Authored-By: Claude" lines
- Keep commit messages concise and descriptive
- Use conventional commit format (feat:, fix:, chore:, etc.)

## Code Style & Conventions

- **TypeScript + ES Modules:** All packages use `"type": "module"`
- **Named Exports:** Prefer named over default exports
- **Component Naming:** PascalCase files for React components, camelCase for hooks/utilities
- **Styling:** Use Tailwind utility classes in `className`; `cn()` from `lib/utils.ts` for conditional merging
- **Formatting:** Biome enforced; run `bun run lint:fix` before commits

## Testing

E2E tests use Playwright. Run with:
```bash
bun run test       # Run Playwright tests
```

For manual smoke tests:
```bash
bun dev
# Visit http://localhost:5150 (requires control-plane on port 7420)
```

## Environment & Configuration

**Key environment variables:**
```
WRKQ_DB_PATH=./.wrkq/wrkq.db    # Path to SQLite DB (for wrkq CLI)
WRKQ_ACTOR=codex-agent          # Current actor slug for CLI
CP_URL=http://localhost:7420      # Control-plane API URL (Vite proxy target)
VITE_CP_TOKEN=dev                 # Auth token for control-plane API
```

## Important Constraints

1. **Control-Plane Required:** The web UI requires control-plane to be running on port 7420.

2. **No Authentication:** The wrkq system has no auth; only actor attribution. The web UI inherits this design.

3. **CLI is Source of Truth:** Always defer to `wrkq` CLI behavior and the `docs/SPEC.md` data model. If the web UI contradicts the CLI, the CLI is correct.

## Common Workflows

**Adding a new UI component:**
1. Create component in `apps/web/src/components/`
2. Use existing shadcn/ui primitives from `components/ui/`
3. Import shared types from `@webwrkq/shared`
4. Style with Tailwind classes; use `cn()` for conditional classes

**Adding a new API client function:**
1. Define Zod schema in `packages/shared/src/schema/*.ts`
2. Add typed client function in `apps/web/src/api/client.ts`
3. Use in React component with error handling

**Debugging API issues:**
1. Ensure control-plane is running on port 7420
2. Check browser network tab for API errors
3. Verify `VITE_CP_TOKEN` matches control-plane config

## Related Documentation

- `docs/SPEC.md` - Full wrkq CLI specification (authoritative for data model)
- `docs/MVP.md` - Web UI milestone plan (current progress & roadmap)
- `AGENTS.md` - Guidelines for AI agents working on this codebase
- `../wrkq/` - Sibling repo with the Go CLI and DB migrations

## Path Aliases

TypeScript paths are configured in `tsconfig.base.json`:
```json
"@webwrkq/shared": ["packages/shared/src"],
"@webwrkq/shared/*": ["packages/shared/src/*"]
```

Use these aliases in all packages for shared code imports.
