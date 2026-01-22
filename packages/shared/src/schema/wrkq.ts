/**
 * WRKQ Protocol Schemas
 *
 * Zod schemas for WRKQ task management API endpoints.
 * Migrated from webwrkq/packages/shared to support control-plane integration.
 */
import { z } from "zod";

// ============================================================================
// ENUMS
// ============================================================================

export const taskStateSchema = z.enum([
	"idea",
	"draft",
	"open",
	"in_progress",
	"completed",
	"archived",
	"blocked",
	"cancelled",
	"deleted",
]);
export type TaskState = z.infer<typeof taskStateSchema>;

export const taskKindSchema = z.enum(["task", "subtask", "spike", "bug", "chore"]);
export type TaskKind = z.infer<typeof taskKindSchema>;

export const containerKindSchema = z.enum(["project", "feature", "area", "misc"]);
export type ContainerKind = z.infer<typeof containerKindSchema>;

export const sectionRoleSchema = z.enum(["backlog", "ready", "active", "review", "done"]);
export type SectionRole = z.infer<typeof sectionRoleSchema>;

export const taskRelationKindSchema = z.enum(["blocks", "relates_to", "duplicates"]);
export type TaskRelationKind = z.infer<typeof taskRelationKindSchema>;

export const actorRoleSchema = z.enum(["human", "agent", "system"]);
export type ActorRole = z.infer<typeof actorRoleSchema>;

export const globalTaskIdSchema = z.string();

export const taskRunStatusSchema = z.enum([
	"queued",
	"running",
	"completed",
	"failed",
	"cancelled",
	"timed_out",
]);
export type TaskRunStatus = z.infer<typeof taskRunStatusSchema>;

// ============================================================================
// CONTAINER SCHEMAS
// ============================================================================

export type ContainerNode = {
	uuid: string;
	id: string;
	slug: string;
	title: string;
	path: string;
	parent_uuid: string | null;
	kind: ContainerKind;
	sort_index: number;
	section_uuid: string | null;
	etag: number;
	open_task_count: number;
	total_task_count: number;
	children: ContainerNode[];
};

export const containerNodeSchema: z.ZodType<ContainerNode> = z.lazy(() =>
	z.object({
		uuid: z.string(),
		id: z.string(),
		slug: z.string(),
		title: z.string(),
		path: z.string(),
		parent_uuid: z.string().nullable(),
		kind: containerKindSchema,
		sort_index: z.number().int(),
		section_uuid: z.string().nullable(),
		etag: z.number(),
		open_task_count: z.number().int().nonnegative(),
		total_task_count: z.number().int().nonnegative(),
		children: z.array(containerNodeSchema),
	}),
);

export const containersTreeResponseSchema = z.object({
	containers: z.array(containerNodeSchema),
});

export type ContainersTreeResponse = z.infer<typeof containersTreeResponseSchema>;

// Cross-project containers tree response
export const crossProjectContainersTreeSchema = z.object({
	projects: z.array(
		z.object({
			projectId: z.string(),
			projectName: z.string(),
			containers: z.array(containerNodeSchema),
		}),
	),
});

export type CrossProjectContainersTreeResponse = z.infer<typeof crossProjectContainersTreeSchema>;

// Create container request
export const createContainerRequestSchema = z.object({
	slug: z.string().min(1),
	title: z.string().optional(),
	kind: containerKindSchema.optional(),
	parents: z.boolean().optional(), // Create parent containers if they don't exist
});

export type CreateContainerRequest = z.infer<typeof createContainerRequestSchema>;

// Container detail response (single container)
export const containerDetailSchema = z
	.object({
		uuid: z.string(),
		id: z.string(),
		slug: z.string(),
		title: z.string(),
		path: z.string(),
		parent_uuid: z.string().nullable(),
		kind: containerKindSchema,
		sort_index: z.number().int().optional(),
		section_uuid: z.string().nullable().optional(),
		etag: z.number(),
	})
	.passthrough();

export type ContainerDetail = z.infer<typeof containerDetailSchema>;

export const containerDetailResponseSchema = z
	.object({
		container: containerDetailSchema,
	})
	.passthrough();

export type ContainerDetailResponse = z.infer<typeof containerDetailResponseSchema>;

// ============================================================================
// TASK SCHEMAS
// ============================================================================

