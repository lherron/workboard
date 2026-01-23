import { debugLog } from "@/lib/utils";
import {
	type AckTasksRequest,
	type BatchTriageRequest,
	type BatchTriageResponse,
	type ContainerDetail,
	type CreateCommentRequest,
	type CreateContainerRequest,
	type CreateTaskRequest,
	type CreateWrkqActorRequest,
	type CrossProjectContainersTreeResponse,
	type CrossProjectTaskMoveRequest,
	type CrossProjectTaskMoveResponse,
	type CrossProjectTasksResponse,
	type ProjectTasksResponse,
	type RestoreTaskRequest,
	type TaskComment,
	type TaskCommentsResponse,
	type TaskDetail,
	type UpdateTaskRequest,
	type UpdateWrkqActorRequest,
	type WorkspaceListResponse,
	type WrkqActor,
	type WrkqActorsResponse,
	batchTriageResponseSchema,
	containerDetailResponseSchema,
	crossProjectContainersTreeSchema,
	crossProjectTaskMoveResponseSchema,
	crossProjectTasksResponseSchema,
	projectTasksResponseSchema,
	taskCommentSchema,
	taskCommentsResponseSchema,
	taskDetailResponseSchema,
	taskRunStatusSchema,
	workspaceListResponseSchema,
	wrkqActorResponseSchema,
	wrkqActorsResponseSchema,
	wrkqApiErrorSchema,
} from "@workboard/shared";
import { type ZodSchema, z } from "zod";

export type ApiClientError = {
	message: string;
	status?: number;
	details?: unknown;
};

const runResponseSchema = z.object({
	runId: z.string(),
	sessionId: z.string(),
	status: z.string().optional(),
});

const runSummarySchema = z.object({
	runId: z.string(),
	projectId: z.string(),
	sessionId: z.string().optional(),
	status: z.string(),
	createdAt: z.number(),
	completedAt: z.number().optional(),
	inputPreview: z.string().optional(),
});

const runListSchema = z.object({
	runs: z.array(runSummarySchema),
	total: z.number().optional(),
});

const runDetailSchema = z
	.object({
		runId: z.string(),
		projectId: z.string(),
		sessionId: z.string().optional(),
		status: z.string(),
		createdAt: z.number().optional(),
		completedAt: z.number().optional(),
		input: z
			.object({
				content: z.string(),
				truncated: z.boolean().optional(),
			})
			.optional(),
		response: z
			.object({
				content: z.string(),
				truncated: z.boolean().optional(),
			})
			.optional(),
		error: z.unknown().optional(),
		toolHistory: z.array(z.record(z.unknown())).optional(),
	})
	.passthrough();

const triageWrkqResponseSchema = z.object({
	runId: z.string(),
	sessionId: z.string(),
	status: taskRunStatusSchema,
	task: z.object({
		id: z.string(),
		uuid: z.string(),
	}),
});

export type StartDetachedRunRequest = {
	projectId: string;
	prompt: string;
	metadata?: Record<string, unknown>;
	session?: {
		policy?: "new" | "resume";
		backendKind?: "agent-sdk-session" | "agent-sdk" | "mock" | "playback" | "pi";
		sessionId?: string;
		model?: "haiku" | "sonnet" | "opus" | "opus-4-5";
	};
	maxTurns?: number;
};

export type StartDetachedRunResponse = z.infer<typeof runResponseSchema>;
export type RunSummary = z.infer<typeof runSummarySchema>;
export type RunListResponse = z.infer<typeof runListSchema>;
export type RunDetail = z.infer<typeof runDetailSchema>;
export type TriageWrkqResponse = z.infer<typeof triageWrkqResponseSchema>;

// Auth token for control-plane API
const CP_TOKEN = import.meta.env.VITE_CP_TOKEN || "dev";
// Default to 'lance' (human actor) for UI-created comments
const WRKQ_ACTOR = import.meta.env.VITE_WRKQ_ACTOR || "lance";

async function parseJsonSafe(res: Response) {
	try {
		return await res.json();
	} catch {
		return null;
	}
}

async function fetchAndValidate<T>(
	url: string,
	schema: z.ZodType<T, z.ZodTypeDef, unknown>,
	init?: RequestInit,
): Promise<T> {
	const headers = new Headers(init?.headers);
	headers.set("x-cp-token", CP_TOKEN);
	headers.set("x-wrkq-actor", WRKQ_ACTOR);

	const response = await fetch(url, { ...init, headers });
	const payload = await parseJsonSafe(response);

	if (!response.ok) {
		const parsedError = payload ? wrkqApiErrorSchema.safeParse(payload) : null;
		const message =
			parsedError?.success && parsedError.data.message
				? parsedError.data.message
				: `Request failed (${response.status})`;
		const details = parsedError?.success ? parsedError.data.details : payload;
		const error: ApiClientError = { message, status: response.status, details };
		throw error;
	}

	const parsed = schema.safeParse(payload);
	if (!parsed.success) {
		throw {
			message: "Unexpected API response shape",
			status: response.status,
			details: parsed.error.flatten(),
		} as ApiClientError;
	}

	return parsed.data;
}

