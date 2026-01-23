Right now “session/run events” get interpreted + rendered in multiple places (at least `EventBlock.tsx`, `RunSummary.tsx`, `SessionStreamPanel.tsx`, and the spec-writer stream parsing in `useArchitectChat.ts`). The key refactor is to separate **event interpretation** (normalize → extract text/media → derive higher-level items) from **presentation** (page-specific chrome/spacing/colors), and to make *media rendering* a shared primitive so “image support for Read” is a one-line enablement in the pipeline, not N separate changes.

## Target architecture

Make the pipeline explicit:

**`SessionStreamEntry[]` → normalize → view-model/IR → render with a “skin”**

- **Normalize:** unify `type` vs `kind`, timestamps (`ts` vs `queuedAt`/`startedAt`/…), runId resolution, and content block shapes.
- **IR (intermediate representation):**
  - *Raw event view models* (one per entry) for “timeline” views.
  - *Derived transcript items* (tool calls/messages grouped) for “summary/chat” views.
- **Render:** one set of React primitives that consume the IR + a `variant`/theme (page styling).

This is the only way you’ll truly implement something like “images for Read results” once: image extraction becomes part of normalization/IR; rendering becomes generic “render attachments”.

---

## Phase 0: inventory + acceptance criteria (fast, prevents thrash)

1. Enumerate all session/run event consumers:
   - `apps/web/src/components/work-items/EventBlock.tsx` (per-entry rendering, tool/message/run/etc).
   - `apps/web/src/components/work-items/RunSummary.tsx` (derived tool/message timeline + special-case Read image).
   - `apps/web/src/components/SessionStreamPanel.tsx` (its own `describeEvent` logic).
   - `apps/web/src/components/spec-writer/hooks/useArchitectChat.ts` (parses stream into chat messages).
2. Decide the **two canonical outputs** you want everywhere:
   - **EventTimeline**: shows every entry (including updates), good for debugging/ops.
   - **Transcript**: condensed “user prompt → tool calls → assistant message(s)” good for humans.
3. Define “done”:
   - All four sites render from the same IR builders.
   - Images appear in all contexts once enabled in extraction (no per-page patches).
   - Unknown/partial events render safely (no crashes).

---

## Phase 1: centralize normalization + content extraction (pure TS, no React)

Create a new module (keep it local to web at first to minimize wiring):

`apps/web/src/session-events/` (or `apps/web/src/lib/session-events/`)

### 1) Canonical types
Define a small set of canonical types that your UIs use, independent of raw wire format:

```ts
export type EventKind = string; // canonicalized "run_completed", "tool_execution_end", etc.

export type MediaAttachment =
  | { kind: "image"; src: string; alt?: string; filename?: string; mimeType?: string }
  | { kind: "file";  href: string; filename?: string };

export type EventCategory = "run" | "tool" | "message" | "permission" | "notice" | "agent" | "turn" | "other";

export type RenderableEvent = {
  id: string;
  seq: number;
  runId?: string;
  kind: EventKind;
  category: EventCategory;
  occurredAt: number;

  title: string;
  detail?: { format: "plain" | "markdown" | "json"; text: string };
  status?: "start" | "pending" | "success" | "error";

  attachments?: MediaAttachment[];

  // optional structured payload for richer UIs
  tool?: { name: string; input?: Record<string, unknown>; durationMs?: number; isError?: boolean };
  message?: { role?: string };
};
```

### 2) Normalization helpers (single source of truth)
Move all these “small but everywhere” utilities out of components:

- `getEventKind(event)` handles `event.type ?? event.kind`.
- `getOccurredAt(event, receivedAt)` centralizes timestamp logic.
- `getCategory(kind)` centralizes categorization.
- `extractText(contentBlocksOrString)` centralizes your repeated `extractTextContent` logic.
- `extractAttachments(...)` centralizes media detection and URL resolution.

### 3) Media URL resolution belongs here
Right now you have **two incompatible ways** to show images:
- `EventBlock` renders `media_ref.url` directly.
- `RunSummary` special-cases `Read` using `/api/files?path=...`.

Unify via a single resolver:

```ts
function resolveLocalFileImage(filePath: string): string {
  return `/api/files?path=${encodeURIComponent(filePath)}`;
}
```

Then in extraction:

- Prefer explicit `media_ref.url` (already a URL).
- Fallback for `Read` (or any file-path tool) when the input is an image and result has no media refs:
  - detect `input.file_path` image extension
  - emit `{ kind: "image", src: resolveLocalFileImage(filePath), alt: filePath, filename: basename(filePath) }`

This one change eliminates the “implement in two places” trap.

### 4) Align content blocks with control-plane (optional but strongly recommended)
Control-plane already defines richer content blocks (`image`, `tool_use`, `tool_result`, etc.). Your workboard `ContentBlock` type currently only really handles `text` and `media_ref`. Add support in extraction for:
- `{type:"image", data, mimeType}` (if it ever arrives) → convert to `data:` URL attachment.
- `tool_result`/`tool_use` blocks → at minimum include in `detail` as text.

You don’t have to fully render them on day 1, but you *do* want them in the IR so later work isn’t re-plumbed.

---

## Phase 2: build the two IR builders (pure TS)

### A) Raw event → `RenderableEvent`
Add `toRenderableEvent(entry: SessionStreamEntry): RenderableEvent`

This replaces:
- `EventBlock`’s giant switch
- `SessionStreamPanel`’s `describeEvent`
- all local per-file timestamp/type/category logic