export const taskListItemSchema = z.object({
	uuid: z.string(),
	id: z.string(),
	slug: z.string(),
	title: z.string(),
	state: taskStateSchema,
	priority: z.number(),
	kind: taskKindSchema,
	requested_by_project_id: z.string().nullable().optional(),
	assigned_project_id: z.string().nullable().optional(),
	acknowledged_at: z.string().nullable().optional(),
	resolution: z.string().nullable().optional(),
	cp_project_id: z.string().nullable().optional(),
	cp_run_id: z.string().nullable().optional(),
	cp_session_id: z.string().nullable().optional(),
	sdk_session_id: z.string().nullable().optional(),
	run_status: taskRunStatusSchema.nullable().optional(),
	blocked_by: z
		.array(
			z.object({
				uuid: z.string(),
				id: z.string(),
				slug: z.string(),
				title: z.string(),
				state: z.string(),
			}),
		)
		.optional(),
	parent_task_uuid: z.string().nullable(),
	assignee: z
		.object({
			uuid: z.string(),
			slug: z.string(),
			role: actorRoleSchema,
		})
		.nullable(),
	due_at: z.string().nullable(),
	labels: z.array(z.string()),
	meta: z.record(z.unknown()),
	updated_at: z.string(),
	etag: z.number(),
	/** Task description/body - optional, included for expanded card views */
	description: z.string().optional(),
});

export type TaskListItem = z.infer<typeof taskListItemSchema>;

export const taskListResponseSchema = z.object({
	container: z.object({
		uuid: z.string(),
		id: z.string(),
		slug: z.string(),
		title: z.string(),
		path: z.string(),
	}),
	tasks: z.array(taskListItemSchema),
});

export type TaskListResponse = z.infer<typeof taskListResponseSchema>;

// Project-level task list (includes project info for each task)
export const projectTaskListItemSchema = taskListItemSchema.extend({
	project: z.object({
		uuid: z.string(),
		id: z.string(),
		slug: z.string(),
		title: z.string(),
		path: z.string(),
	}),
});

export type ProjectTaskListItem = z.infer<typeof projectTaskListItemSchema>;

export const projectTasksResponseSchema = z.object({
	tasks: z.array(projectTaskListItemSchema),
});

export type ProjectTasksResponse = z.infer<typeof projectTasksResponseSchema>;

// Cross-project task list (includes project info for aggregation)
export const crossProjectTaskListItemSchema = projectTaskListItemSchema.extend({
	projectId: z.string(),
	projectName: z.string(),
	global_task_id: globalTaskIdSchema.optional(),
});

export type CrossProjectTaskListItem = z.infer<typeof crossProjectTaskListItemSchema>;

export const crossProjectTasksResponseSchema = z.object({
	tasks: z.array(crossProjectTaskListItemSchema),
	projectCount: z.number().int(),
	totalOpenTasks: z.number().int(),
});

export type CrossProjectTasksResponse = z.infer<typeof crossProjectTasksResponseSchema>;

// ============================================================================
// PROJECT SCHEMAS
// ============================================================================

export const taskProjectSchema = z.object({
	id: z.string(),
	uuid: z.string(),
	slug: z.string(),
	title: z.string(),
	path: z.string(),
	enabled: z.boolean().default(true),
	display_name: z.string().optional(),
});

export type TaskProject = z.infer<typeof taskProjectSchema>;

export const taskProjectsResponseSchema = z.object({
	projects: z.array(taskProjectSchema),
});

export type TaskProjectsResponse = z.infer<typeof taskProjectsResponseSchema>;

// Subtask reference for parent task detail
export const subtaskReferenceSchema = z.object({
	uuid: z.string(),
	id: z.string(),
	slug: z.string(),
	title: z.string(),
	state: taskStateSchema,
	priority: z.number(),
});

export type SubtaskReference = z.infer<typeof subtaskReferenceSchema>;

// Parent task reference for subtask detail
export const parentTaskReferenceSchema = z.object({
	uuid: z.string(),
	id: z.string(),
	slug: z.string(),
	title: z.string(),
});

export type ParentTaskReference = z.infer<typeof parentTaskReferenceSchema>;