export function fetchContainersTree(
	signal?: AbortSignal,
): Promise<CrossProjectContainersTreeResponse> {
	return fetchAndValidate("/admin/tasks/containers/tree", crossProjectContainersTreeSchema, {
		signal,
	});
}

export function fetchWorkspaces(signal?: AbortSignal): Promise<WorkspaceListResponse> {
	// Fetch from control-plane's existing endpoint
	return fetchAndValidate<WorkspaceListResponse>(
		"/admin/projects/wrkq",
		workspaceListResponseSchema as ZodSchema<WorkspaceListResponse>,
		{ signal },
	);
}

export function fetchWorkspaceContainersTree(
	signal?: AbortSignal,
): Promise<CrossProjectContainersTreeResponse> {
	return fetchAndValidate("/admin/tasks/containers/tree", crossProjectContainersTreeSchema, {
		signal,
	});
}

/**
 * Create a new container.
 * @param workspaceId The workspace/project ID
 * @param parentContainerId Optional parent container ID (for nested containers)
 * @param data Container creation data (slug required, title/kind optional)
 */
export function createContainer(
	workspaceId: string,
	parentContainerId: string | null,
	data: CreateContainerRequest,
): Promise<ContainerDetail> {
	const url = parentContainerId
		? `/admin/tasks/${encodeURIComponent(workspaceId)}/containers/${encodeURIComponent(parentContainerId)}/containers`
		: `/admin/tasks/${encodeURIComponent(workspaceId)}/containers`;
	return fetchAndValidate(url, containerDetailResponseSchema, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	}).then((resp) => resp.container);
}

export function fetchTasksForContainer(
	workspaceId: string,
	_id: string,
	opts: {
		filter: "open" | "all";
		sort: "priority" | "due" | "updated_at";
		direction?: "asc" | "desc";
		includeDescriptionLines?: number;
	},
	signal?: AbortSignal,
): Promise<ProjectTasksResponse> {
	const params = new URLSearchParams({
		filter: opts.filter,
		sort: opts.sort,
	});
	if (opts.direction) params.set("direction", opts.direction);
	if (opts.includeDescriptionLines)
		params.set("includeDescriptionLines", String(opts.includeDescriptionLines));

	// Note: /admin/tasks has project-scoped task lists only (no per-container list).
	// Fetch project tasks; UI applies container selection separately.
	const url = `/admin/tasks/${encodeURIComponent(workspaceId)}/tasks?${params.toString()}`;
	return fetchAndValidate(url, projectTasksResponseSchema, { signal });
}

export function fetchWorkspaceTasks(
	workspaceId: string,
	opts: {
		filter?: string;
		sort?: "priority" | "due" | "updated_at";
		limit?: number;
		includeDescriptionLines?: number;
	},
	signal?: AbortSignal,
): Promise<ProjectTasksResponse> {
	const params = new URLSearchParams();
	if (opts.filter) params.set("filter", opts.filter);
	if (opts.sort) params.set("sort", opts.sort);
	if (opts.limit) params.set("limit", String(opts.limit));
	if (opts.includeDescriptionLines)
		params.set("includeDescriptionLines", String(opts.includeDescriptionLines));

	const url = `/admin/tasks/${encodeURIComponent(workspaceId)}/tasks?${params.toString()}`;
	return fetchAndValidate(url, projectTasksResponseSchema, { signal });
}

export function fetchAllWorkspacesTasks(
	opts: {
		filter?: string;
		sort?: "priority" | "due" | "updated_at";
		limit?: number;
		includeDescriptionLines?: number;
	},
	signal?: AbortSignal,
): Promise<CrossProjectTasksResponse> {
	const params = new URLSearchParams();
	if (opts.filter) params.set("filter", opts.filter);
	if (opts.sort) params.set("sort", opts.sort);
	if (opts.limit) params.set("limit", String(opts.limit));
	if (opts.includeDescriptionLines)
		params.set("includeDescriptionLines", String(opts.includeDescriptionLines));

	const url = `/admin/tasks/tasks?${params.toString()}`;
	return fetchAndValidate(url, crossProjectTasksResponseSchema, { signal });
}

export function startDetachedRun(
	request: StartDetachedRunRequest,
): Promise<StartDetachedRunResponse> {
	const url = "/admin/runs";
	return fetchAndValidate(url, runResponseSchema, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ ...request, mode: "detached" }),
	});
}

// ============================================================================
// WORK ITEMS API
// ============================================================================

const workItemSourceRefSchema = z.object({
	dbPath: z.string(),
	taskUuid: z.string(),
});

