# Inbox Hub Prototype

A multi-workspace inbox view for quick task capture and triage across all wrkq projects.

## Quick Start

```bash
just start   # Start web dev server (requires control-plane on port 7420)
```

Then visit: **http://localhost:5160/?view=inbox-hub**

## Overview

The Inbox Hub displays one column per wrkq workspace, showing tasks from each workspace's "inbox" container. Users can:

- View all inbox tasks across workspaces in a horizontal kanban layout
- Complete tasks by clicking the checkbox
- Add new tasks inline with the quick-add card
- View/edit task details in a modal

## Files

```
apps/web/src/components/inbox-hub/
├── index.ts              # Exports
├── InboxHub.tsx          # Main container - fetches workspaces, manages state
├── InboxColumn.tsx       # Single workspace column with task list
├── InboxTaskCard.tsx     # Task card with checkbox, title, metadata
├── QuickAddCard.tsx      # Inline task creation form
└── TaskDetailModal.tsx   # Full task editing modal

scripts/
├── mock-api.cjs          # Mock API for testing without control-plane
└── screenshot-prototype.cjs  # Playwright script for screenshots
```

## Route Entry

In `apps/web/src/App.tsx`:
```tsx
const [view] = useQueryParam('view');

// Inbox Hub prototype view
if (view === 'inbox-hub') {
  return <InboxHub />;
}
```

## API Integration

Uses existing API client (`apps/web/src/api/client.ts`):

- `fetchWorkspaceContainersTree()` - Get all workspaces and their containers
- `fetchWorkspaceTasks(workspaceId, opts)` - Get tasks for a workspace
- `fetchTaskDetail(workspaceId, taskId)` - Get full task details
- `createTask(workspaceId, containerId, data)` - Create new task
- `updateTask(workspaceId, taskId, data, etag)` - Update task (used for completion)
- `fetchTaskComments()` / `createComment()` - Comments in modal

## Design Decisions

1. **One column per workspace** - Shows the "inbox" container for each workspace (falls back to first container if no inbox exists)

2. **Column header = workspace name** - Not container name, so you know which project tasks belong to

3. **Priority colors on checkboxes** - P1=red, P2=yellow, P3=green, P4=gray (matches existing app)

4. **Quick-add stays in column** - Creates task in that workspace's inbox container

5. **Refresh on create** - After creating a task, refreshes all data (simpler than optimistic updates with type mismatches)

## What's Working

- [x] Horizontal kanban layout with workspace columns
- [x] Task display with priority-colored checkboxes
- [x] Task completion (checkbox click)
- [x] Quick-add card with title, description, priority
- [x] Task detail modal with editable title/description
- [x] Comments section in modal
- [x] Real API integration with control-plane

## Not Implemented / Future Work

- [ ] Due date picker in quick-add
- [ ] Labels picker in quick-add
- [ ] Drag-and-drop between columns
- [ ] Keyboard navigation (j/k for tasks, Enter to open)
- [ ] Sub-task creation in modal
- [ ] Task navigation arrows in modal (prev/next)
- [ ] Optimistic updates (currently refreshes all data)
- [ ] Filter toggle (show completed tasks)
- [ ] Empty workspace filtering (hide workspaces with no inbox)

## Reference Screenshots

Original design inspiration in `prototype-screenshots/`:
- `horizontal-inbox-overview.png` - Todoist-style reference
- `task-quick-add.png` - Quick-add card reference
- `task-detail-modal.png` - Modal reference

Implementation screenshots:
- `inbox-hub-main.png` - Current main view
- `inbox-hub-quick-add.png` - Current quick-add
- `inbox-hub-task-modal.png` - Current modal

## Known Issues

1. **Workspaces without containers don't show** - This is intentional but might want an empty state

2. **Task filtering by container path** - Currently filters tasks by matching `project.path` to container path, which may not work perfectly for nested containers

3. **Modal doesn't update list on changes** - Title/description edits in modal don't reflect in the card until refresh

## Testing Without Control-Plane

```bash
just start-mock  # Starts mock API + web server
```

The mock API (`scripts/mock-api.cjs`) returns fake workspace/task data for UI testing.