export const taskDetailSchema = z.object({
	uuid: z.string(),
	id: z.string(),
	slug: z.string(),
	title: z.string(),
	state: taskStateSchema,
	priority: z.number(),
	kind: taskKindSchema,
	parent_task: parentTaskReferenceSchema.nullable(),
	subtasks: z.array(subtaskReferenceSchema),
	assignee: z
		.object({
			uuid: z.string(),
			slug: z.string(),
			role: actorRoleSchema,
		})
		.nullable(),
	start_at: z.string().nullable(),
	due_at: z.string().nullable(),
	labels: z.array(z.string()),
	meta: z.record(z.unknown()),
	description: z.string(),
	etag: z.number(),
	created_at: z.string(),
	updated_at: z.string(),
	completed_at: z.string().nullable(),
	archived_at: z.string().nullable(),
	deleted_at: z.string().nullable(),
	requested_by_project_id: z.string().nullable().optional(),
	assigned_project_id: z.string().nullable().optional(),
	acknowledged_at: z.string().nullable().optional(),
	resolution: z.string().nullable().optional(),
	cp_project_id: z.string().nullable().optional(),
	cp_run_id: z.string().nullable().optional(),
	cp_session_id: z.string().nullable().optional(),
	sdk_session_id: z.string().nullable().optional(),
	run_status: taskRunStatusSchema.nullable().optional(),
	path: z.string(),
	project: z.object({
		uuid: z.string(),
		id: z.string(),
		slug: z.string(),
		title: z.string(),
		path: z.string(),
	}),
	created_by: z.object({
		slug: z.string(),
		role: actorRoleSchema,
	}),
	updated_by: z.object({
		slug: z.string(),
		role: actorRoleSchema,
	}),
	global_task_id: globalTaskIdSchema.optional(),
});

export type TaskDetail = z.infer<typeof taskDetailSchema>;

export const taskDetailResponseSchema = z.object({
	task: taskDetailSchema,
});

export type TaskDetailResponse = z.infer<typeof taskDetailResponseSchema>;

// ============================================================================
// TASK REQUEST SCHEMAS
// ============================================================================

export const createTaskRequestSchema = z.object({
	slug: z.string().optional(),
	title: z.string().min(1),
	description: z.string().optional(),
	state: taskStateSchema.optional(),
	priority: z.number().int().optional(),
	kind: taskKindSchema.optional(),
	parent_task_uuid: z.string().optional(),
	assignee_actor_uuid: z.string().nullable().optional(),
	requested_by_project_id: z.string().nullable().optional(),
	assigned_project_id: z.string().nullable().optional(),
	resolution: z.string().nullable().optional(),
	labels: z.array(z.string()).optional(),
	meta: z.record(z.unknown()).nullable().optional(),
	due_at: z.string().nullable().optional(),
	start_at: z.string().nullable().optional(),
	cp_project_id: z.string().nullable().optional(),
	cp_run_id: z.string().nullable().optional(),
	cp_session_id: z.string().nullable().optional(),
	sdk_session_id: z.string().nullable().optional(),
	run_status: taskRunStatusSchema.nullable().optional(),
});

export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;

export const updateTaskRequestSchema = z.object({
	title: z.string().min(1).optional(),
	description: z.string().optional(),
	state: taskStateSchema.optional(),
	priority: z.number().int().optional(),
	kind: taskKindSchema.optional(),
	assignee_actor_uuid: z.string().nullable().optional(),
	requested_by_project_id: z.string().nullable().optional(),
	assigned_project_id: z.string().nullable().optional(),
	resolution: z.string().nullable().optional(),
	labels: z.array(z.string()).optional(),
	meta: z.record(z.unknown()).nullable().optional(),
	due_at: z.string().nullable().optional(),
	start_at: z.string().nullable().optional(),
});

export type UpdateTaskRequest = z.infer<typeof updateTaskRequestSchema>;

export const ackTasksRequestSchema = z.object({
	task_ids: z.array(z.string()).min(1),
	force: z.boolean().optional(),
});

export type AckTasksRequest = z.infer<typeof ackTasksRequestSchema>;

// Restore task request - used when restoring deleted/archived tasks
export const restoreTaskRequestSchema = z.object({
	to: z.string().optional(), // Restore to different container/slug (path)
	title: z.string().optional(),
	description: z.string().optional(),
	state: taskStateSchema.exclude(["deleted", "archived"]).optional(), // Target state (default: open)
	priority: z.number().int().min(1).max(4).optional(),
	labels: z.array(z.string()).optional(),
	assignee_actor_uuid: z.string().nullable().optional(),
	comment: z.string().optional(), // Comment explaining restoration
});