const workItemSchema = z.object({
	workItemId: z.string(),
	projectId: z.string(),
	sourceKind: z.string(),
	sourceRef: workItemSourceRefSchema,
	taskStateCache: z.string().optional(),
	taskEtagCache: z.number().optional(),
	taskUpdatedAtMsCache: z.number().optional(),
	policy: z
		.object({
			allowedRoles: z.array(z.string()),
		})
		.optional(),
	createdAt: z.number(),
	updatedAt: z.number(),
	lastActivityAt: z.number(),
});

const workItemsListResponseSchema = z.object({
	workItems: z.array(workItemSchema),
});

const workItemRunSchema = z.object({
	runId: z.string(),
	projectId: z.string(),
	sessionId: z.string().optional(),
	workItemId: z.string().optional(),
	kind: z.string().optional(),
	roleName: z.string().optional(),
	status: z.string(),
	createdAt: z.number(),
	completedAt: z.number().optional(),
});

const workItemRunsResponseSchema = z.object({
	runs: z.array(workItemRunSchema),
});

export type WorkItem = z.infer<typeof workItemSchema>;
export type WorkItemsListResponse = z.infer<typeof workItemsListResponseSchema>;
export type WorkItemRun = z.infer<typeof workItemRunSchema>;
export type WorkItemRunsResponse = z.infer<typeof workItemRunsResponseSchema>;

export function fetchWorkItems(signal?: AbortSignal): Promise<WorkItemsListResponse> {
	return fetchAndValidate("/admin/work-items", workItemsListResponseSchema, { signal });
}

const workItemResponseSchema = z.object({
	workItem: workItemSchema,
	roles: z.array(z.unknown()).optional(),
	status: z.unknown().optional(),
});

export type WorkItemResponse = z.infer<typeof workItemResponseSchema>;

export function fetchWorkItem(workItemId: string, signal?: AbortSignal): Promise<WorkItemResponse> {
	const url = `/admin/work-items/${encodeURIComponent(workItemId)}`;
	return fetchAndValidate(url, workItemResponseSchema, { signal });
}

export function fetchWorkItemRuns(
	workItemId: string,
	signal?: AbortSignal,
): Promise<WorkItemRunsResponse> {
	const url = `/admin/work-items/${encodeURIComponent(workItemId)}/runs`;
	return fetchAndValidate(url, workItemRunsResponseSchema, { signal });
}

// Roster schemas
const actorRefSchema = z.object({
	kind: z.enum(["system", "agent", "human"]),
	name: z.string().optional(),
	memberId: z.string().optional(),
});

const rosterMemberSessionSchema = z.object({
	activeSessionId: z.string().nullable(),
	priorSessionIds: z.array(z.string()).optional(),
});

const rosterMemberSchema = z.object({
	memberId: z.string(),
	roleName: z.string(),
	persona: z.string(),
	agentTarget: z.string(),
	session: rosterMemberSessionSchema,
	state: z.enum(["active", "paused", "retired"]),
	createdAt: z.number(),
	createdBy: actorRefSchema,
});

const rosterSchema = z.object({
	v: z.number(),
	rev: z.number(),
	coordinatorMemberId: z.string().optional(),
	members: z.array(rosterMemberSchema),
	createdAt: z.number(),
	updatedAt: z.number(),
});

const workItemRosterResponseSchema = z.object({
	roster: rosterSchema,
});

export type ActorRef = z.infer<typeof actorRefSchema>;
export type RosterMemberSession = z.infer<typeof rosterMemberSessionSchema>;
export type RosterMember = z.infer<typeof rosterMemberSchema>;
export type Roster = z.infer<typeof rosterSchema>;
export type WorkItemRosterResponse = z.infer<typeof workItemRosterResponseSchema>;

export function fetchWorkItemRoster(
	workItemId: string,
	signal?: AbortSignal,
): Promise<WorkItemRosterResponse> {
	const url = `/admin/work-items/${encodeURIComponent(workItemId)}/roster`;
	return fetchAndValidate(url, workItemRosterResponseSchema, { signal });
}

export function fetchRuns(params: {
	sessionId?: string;
	projectId?: string;
	status?: string;
	limit?: number;
}): Promise<RunListResponse> {
	const query = new URLSearchParams();
	if (params.sessionId) query.set("sessionId", params.sessionId);
	if (params.projectId) query.set("projectId", params.projectId);
	if (params.status) query.set("status", params.status);
	if (params.limit) query.set("limit", String(params.limit));
	const url = `/admin/runs?${query.toString()}`;
	return fetchAndValidate(url, runListSchema);
}

export function fetchRunDetail(runId: string): Promise<RunDetail> {
	const url = `/admin/runs/${encodeURIComponent(runId)}`;
	return fetchAndValidate(url, runDetailSchema);
}