Implementation pattern that scales:
- a registry keyed by canonical `kind`, each producing `{title, detail, status, attachments, tool/message}`.
- default handler for unknown kinds: `title = kind.replace(/_/g," ")`, `detail = JSON.stringify(safeSubset(event))`.

### B) Derived transcript → `TranscriptItem[]`
Add `buildTranscript(entries, opts)` that *groups* tool executions and messages.

This replaces:
- `RunSummary.buildTimeline`
- spec-writer `buildMessagesFromEntries` (or at least the parsing parts)

Suggested transcript items:

```ts
export type TranscriptItem =
  | { kind: "user_prompt"; seq: number; text: string; occurredAt: number }
  | { kind: "tool_call";   seq: number; tool: {...}; attachments?: MediaAttachment[]; occurredAt: number }
  | { kind: "assistant";   seq: number; text: string; attachments?: MediaAttachment[]; occurredAt: number };
```

Key: the transcript builder should *reuse* the same extraction functions, especially attachments extraction. So “image support” is not a transcript-specific feature.

Mechanically:
- Track tool starts by `toolUseId`, attach end result (and attachments) when end arrives.
- Track message streaming per `messageId` (or runId-scoped buffer) and finalize at `message_end`.
- Sort by `seq` at the end.

---

## Phase 3: centralize rendering primitives (React, but minimal “logic”)

Create:

`apps/web/src/components/session-events/`

### 1) Shared media UI
Move the duplicated `ImageModal`/`ImageThumbnail` out of both `EventBlock` and `RunSummary` into:

- `MediaAttachmentView` (renders one attachment)
- `MediaAttachments` (renders a list)

All image behavior (modal, lazy-loading, filename label) lives here.

### 2) Content renderer
A `DetailView` component that renders `detail` with `format`:
- `"markdown"` → `<MarkdownContent />`
- `"plain"` → `<p>`
- `"json"` → `<pre>`

### 3) Frame vs content split
To support different page styling without duplicating logic, split your event UI into:
- **Content**: `SessionEventContent` renders title/detail/attachments/status.
- **Frame**: “chrome” wrappers that differ by page:
  - `BorderLeftFrame` (like current `EventBlock`)
  - `TimelineDotFrame` (like `SessionStreamPanel`)
  - maybe `MinimalRowFrame` (for compact lists)

Then a single entry component:

```tsx
<SessionEventRow event={renderable} variant="work-item" />
```

The variant selects:
- frame
- class tokens (text sizes, borders, spacing)
- small affordances (show seq badge? truncation threshold? expand/collapse default?)

Use `class-variance-authority` (already in deps) to avoid ad-hoc maps spread across files.

### 4) Theme/variant plumbing
Avoid prop-drilling by adding a context:

```tsx
<SessionEventsThemeProvider variant="inbox-panel">
  ...
</SessionEventsThemeProvider>
```

But keep a simple `variant` prop override for one-offs.

---

## Phase 4: migrate incrementally (keep the app working throughout)

Order matters: migrate the **lowest-risk** uses first.

1. **Extract shared media components** and swap both `EventBlock` and `RunSummary` to use them (no behavior change, just delete duplicates).
2. **Introduce `extractText` + `extractAttachments`** and replace local copies in:
   - `EventBlock`
   - `RunSummary`
   - `SessionStreamPanel`
   - `useArchitectChat`
3. **Replace `SessionStreamPanel.describeEvent`** with `toRenderableEvent` + `SessionEventRow variant="panel"`.
4. **Replace `EventBlock` internals**: either delete `EventBlock` and use `SessionEventRow variant="work-item"` directly, or keep `EventBlock` as a thin wrapper that calls the new renderer.
5. **Replace `RunSummary.buildTimeline`** with `buildTranscript` and render transcript items using shared components.
6. **Spec writer**: swap its stream parsing to use `buildTranscript` (or a `buildChatMessages` wrapper around the same core), so message content extraction isn’t unique code.

At each step you should be deleting code, not moving it.

---

## What “add image support for Read commands” looks like after refactor

You implement it once in extraction:

- In `extractAttachmentsFromTool(toolName, input, resultContentBlocks)`:
  - parse `media_ref` blocks and include image attachments when mimeType/filename indicates image.
  - if tool is `Read` (or any file-path tool) and `input.file_path` is an image and no media refs exist, add the `/api/files?path=...` fallback attachment.

Every UI that renders `attachments` via `MediaAttachments` now shows the image:
- Event timeline (work-items)
- Session stream panel (inbox modal)
- Run summary transcript
- Spec writer chat (if you choose to display attachments there)

No additional per-page work.

---

## Testing strategy (small, high leverage)

1. Add fixtures for representative event sequences:
   - tool start/end with `media_ref` image
   - tool start/end with `Read` + image file path + no `media_ref` result
   - message streaming (start/update/end)
   - unknown event kinds
2. Unit test the pure functions:
   - `toRenderableEvent`
   - `buildTranscript`
   - `extractAttachments`
3. (Optional) lightweight render snapshot tests for `SessionEventRow` in each variant.

This is where you lock in “implement once” behavior.

---

## Practical notes / edge cases to decide early

Media security: `/api/files?path=` currently serves any absolute path with an image extension. That’s convenient but potentially dangerous if a malicious event can reference sensitive files. If there’s any untrusted input path in production, you’ll want to restrict this (e.g., only under a known workspace/run directory). Even if you don’t fix it now, centralizing URL resolution makes it a one-place hardening later.

Performance: `buildTranscript` should be memoized per `(entries, runId)` at call sites; don’t rebuild on every render. Keep it pure and cheap (single pass + maps).

Unknown content blocks: treat them as non-fatal; include a short placeholder in `detail` rather than crashing.

---