export type RestoreTaskRequest = z.infer<typeof restoreTaskRequestSchema>;

// Filter aliases for backward compatibility and convenience
// Note: 'idea' is excluded from default/active views; 'deleted' is hidden unless explicitly requested
const FILTER_ALIASES: Record<string, TaskState[]> = {
	all: [], // empty means no filter - includes all states including deleted
	active: ["open", "in_progress", "blocked"],
	open: ["open", "in_progress", "blocked"], // backward compat: 'open' means active tasks
	deleted: ["deleted"], // explicit filter for deleted tasks only
};

// Parse filter string into array of states
const parseFilterStates = (filter: string): TaskState[] => {
	// Check for aliases first
	if (filter in FILTER_ALIASES) {
		return FILTER_ALIASES[filter];
	}
	// Parse comma-separated states
	const states = filter
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	// Validate each state
	const validStates = taskStateSchema.options;
	return states.filter((s): s is TaskState => validStates.includes(s as TaskState));
};

export const taskListQuerySchema = z.object({
	filter: z
		.string()
		.default("active")
		.transform((val) => parseFilterStates(val)),
	sort: z.enum(["priority", "due", "updated_at"]).default("priority"),
	direction: z.enum(["asc", "desc"]).optional(),
	limit: z.coerce.number().min(1).max(500).default(200),
});

export type TaskListQuery = z.infer<typeof taskListQuerySchema>;

// ============================================================================
// COMMENT SCHEMAS
// ============================================================================

export const taskCommentSchema = z.object({
	uuid: z.string(),
	id: z.string(),
	task_uuid: z.string(),
	actor_slug: z.string(),
	actor_role: actorRoleSchema,
	body: z.string(),
	meta: z.record(z.unknown()).nullable(),
	created_at: z.string(),
	updated_at: z.string().nullable().optional(),
});

export type TaskComment = z.infer<typeof taskCommentSchema>;

export const taskCommentsResponseSchema = z.object({
	task: z.object({
		id: z.string(),
		uuid: z.string(),
	}),
	comments: z.array(taskCommentSchema),
});

export type TaskCommentsResponse = z.infer<typeof taskCommentsResponseSchema>;

export const createCommentRequestSchema = z.object({
	body: z.string().min(1),
	meta: z.record(z.unknown()).optional(),
});

export type CreateCommentRequest = z.infer<typeof createCommentRequestSchema>;

// ============================================================================
// SECTION SCHEMAS
// ============================================================================

export const sectionSchema = z.object({
	uuid: z.string(),
	id: z.string(),
	project_uuid: z.string(),
	slug: z.string(),
	title: z.string(),
	order_index: z.number().int(),
	role: sectionRoleSchema,
	is_default: z.boolean(),
	wip_limit: z.number().int().nullable(),
	meta: z.record(z.unknown()).nullable(),
	created_at: z.string(),
	updated_at: z.string(),
	archived_at: z.string().nullable(),
});

export type Section = z.infer<typeof sectionSchema>;

export const sectionListResponseSchema = z.object({
	project: z.object({
		uuid: z.string(),
		id: z.string(),
		slug: z.string(),
		title: z.string(),
	}),
	sections: z.array(sectionSchema),
});

export type SectionListResponse = z.infer<typeof sectionListResponseSchema>;

export const sectionDetailResponseSchema = z.object({
	section: sectionSchema,
});

export type SectionDetailResponse = z.infer<typeof sectionDetailResponseSchema>;

export const createSectionRequestSchema = z.object({
	slug: z.string().optional(),
	title: z.string().min(1),
	order_index: z.number().int().optional(),
	role: sectionRoleSchema.optional(),
	is_default: z.boolean().optional(),
	wip_limit: z.number().int().nullable().optional(),
	meta: z.record(z.unknown()).optional(),
});

export type CreateSectionRequest = z.infer<typeof createSectionRequestSchema>;

export const updateSectionRequestSchema = z.object({
	title: z.string().min(1).optional(),
	order_index: z.number().int().optional(),
	role: sectionRoleSchema.optional(),
	is_default: z.boolean().optional(),
	wip_limit: z.number().int().nullable().optional(),
	meta: z.record(z.unknown()).optional(),
});