export async function submitMemberTurn(
	workItemId: string,
	memberId: string,
	kind: string,
	prompt: string,
): Promise<void> {
	const url = `/admin/work-items/${encodeURIComponent(workItemId)}/roster/members/${encodeURIComponent(memberId)}/turn`;
	const headers = new Headers();
	headers.set("x-cp-token", CP_TOKEN);
	headers.set("x-wrkq-actor", WRKQ_ACTOR);
	headers.set("Content-Type", "application/json");

	const response = await fetch(url, {
		method: "POST",
		headers,
		body: JSON.stringify({ kind, prompt }),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Failed to submit turn: ${response.status} ${text}`);
	}
}

export async function submitWorkItemRun(
	workItemId: string,
	sessionId: string,
	roleName: string,
	kind: string,
	prompt: string,
): Promise<void> {
	const url = `/admin/work-items/${encodeURIComponent(workItemId)}/runs`;
	const headers = new Headers();
	headers.set("x-cp-token", CP_TOKEN);
	headers.set("x-wrkq-actor", WRKQ_ACTOR);
	headers.set("Content-Type", "application/json");

	const body = {
		roleName,
		kind,
		prompt,
		session: {
			policy: "resume",
			sessionId,
		},
	};
	debugLog("[submitWorkItemRun]", "POST", url, body);

	const response = await fetch(url, {
		method: "POST",
		headers,
		body: JSON.stringify(body),
	});

	const text = await response.text();
	debugLog("[submitWorkItemRun]", "response", response.status, text);

	if (!response.ok) {
		throw new Error(`Failed to submit run: ${response.status} ${text}`);
	}
}

export function startAsyncTriage(workspaceId: string, taskId: string): Promise<TriageWrkqResponse> {
	const url = `/admin/tasks/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/triage_wrkq`;
	return fetchAndValidate(url, triageWrkqResponseSchema, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({}),
	});
}

export function startGeminiTriage(
	workspaceId: string,
	taskId: string,
): Promise<TriageWrkqResponse> {
	const url = `/admin/tasks/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/triage_wrkq_gemini`;
	return fetchAndValidate(url, triageWrkqResponseSchema, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({}),
	});
}

export function fetchTaskDetail(
	workspaceId: string,
	id: string,
	signal?: AbortSignal,
): Promise<TaskDetail> {
	const url = `/admin/tasks/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(id)}`;
	return fetchAndValidate(url, taskDetailResponseSchema, { signal }).then((resp) => resp.task);
}

export function fetchTaskComments(
	workspaceId: string,
	id: string,
	signal?: AbortSignal,
): Promise<TaskCommentsResponse> {
	const url = `/admin/tasks/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(id)}/comments`;
	return fetchAndValidate(url, taskCommentsResponseSchema, { signal });
}

export function createTask(
	workspaceId: string,
	containerId: string,
	data: CreateTaskRequest,
): Promise<TaskDetail> {
	const url = `/admin/tasks/${encodeURIComponent(workspaceId)}/containers/${encodeURIComponent(containerId)}/tasks`;
	return fetchAndValidate(url, taskDetailResponseSchema, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	}).then((resp) => resp.task);
}

export function updateTask(
	workspaceId: string,
	id: string,
	data: UpdateTaskRequest,
	etag: number,
): Promise<TaskDetail> {
	const url = `/admin/tasks/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(id)}`;
	return fetchAndValidate(url, taskDetailResponseSchema, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
			"If-Match": String(etag),
		},
		body: JSON.stringify(data),
	}).then((resp) => resp.task);
}

export function archiveTask(workspaceId: string, id: string, etag: number): Promise<TaskDetail> {
	const url = `/admin/tasks/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(id)}/archive`;
	return fetchAndValidate(url, taskDetailResponseSchema, {
		method: "POST",
		headers: { "If-Match": String(etag) },
	}).then((resp) => resp.task);
}

export function restoreTask(
	workspaceId: string,
	id: string,
	etag: number,
	data?: RestoreTaskRequest,
): Promise<TaskDetail> {
	const url = `/admin/tasks/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(id)}/restore`;
	const headers: Record<string, string> = { "If-Match": String(etag) };
	if (data) headers["Content-Type"] = "application/json";
	return fetchAndValidate(url, taskDetailResponseSchema, {
		method: "POST",
		headers,
		body: data ? JSON.stringify(data) : undefined,
	}).then((resp) => resp.task);
}

export function createComment(
	workspaceId: string,
	taskId: string,
	data: CreateCommentRequest,
): Promise<TaskComment> {
	const url = `/admin/tasks/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/comments`;
	return fetchAndValidate(url, taskCommentSchema, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
}

export async function deleteTask(workspaceId: string, id: string): Promise<void> {
	const url = `/admin/tasks/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(id)}`;
	const headers = new Headers();
	headers.set("x-cp-token", CP_TOKEN);
	headers.set("x-wrkq-actor", WRKQ_ACTOR);

	const response = await fetch(url, { method: "DELETE", headers });

	if (!response.ok) {
		const payload = await parseJsonSafe(response);
		const parsedError = payload ? wrkqApiErrorSchema.safeParse(payload) : null;
		const message =
			parsedError?.success && parsedError.data.message
				? parsedError.data.message
				: `Delete failed (${response.status})`;
		const details = parsedError?.success ? parsedError.data.details : payload;
		throw { message, status: response.status, details } as ApiClientError;
	}
}

export async function deleteContainer(workspaceId: string, id: string): Promise<void> {
	const url = `/admin/tasks/${encodeURIComponent(workspaceId)}/containers/${encodeURIComponent(id)}`;
	const headers = new Headers();
	headers.set("x-cp-token", CP_TOKEN);
	headers.set("x-wrkq-actor", WRKQ_ACTOR);

	const response = await fetch(url, { method: "DELETE", headers });

	if (!response.ok) {
		const payload = await parseJsonSafe(response);
		const parsedError = payload ? wrkqApiErrorSchema.safeParse(payload) : null;
		const message =
			parsedError?.success && parsedError.data.message
				? parsedError.data.message
				: `Delete failed (${response.status})`;
		const details = parsedError?.success ? parsedError.data.details : payload;
		throw { message, status: response.status, details } as ApiClientError;
	}
}

export async function ackTasks(data: AckTasksRequest): Promise<void> {
	const url = "/admin/tasks/ack";
	const headers = new Headers();
	headers.set("x-cp-token", CP_TOKEN);
	headers.set("x-wrkq-actor", WRKQ_ACTOR);
	headers.set("Content-Type", "application/json");

	const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(data) });

	if (!response.ok) {
		const payload = await parseJsonSafe(response);
		const parsedError = payload ? wrkqApiErrorSchema.safeParse(payload) : null;
		const message =
			parsedError?.success && parsedError.data.message
				? parsedError.data.message
				: `Ack failed (${response.status})`;
		const details = parsedError?.success ? parsedError.data.details : payload;
		throw { message, status: response.status, details } as ApiClientError;
	}
}

// ============================================================================
// ACTOR DIRECTORY
// ============================================================================

export function fetchActors(signal?: AbortSignal): Promise<WrkqActorsResponse> {
	return fetchAndValidate("/admin/tasks/actors", wrkqActorsResponseSchema, { signal });
}

export function fetchActor(actorId: string, signal?: AbortSignal): Promise<WrkqActor> {
	const url = `/admin/tasks/actors/${encodeURIComponent(actorId)}`;
	return fetchAndValidate(url, wrkqActorResponseSchema, { signal }).then((resp) => resp.actor);
}

export function createActor(data: CreateWrkqActorRequest): Promise<WrkqActor> {
	return fetchAndValidate("/admin/tasks/actors", wrkqActorResponseSchema, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	}).then((resp) => resp.actor);
}

export function updateActor(actorId: string, data: UpdateWrkqActorRequest): Promise<WrkqActor> {
	const url = `/admin/tasks/actors/${encodeURIComponent(actorId)}`;
	return fetchAndValidate(url, wrkqActorResponseSchema, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	}).then((resp) => resp.actor);
}

// ============================================================================
// CROSS-PROJECT TASK MOVE
// ============================================================================

/**
 * Move a task to a different project.
 * @param globalTaskId Format: {projectId}:{taskId} (e.g., "rex:T-00001")
 * @param request Move options including destination project and container path
 */
export function moveTask(
	globalTaskId: string,
	request: CrossProjectTaskMoveRequest,
): Promise<CrossProjectTaskMoveResponse> {
	const url = `/admin/tasks/tasks/${encodeURIComponent(globalTaskId)}/move`;
	return fetchAndValidate(url, crossProjectTaskMoveResponseSchema, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});
}

/**
 * Fetch inbox tasks from all projects (cross-project aggregation)
 */
export function fetchInboxTasks(
	opts: {
		filter?: string;
		sort?: "priority" | "due" | "updated_at";
		limit?: number;
		includeDescriptionLines?: number;
	},
	signal?: AbortSignal,
): Promise<CrossProjectTasksResponse> {
	const params = new URLSearchParams();
	if (opts.filter) params.set("filter", opts.filter);
	if (opts.sort) params.set("sort", opts.sort);
	if (opts.limit) params.set("limit", String(opts.limit));
	if (opts.includeDescriptionLines)
		params.set("includeDescriptionLines", String(opts.includeDescriptionLines));

	const url = `/admin/tasks/inbox?${params.toString()}`;
	return fetchAndValidate(url, crossProjectTasksResponseSchema, { signal });
}

// ============================================================================
// TERMINAL API
// ============================================================================

export type TerminalLaunchRequest = {
	projectId: string;
	location?: "tab" | "window";
	cwd?: string;
	origin?: string;
	preset?: "wrkq.triage" | "wrkq.implement" | "interactive";
	prompt?: string;
	tool?: {
		kind?: "clod" | "codex" | "shell";
		resume?: {
			policy?: "auto" | "force" | "never";
			sdkSessionId?: string;
		};
		command?: string;
	};
	task?: {
		id: string;
		slug?: string;
		title?: string;
	};
	env?: Record<string, string>;
	keepOpen?: boolean;
	title?: {
		mode?: "auto" | "custom" | "off";
		text?: string;
		maxLen?: number;
	};
	statusbar?: {
		left?: string;
		center?: string;
		right?: string;
		visible?: boolean;
		toggle?: boolean;
		scope?: "surface" | "window";
		fgColor?: string;
		bgColor?: string;
	};
	foregroundColor?: string;
	backgroundColor?: string;
};

export type TerminalLaunchResponse = {
	success: boolean;
	terminalId?: string;
	error?: string;
	message?: string;
};

export type OpenTerminalRequest = {
	location?: "tab" | "window";
	working_directory?: string;
	command?: string;
	env?: Record<string, string>;
	statusbar?: {
		left?: string;
		center?: string;
		right?: string;
		visible?: boolean;
		toggle?: boolean;
		scope?: "surface" | "window";
	};
};

export type OpenTerminalResponse = {
	success: boolean;
	message?: string;
};

export type OpenTerminalError = {
	error: string;
	code?: string;
};

/**
 * Launch a terminal via the Rex Control Plane Terminal Launch API.
 * @throws Error with message on failure (503 = Ghostty not available)
 */
export async function launchTerminal(
	request: TerminalLaunchRequest,
): Promise<TerminalLaunchResponse> {
	const headers = new Headers();
	headers.set("x-cp-token", CP_TOKEN);
	headers.set("Content-Type", "application/json");

	const response = await fetch("/api/terminal/launch", {
		method: "POST",
		headers,
		body: JSON.stringify(request),
	});

	if (!response.ok) {
		const payload = await parseJsonSafe(response);
		if (response.status === 503) {
			throw new Error("Terminal not available. Is Ghostty running?");
		}
		const message = payload?.error || payload?.message || `Request failed (${response.status})`;
		throw new Error(message);
	}

	const payload = await parseJsonSafe(response);
	return { success: true, terminalId: payload?.terminalId };
}

/**
 * Open a new terminal tab/window via the Rex Control Plane Terminal API.
 * @throws Error with message on failure (503 = Ghostty not available)
 */
export async function openTerminal(
	request: OpenTerminalRequest = {},
): Promise<OpenTerminalResponse> {
	const statusbar = request.statusbar ? { ...request.statusbar } : undefined;
	const hasStatusText =
		statusbar &&
		(statusbar.left !== undefined ||
			statusbar.center !== undefined ||
			statusbar.right !== undefined);
	if (
		statusbar &&
		statusbar.visible === undefined &&
		statusbar.toggle === undefined &&
		hasStatusText
	) {
		statusbar.visible = true;
	}
	const headers = new Headers();
	headers.set("x-cp-token", CP_TOKEN);
	headers.set("Content-Type", "application/json");

	const response = await fetch("/api/terminal/new", {
		method: "POST",
		headers,
		body: JSON.stringify({
			location: request.location || "tab",
			working_directory: request.working_directory,
			command: request.command,
			env: request.env,
			statusbar,
		}),
	});

	if (!response.ok) {
		const payload = await parseJsonSafe(response);
		if (response.status === 503) {
			throw new Error("Terminal not available. Is Ghostty running?");
		}
		const message = payload?.error || payload?.message || `Request failed (${response.status})`;
		throw new Error(message);
	}

	return { success: true };
}

/**
 * Fetch a single workspace by ID from the workspaces list.
 */
export async function fetchWorkspaceById(
	workspaceId: string,
	signal?: AbortSignal,
): Promise<{ id: string; name: string; root: string } | null> {
	const response = await fetchWorkspaces(signal);
	const workspace = response.workspaces.find((w) => w.id === workspaceId);
	if (!workspace) return null;
	return {
		id: workspace.id,
		name: workspace.name,
		root: workspace.root,
	};
}

// ============================================================================
// BATCH TRIAGE API
// ============================================================================

/**
 * Start batch triage for all eligible tasks in a container.
 * @param workspaceId The workspace/project ID
 * @param containerId The container ID, UUID, slug, or path
 * @param request Optional request with dryRun flag
 * @returns Response with started, skipped, and blocked task arrays
 */
export function startContainerBatchTriage(
	workspaceId: string,
	containerId: string,
	request?: BatchTriageRequest,
): Promise<BatchTriageResponse> {
	const url = `/admin/tasks/${encodeURIComponent(workspaceId)}/containers/${encodeURIComponent(containerId)}/triage`;
	return fetchAndValidate(url, batchTriageResponseSchema, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request ?? {}),
	});
}

// ============================================================================
// SPEC WRITER API
// ============================================================================

import {
	type CreateSpecRequest,
	type SpecDocument,
	type SpecListResponse,
	type SpecResponse,
	specListResponseSchema,
	specResponseSchema,
} from "@workboard/shared";

/**
 * Fetch all specs for a workspace.
 * @param projectId The workspace/project ID
 * @param signal AbortSignal for request cancellation
 */
export function fetchWorkspaceSpecs(
	projectId: string,
	signal?: AbortSignal,
): Promise<SpecListResponse> {
	const url = `/admin/projects/${encodeURIComponent(projectId)}/specs`;
	return fetchAndValidate(url, specListResponseSchema, { signal });
}

/**
 * Create a new spec.
 * @param projectId The workspace/project ID
 * @param data Creation data (title, optional slug)
 */
export function createWorkspaceSpec(
	projectId: string,
	data: CreateSpecRequest,
): Promise<SpecResponse> {
	const url = `/admin/projects/${encodeURIComponent(projectId)}/specs`;
	return fetchAndValidate(url, specResponseSchema, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
}

/**
 * Fetch a single spec by slug.
 * @param projectId The workspace/project ID
 * @param specSlug The spec's URL slug
 * @param signal AbortSignal for request cancellation
 */
export function fetchWorkspaceSpec(
	projectId: string,
	specSlug: string,
	signal?: AbortSignal,
): Promise<SpecResponse> {
	const url = `/admin/projects/${encodeURIComponent(projectId)}/specs/${encodeURIComponent(specSlug)}`;
	return fetchAndValidate(url, specResponseSchema, { signal });
}

/**
 * Update an existing spec with optimistic concurrency.
 * @param projectId The workspace/project ID
 * @param specSlug The spec's URL slug
 * @param spec The updated spec document
 * @param rev The expected revision (for concurrency control)
 */
export async function updateWorkspaceSpec(
	projectId: string,
	specSlug: string,
	spec: SpecDocument,
	rev: number,
): Promise<SpecResponse> {
	const url = `/admin/projects/${encodeURIComponent(projectId)}/specs/${encodeURIComponent(specSlug)}`;

	const headers = new Headers();
	headers.set("Content-Type", "application/json");
	headers.set("x-cp-token", CP_TOKEN);
	headers.set("x-wrkq-actor", WRKQ_ACTOR);
	headers.set("If-Match", `"${rev}"`);

	const response = await fetch(url, {
		method: "PUT",
		headers,
		body: JSON.stringify({ spec }),
	});

	const payload = await parseJsonSafe(response);

	if (!response.ok) {
		const parsedError = payload ? wrkqApiErrorSchema.safeParse(payload) : null;
		const message =
			parsedError?.success && parsedError.data.message
				? parsedError.data.message
				: response.status === 409
					? "Spec was modified. Please refresh and try again."
					: `Request failed (${response.status})`;
		const details = parsedError?.success ? parsedError.data.details : payload;
		const error: ApiClientError = { message, status: response.status, details };
		throw error;
	}

	const parsed = specResponseSchema.safeParse(payload);
	if (!parsed.success) {
		throw {
			message: "Unexpected API response shape",
			status: response.status,
			details: parsed.error.flatten(),
		} as ApiClientError;
	}

	return parsed.data;
}

/**
 * Delete a spec.
 * @param projectId The workspace/project ID
 * @param specSlug The spec's URL slug
 */
export async function deleteWorkspaceSpec(projectId: string, specSlug: string): Promise<void> {
	const url = `/admin/projects/${encodeURIComponent(projectId)}/specs/${encodeURIComponent(specSlug)}`;

	const headers = new Headers();
	headers.set("x-cp-token", CP_TOKEN);
	headers.set("x-wrkq-actor", WRKQ_ACTOR);

	const response = await fetch(url, {
		method: "DELETE",
		headers,
	});

	if (!response.ok) {
		const payload = await parseJsonSafe(response);
		const parsedError = payload ? wrkqApiErrorSchema.safeParse(payload) : null;
		const message =
			parsedError?.success && parsedError.data.message
				? parsedError.data.message
				: `Request failed (${response.status})`;
		const details = parsedError?.success ? parsedError.data.details : payload;
		const error: ApiClientError = { message, status: response.status, details };
		throw error;
	}
}

// ============================================================================
// PROJECT ROSTER API
// ============================================================================

const projectRosterMemberSessionSchema = z.object({
	activeSessionId: z.string().nullable(),
	harnessSessionId: z.string().nullable().optional(),
	priorSessionIds: z.array(z.string()).optional(),
	sessionStatus: z.string().optional(),
	lastActivityAt: z.number().optional(),
});

const projectRosterMemberSchema = z.object({
	memberId: z.string(),
	roleName: z.string(),
	persona: z.string(),
	agentTarget: z.string(),
	model: z.string().optional(),
	backendKind: z.string().optional(),
	harness: z.union([z.string(), z.record(z.unknown())]).optional(),
	state: z.enum(["active", "paused", "retired"]),
	session: projectRosterMemberSessionSchema,
	run: z
		.object({
			activeRunId: z.string().optional(),
			activeRunStatus: z.string().optional(),
			lastCompletedRunId: z.string().optional(),
			lastOutcome: z.string().optional(),
			awaitingPermission: z.boolean().optional(),
		})
		.optional(),
	createdAt: z.number().optional(),
	createdBy: z.record(z.unknown()).optional(),
	updatedAt: z.number().optional(),
	updatedBy: z.record(z.unknown()).optional(),
});

const projectRosterResponseSchema = z.object({
	roster: z
		.object({
			v: z.number(),
			rev: z.number(),
			coordinatorMemberId: z.string().nullable().optional(),
			members: z.array(projectRosterMemberSchema),
			createdAt: z.number(),
			updatedAt: z.number(),
		})
		.nullable(),
});

const projectAskResponseSchema = z.object({
	runId: z.string(),
	sessionId: z.string(),
	status: z.string(),
	projectId: z.string(),
	roleName: z.string(),
	memberId: z.string(),
	kind: z.string(),
	workspaceId: z.string().optional(),
});

export type ProjectRosterMemberSession = z.infer<typeof projectRosterMemberSessionSchema>;
export type ProjectRosterMember = z.infer<typeof projectRosterMemberSchema>;
export type ProjectRosterResponse = z.infer<typeof projectRosterResponseSchema>;
export type ProjectAskResponse = z.infer<typeof projectAskResponseSchema>;

export type AskOptions = {
	session?: {
		policy?: "resume-or-new" | "new";
	};
};

export type UpsertRoleConfig = {
	persona?: string;
	agentTarget?: string;
	model?: string;
	state?: "active" | "paused";
};

/**
 * Fetch project roster.
 * @param projectId The project ID
 * @param signal AbortSignal for request cancellation
 */
export function fetchProjectRoster(
	projectId: string,
	signal?: AbortSignal,
): Promise<ProjectRosterResponse> {
	const url = `/admin/projects/${encodeURIComponent(projectId)}/roster`;
	return fetchAndValidate(url, projectRosterResponseSchema, { signal });
}

/**
 * Ask the project oracle (auto-creates roster if needed).
 * @param projectId The project ID
 * @param prompt The question/prompt to send
 * @param options Optional ask options (session policy)
 */
export function askProject(
	projectId: string,
	prompt: string,
	options?: AskOptions,
): Promise<ProjectAskResponse> {
	const url = `/admin/projects/${encodeURIComponent(projectId)}/ask`;
	return fetchAndValidate(url, projectAskResponseSchema, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ prompt, ...options }),
	});
}

/**
 * Submit a turn to a specific project role.
 * @param projectId The project ID
 * @param roleName The role name (e.g., "oracle", "reviewer")
 * @param prompt The prompt to send
 */
export function submitProjectRoleTurn(
	projectId: string,
	roleName: string,
	prompt: string,
): Promise<ProjectAskResponse> {
	const url = `/admin/projects/${encodeURIComponent(projectId)}/roster/roles/${encodeURIComponent(roleName)}/turn`;
	return fetchAndValidate(url, projectAskResponseSchema, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ prompt }),
	});
}

/**
 * Create or update a project role.
 * @param projectId The project ID
 * @param roleName The role name to create/update
 * @param config Role configuration
 */
export function upsertProjectRole(
	projectId: string,
	roleName: string,
	config: UpsertRoleConfig,
): Promise<ProjectRosterMember> {
	const url = `/admin/projects/${encodeURIComponent(projectId)}/roster/roles/${encodeURIComponent(roleName)}`;
	return fetchAndValidate(url, projectRosterMemberSchema, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(config),
	});
}

/**
 * Clear a role's active session.
 * @param projectId The project ID
 * @param roleName The role name
 */
export async function clearProjectRoleSession(projectId: string, roleName: string): Promise<void> {
	const url = `/admin/projects/${encodeURIComponent(projectId)}/roster/roles/${encodeURIComponent(roleName)}/session`;

	const headers = new Headers();
	headers.set("x-cp-token", CP_TOKEN);
	headers.set("x-wrkq-actor", WRKQ_ACTOR);

	const response = await fetch(url, {
		method: "DELETE",
		headers,
	});

	if (!response.ok) {
		const payload = await parseJsonSafe(response);
		const parsedError = payload ? wrkqApiErrorSchema.safeParse(payload) : null;
		const message =
			parsedError?.success && parsedError.data.message
				? parsedError.data.message
				: `Request failed (${response.status})`;
		const details = parsedError?.success ? parsedError.data.details : payload;
		const error: ApiClientError = { message, status: response.status, details };
		throw error;
	}
}

/**
 * Fetch runs for a project (for roster conversation history).
 * @param projectId The project ID
 * @param sessionId Optional session ID filter
 * @param signal AbortSignal for request cancellation
 */
export function fetchProjectRuns(
	projectId: string,
	sessionId?: string,
	signal?: AbortSignal,
): Promise<RunListResponse> {
	const params = new URLSearchParams();
	params.set("projectId", projectId);
	if (sessionId) params.set("sessionId", sessionId);
	const url = `/admin/runs?${params.toString()}`;
	return fetchAndValidate(url, runListSchema, { signal });
}
