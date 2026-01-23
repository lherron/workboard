import type { ApiClientError } from "@/api/client";
import type {
	ContainerNode,
	ProjectTaskListItem,
	TaskListItem,
	TaskState,
} from "@workboard/shared";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const INBOX_HUB_CARD_SIZE_KEY = "wrkq:inbox-hub-card-size";
export const INBOX_HUB_SORT_KEY = "wrkq:inbox-hub-sort";
export const WEBHOOK_REFRESH_GUARD_MS = 1000;
export const ACTION_STATES = new Set(["idea", "draft", "open", "in_progress", "blocked"]);

// ─────────────────────────────────────────────────────────────────────────────
// Card Size / Density
// ─────────────────────────────────────────────────────────────────────────────

export type CardSize = "compact" | "default" | "expanded";
export const CARD_SIZES: CardSize[] = ["compact", "default", "expanded"];

// ─────────────────────────────────────────────────────────────────────────────
// Sort Options
// ─────────────────────────────────────────────────────────────────────────────

export type InboxSort = "priority" | "state";

// State order for sorting: idea -> draft -> blocked -> open -> in_progress -> completed -> archived -> cancelled -> deleted
export const STATE_SORT_ORDER: Record<TaskState, number> = {
	idea: 0,
	draft: 1,
	blocked: 2,
	open: 3,
	in_progress: 4,
	completed: 5,
	archived: 6,
	cancelled: 7,
	deleted: 8,
};

// ─────────────────────────────────────────────────────────────────────────────
// Component Props & State Types
// ─────────────────────────────────────────────────────────────────────────────

export type InboxHubProps = {
	/** Workspace ID from URL params (for direct task links) */
	initialWorkspaceId?: string;
	/** Task ID from URL params (for direct task links) */
	initialTaskId?: string;
};

export type InboxData = {
	workspaceId: string;
	workspaceName: string;
	containerId: string;
	containerTitle: string;
	containerPath?: string;
	/** Child containers for resolving sub-container paths to IDs */
	childContainers: ContainerNode[];
	tasks: ProjectTaskListItem[];
	loading: boolean;
	error: ApiClientError | null;
};

/** Undo entry for tracking the last manual state change */
export type UndoEntry = {
	workspaceId: string;
	taskId: string;
	taskTitle: string;
	/** Previous state before the change */
	prev: { state: TaskState; priority: number; etag: number };
	/** New state after the change */
	next: { state: TaskState; priority: number; etag: number };
	/** Whether the task was archived (requires restore before state patch) */
	wasArchived: boolean;
	/** Timestamp for auto-dismiss */
	timestamp: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Webhook Types
// ─────────────────────────────────────────────────────────────────────────────

export type WebhookTaskPayload = {
	ticket_id: string;
	ticket_uuid: string;
	project_id: string;
	project_uuid: string;
	state: TaskListItem["state"];
	priority: TaskListItem["priority"];
	kind: TaskListItem["kind"];
	run_status?: TaskListItem["run_status"];
	resolution?: TaskListItem["resolution"];
	meta?: TaskListItem["meta"];
	etag: TaskListItem["etag"];
	cp_project_id?: TaskListItem["cp_project_id"];
	cp_run_id?: TaskListItem["cp_run_id"];
	cp_session_id?: TaskListItem["cp_session_id"];
	sdk_session_id?: TaskListItem["sdk_session_id"];
	blocked_by?: TaskListItem["blocked_by"];
};