export type UpdateSectionRequest = z.infer<typeof updateSectionRequestSchema>;

// ============================================================================
// TASK RELATION SCHEMAS
// ============================================================================

export const taskRelationWithTasksSchema = z.object({
	from_task: z.object({
		uuid: z.string(),
		id: z.string(),
		slug: z.string(),
		title: z.string(),
		state: taskStateSchema,
	}),
	to_task: z.object({
		uuid: z.string(),
		id: z.string(),
		slug: z.string(),
		title: z.string(),
		state: taskStateSchema,
	}),
	kind: taskRelationKindSchema,
	meta: z.record(z.unknown()).nullable(),
	created_at: z.string(),
});

export type TaskRelationWithTasks = z.infer<typeof taskRelationWithTasksSchema>;

export const taskRelationsResponseSchema = z.object({
	task: z.object({
		uuid: z.string(),
		id: z.string(),
	}),
	outgoing: z.array(taskRelationWithTasksSchema),
	incoming: z.array(taskRelationWithTasksSchema),
});

export type TaskRelationsResponse = z.infer<typeof taskRelationsResponseSchema>;

export const createTaskRelationRequestSchema = z.object({
	to_task_uuid: z.string(),
	kind: taskRelationKindSchema,
	meta: z.record(z.unknown()).optional(),
});

export type CreateTaskRelationRequest = z.infer<typeof createTaskRelationRequestSchema>;

// ============================================================================
// ACTOR DIRECTORY SCHEMAS
// ============================================================================

export const wrkqActorSchema = z.object({
	actor_id: z.string(),
	slug: z.string(),
	display_name: z.string().nullable().optional(),
	role: actorRoleSchema,
	meta: z.record(z.unknown()).nullable().optional(),
	created_at: z.string(),
	updated_at: z.string(),
});

export type WrkqActor = z.infer<typeof wrkqActorSchema>;

export const wrkqActorsResponseSchema = z.object({
	actors: z.array(wrkqActorSchema),
});

export type WrkqActorsResponse = z.infer<typeof wrkqActorsResponseSchema>;

export const wrkqActorResponseSchema = z.object({
	actor: wrkqActorSchema,
});

export type WrkqActorResponse = z.infer<typeof wrkqActorResponseSchema>;

export const createWrkqActorRequestSchema = z.object({
	slug: z.string().min(1),
	display_name: z.string().optional(),
	role: actorRoleSchema.optional(),
	meta: z.record(z.unknown()).optional(),
});

export type CreateWrkqActorRequest = z.infer<typeof createWrkqActorRequestSchema>;

export const updateWrkqActorRequestSchema = z.object({
	slug: z.string().min(1).optional(),
	display_name: z.string().nullable().optional(),
	role: actorRoleSchema.optional(),
	meta: z.record(z.unknown()).nullable().optional(),
});

export type UpdateWrkqActorRequest = z.infer<typeof updateWrkqActorRequestSchema>;

// ============================================================================
// SYNC SCHEMAS
// ============================================================================

export const syncExportRequestSchema = z.object({
	projectId: z.string(),
	scope: z.enum(["project", "full"]).default("project"),
	paths: z.array(z.string()).optional(),
	since: z.string().optional(),
	includeAttachments: z.boolean().default(false),
	includeEvents: z.boolean().default(false),
	includeRefs: z.boolean().default(true),
});

export type SyncExportRequest = z.infer<typeof syncExportRequestSchema>;

export const syncConflictDetailSchema = z.object({
	taskId: z.string(),
	taskUuid: z.string().optional(),
	reason: z.string(),
	diff: z.string().optional(),
});

export type SyncConflictDetail = z.infer<typeof syncConflictDetailSchema>;

export const syncImportResponseSchema = z.object({
	applied: z.number().int(),
	skipped: z.number().int(),
	conflicts: z.number().int(),
	conflictTasks: z.array(z.string()),
	conflictDetails: z.array(syncConflictDetailSchema).optional(),
	message: z.string().optional(),
});

export type SyncImportResponse = z.infer<typeof syncImportResponseSchema>;

// ============================================================================
// CROSS-PROJECT MOVE/COPY SCHEMAS
// ============================================================================

export const crossProjectTaskMoveRequestSchema = z.object({
	toProjectId: z.string(),
	toContainerPath: z.string(),
	copyAttachments: z.boolean().optional(),
	preserveAssignee: z.boolean().optional(),
	preserveState: z.boolean().optional(),
	linkRelation: z.boolean().optional(),
});

export type CrossProjectTaskMoveRequest = z.infer<typeof crossProjectTaskMoveRequestSchema>;

export const crossProjectTaskMoveResponseSchema = z.object({
	source: taskDetailSchema,
	destination: taskDetailSchema,
});

export type CrossProjectTaskMoveResponse = z.infer<typeof crossProjectTaskMoveResponseSchema>;

// ============================================================================
// ERROR SCHEMA
// ============================================================================

export const wrkqApiErrorSchema = z.object({
	message: z.string(),
	details: z.unknown().optional(),
});

export type WrkqApiError = z.infer<typeof wrkqApiErrorSchema>;

// Backwards-compatible alias (webwrkq client)
export const apiErrorSchema = wrkqApiErrorSchema;
export type ApiError = WrkqApiError;

// ============================================================================
// COMPAT: WORKSPACE REGISTRY (admin/projects/wrkq)
// ============================================================================

export const workspaceSchema = z.object({
	id: z.string(),
	name: z.string(),
	root: z.string(),
	dbPath: z.string(),
	enabled: z.boolean().default(true),
	/** Whether the database file exists on disk (annotated at runtime) */
	dbExists: z.boolean().optional(),
});

export type Workspace = z.infer<typeof workspaceSchema>;

export const workspaceListResponseSchema = z.object({
	workspaces: z.array(workspaceSchema),
});

export type WorkspaceListResponse = z.infer<typeof workspaceListResponseSchema>;

export const workspaceContainersTreeSchema = z.object({
	workspaces: z.array(
		z.object({
			workspace: workspaceSchema,
			containers: z.array(containerNodeSchema),
		}),
	),
});

export type WorkspaceContainersTreeResponse = z.infer<typeof workspaceContainersTreeSchema>;

// Deprecated aliases for legacy naming (use project/cross-project schemas instead).
export const workspaceTaskListItemSchema = projectTaskListItemSchema;
export type WorkspaceTaskListItem = ProjectTaskListItem;
export const workspaceTasksResponseSchema = projectTasksResponseSchema;
export type WorkspaceTasksResponse = ProjectTasksResponse;
export const allWorkspacesTaskListItemSchema = crossProjectTaskListItemSchema;
export type AllWorkspacesTaskListItem = CrossProjectTaskListItem;
export const allWorkspacesTasksResponseSchema = crossProjectTasksResponseSchema;
export type AllWorkspacesTasksResponse = CrossProjectTasksResponse;

// ============================================================================
// BATCH TRIAGE SCHEMAS
// ============================================================================

export const batchTriageSkipReasonSchema = z.enum(["not_eligible", "already_running"]);
export type BatchTriageSkipReason = z.infer<typeof batchTriageSkipReasonSchema>;

export const batchTriageStartedItemSchema = z.object({
	taskId: z.string(),
	runId: z.string(),
	sessionId: z.string(),
});
export type BatchTriageStartedItem = z.infer<typeof batchTriageStartedItemSchema>;

export const batchTriageSkippedItemSchema = z.object({
	taskId: z.string(),
	reason: batchTriageSkipReasonSchema,
});
export type BatchTriageSkippedItem = z.infer<typeof batchTriageSkippedItemSchema>;

export const batchTriageBlockedItemSchema = z.object({
	taskId: z.string(),
	blockedBy: z.array(z.string()),
});
export type BatchTriageBlockedItem = z.infer<typeof batchTriageBlockedItemSchema>;

export const batchTriageRequestSchema = z
	.object({
		dryRun: z.boolean().optional(),
	})
	.strict()
	.optional();
export type BatchTriageRequest = z.infer<typeof batchTriageRequestSchema>;

export const batchTriageResponseSchema = z.object({
	started: z.array(batchTriageStartedItemSchema),
	skipped: z.array(batchTriageSkippedItemSchema),
	blocked: z.array(batchTriageBlockedItemSchema),
});
export type BatchTriageResponse = z.infer<typeof batchTriageResponseSchema>;
