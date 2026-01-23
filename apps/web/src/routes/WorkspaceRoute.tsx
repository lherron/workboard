import {
	type ApiClientError,
	fetchTaskComments,
	fetchTaskDetail,
	fetchTasksForContainer,
	fetchWorkspaceContainersTree,
} from "@/api/client";
import { ProjectDashboard } from "@/components/ProjectDashboard";
import { Sidebar } from "@/components/Sidebar";
import { TaskDetailPanel } from "@/components/TaskDetail";
import { TaskList } from "@/components/TaskList";
import { ModeToggle } from "@/components/plan";
import { useAppNavigation, useFilterParams } from "@/hooks/useNavigation";
import type {
	ContainerNode,
	CrossProjectContainersTreeResponse,
	TaskComment,
	TaskDetail,
	TaskListItem,
	TaskState,
} from "@workboard/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";

type WorkspaceTree = CrossProjectContainersTreeResponse["projects"][number];

type TasksState = {
	workspaceId?: string;
	container?: {
		id: string;
		slug: string;
		title: string;
		path: string;
	};
	tasks: TaskListItem[];
	loading: boolean;
	refreshing: boolean;
	error: ApiClientError | null;
};

type TaskDetailState = {
	task?: TaskDetail;
	loading: boolean;
	error: ApiClientError | null;
};

type TaskCommentsState = {
	comments: TaskComment[];
	loading: boolean;
	error: ApiClientError | null;
};

const expandedKey = (workspaceId: string, containerId: string) => `${workspaceId}:${containerId}`;

// State order for sorting: idea -> draft -> blocked -> open -> in_progress -> completed -> archived -> cancelled -> deleted
const STATE_SORT_ORDER: Record<TaskState, number> = {
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

function sortTasksByState(tasks: TaskListItem[]): TaskListItem[] {
	return [...tasks].sort((a, b) => {
		const aOrder = STATE_SORT_ORDER[a.state] ?? 99;
		const bOrder = STATE_SORT_ORDER[b.state] ?? 99;
		if (aOrder !== bOrder) return aOrder - bOrder;
		// Secondary sort by priority within the same state
		return a.priority - b.priority;
	});
}

/**
 * Route wrapper for workspace views.
 * Handles /workspace/:workspaceId, /workspace/:workspaceId/:containerId,
 * and /workspace/:workspaceId/:containerId/:taskId routes.
 */
export function WorkspaceRoute() {
	const params = useParams<{ workspaceId?: string; containerId?: string; taskId?: string }>();
	const { workspaceId, containerId, taskId } = params;

	const { goToGlobalDashboard, goToWorkspace, goToContainer, goToTask, goToPlan } =
		useAppNavigation();
	const { filter, sort, setFilter, setSort } = useFilterParams();

	// Workspace data
	const [workspaceTrees, setWorkspaceTrees] = useState<WorkspaceTree[]>([]);
	const [workspacesLoading, setWorkspacesLoading] = useState(true);
	const [workspacesError, setWorkspacesError] = useState<ApiClientError | null>(null);
	const [workspacesRequestId, setWorkspacesRequestId] = useState(0);

	// UI state
	const [expanded, setExpanded] = useState<Set<string>>(new Set());

	// Tasks state
	const [tasksState, setTasksState] = useState<TasksState>({
		tasks: [],
		loading: false,
		refreshing: false,
		error: null,
		container: undefined,
		workspaceId: undefined,
	});
	const [tasksRequestId, setTasksRequestId] = useState(0);

	// Task detail state
	const [taskDetailState, setTaskDetailState] = useState<TaskDetailState>({
		task: undefined,
		loading: false,
		error: null,
	});
	const [taskDetailRequestId, setTaskDetailRequestId] = useState(0);

	// Task comments state
	const [taskCommentsState, setTaskCommentsState] = useState<TaskCommentsState>({
		comments: [],
		loading: false,
		error: null,
	});
	const [taskCommentsRequestId, setTaskCommentsRequestId] = useState(0);

	// Load workspace trees
	const loadWorkspaceTrees = useCallback((isRefresh = false) => {
		const controller = new AbortController();
		if (!isRefresh) {
			setWorkspacesLoading(true);
		}
		setWorkspacesError(null);

		fetchWorkspaceContainersTree(controller.signal)
			.then((resp) => {
				setWorkspaceTrees(resp.projects);
				setWorkspacesLoading(false);
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setWorkspacesError(err as ApiClientError);
				setWorkspacesLoading(false);
			});

		return () => controller.abort();
	}, []);

	useEffect(() => {
		const abort = loadWorkspaceTrees(workspacesRequestId > 0);
		return abort;
	}, [loadWorkspaceTrees, workspacesRequestId]);

	// Build container index for quick lookups
	const containerIndex = useMemo(() => {
		const byId = new Map<string, { workspaceId: string; node: ContainerNode }>();
		const byUuid = new Map<string, { workspaceId: string; node: ContainerNode }>();

		const walk = (wsId: string, nodes: ContainerNode[]) => {
			nodes.forEach((node) => {
				byId.set(`${wsId}:${node.id}`, { workspaceId: wsId, node });
				byUuid.set(`${wsId}:${node.uuid}`, { workspaceId: wsId, node });
				if (node.children.length) walk(wsId, node.children);
			});
		};

		workspaceTrees.forEach((ws) => walk(ws.projectId, ws.containers));

		return { byId, byUuid };
	}, [workspaceTrees]);

	// Validate workspace selection
	useEffect(() => {
		if (workspacesLoading || workspacesError) return;
		if (!workspaceId) return;

		const exists = workspaceTrees.some((ws) => ws.projectId === workspaceId);
		if (!exists) {
			// Invalid workspace ID - redirect to global dashboard
			goToGlobalDashboard();
		}
	}, [workspacesLoading, workspacesError, workspaceTrees, workspaceId, goToGlobalDashboard]);

	// Expand ancestors when container changes
	useEffect(() => {
		if (!workspaceId || !containerId) return;
		const entry = containerIndex.byId.get(`${workspaceId}:${containerId}`);
		if (!entry) return;

		const ancestors: string[] = [];
		let current = entry.node;
		while (current.parent_uuid) {
			const parent = containerIndex.byUuid.get(`${workspaceId}:${current.parent_uuid}`);
			if (!parent) break;
			ancestors.push(parent.node.id);
			current = parent.node;
		}

		setExpanded((prev) => {
			const next = new Set(prev);
			[entry.node.id, ...ancestors].forEach((id) => next.add(expandedKey(workspaceId, id)));
			return next;
		});
	}, [workspaceId, containerId, containerIndex]);

	// Load tasks for selected container
	// biome-ignore lint/correctness/useExhaustiveDependencies: tasksRequestId is intentionally used to force re-fetch
	useEffect(() => {
		if (!workspaceId || !containerId) {
			setTasksState((prev) => ({
				...prev,
				container: undefined,
				workspaceId: undefined,
				tasks: [],
				loading: false,
				refreshing: false,
			}));
			return;
		}

		const containerEntry = containerIndex.byId.get(`${workspaceId}:${containerId}`);
		if (!containerEntry) {
			setTasksState((prev) => ({
				...prev,
				container: undefined,
				workspaceId: workspaceId,
				tasks: [],
				loading: false,
				refreshing: false,
			}));
			return;
		}

		const containerInfo = {
			id: containerEntry.node.id,
			slug: containerEntry.node.slug,
			title: containerEntry.node.title,
			path: containerEntry.node.path,
		};

		const controller = new AbortController();
		setTasksState((prev) => ({
			...prev,
			workspaceId: workspaceId,
			container: containerInfo,
			loading: prev.tasks.length === 0,
			refreshing: prev.tasks.length > 0,
			error: null,
		}));

		// For 'state' sort, use 'priority' for API call and apply client-side sorting
		const apiSort = sort === "state" ? "priority" : sort;
		fetchTasksForContainer(workspaceId, containerId, { filter, sort: apiSort }, controller.signal)
			.then((resp) => {
				const sortedTasks = sort === "state" ? sortTasksByState(resp.tasks) : resp.tasks;
				setTasksState({
					workspaceId: workspaceId,
					container: containerInfo,
					tasks: sortedTasks,
					loading: false,
					refreshing: false,
					error: null,
				});
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setTasksState((prev) => ({
					...prev,
					loading: false,
					refreshing: false,
					error: err as ApiClientError,
				}));
			});

		return () => controller.abort();
	}, [workspaceId, containerId, filter, sort, tasksRequestId, containerIndex]);

	// Auto-select first task when container is loaded but no task is selected
	useEffect(() => {
		// No container selected at all - nothing to do
		if (!containerId) return;

		// Container selected but tasks not yet loaded - wait
		if (!tasksState.container || tasksState.container.id !== containerId) return;
		if (tasksState.loading || tasksState.refreshing) return;

		// No tasks available
		if (tasksState.tasks.length === 0) return;

		// Task already selected and valid
		if (taskId) {
			const exists = tasksState.tasks.some((task) => task.id === taskId || task.uuid === taskId);
			if (exists) return;
		}

		// No valid task selected - select first one
		if (workspaceId && containerId) {
			goToTask(workspaceId, containerId, tasksState.tasks[0].id);
		}
	}, [tasksState, taskId, workspaceId, containerId, goToTask]);

	// Load task detail
	// biome-ignore lint/correctness/useExhaustiveDependencies: taskDetailRequestId is intentionally used to force re-fetch
	useEffect(() => {
		if (!taskId || !workspaceId) {
			setTaskDetailState({ task: undefined, loading: false, error: null });
			return;
		}
		const controller = new AbortController();
		setTaskDetailState({ task: undefined, loading: true, error: null });

		fetchTaskDetail(workspaceId, taskId, controller.signal)
			.then((task) => {
				setTaskDetailState({ task, loading: false, error: null });
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setTaskDetailState({ task: undefined, loading: false, error: err as ApiClientError });
			});

		return () => controller.abort();
	}, [workspaceId, taskId, taskDetailRequestId]);

	// Load task comments
	// biome-ignore lint/correctness/useExhaustiveDependencies: taskCommentsRequestId is intentionally used to force re-fetch
	useEffect(() => {
		if (!taskId || !workspaceId) {
			setTaskCommentsState({ comments: [], loading: false, error: null });
			return;
		}

		const controller = new AbortController();
		setTaskCommentsState({ comments: [], loading: true, error: null });

		fetchTaskComments(workspaceId, taskId, controller.signal)
			.then((resp) => {
				setTaskCommentsState({ comments: resp.comments, loading: false, error: null });
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setTaskCommentsState({ comments: [], loading: false, error: err as ApiClientError });
			});

		return () => controller.abort();
	}, [workspaceId, taskId, taskCommentsRequestId]);

	const toggleExpanded = (wsId: string, cId: string) => {
		setExpanded((prev) => {
			const next = new Set(prev);
			const key = expandedKey(wsId, cId);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	};

	const selectedWorkspace = workspaceTrees.find((ws) => ws.projectId === workspaceId) ?? null;
	const selectedWorkspaceContainers = selectedWorkspace?.containers ?? [];

	const handleModeChange = useCallback(
		(newMode: "execute" | "plan") => {
			if (newMode === "plan") {
				goToPlan();
			}
			// Already in execute mode
		},
		[goToPlan],
	);

	const handleSelectTask = useCallback(
		(newTaskId: string) => {
			if (workspaceId && containerId) {
				goToTask(workspaceId, containerId, newTaskId);
			}
		},
		[workspaceId, containerId, goToTask],
	);

	return (
		<div className="flex h-screen flex-col overflow-hidden bg-background text-foreground noise-bg">
			{/* Header with mode toggle (mobile) */}
			<header className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-secondary/40 backdrop-blur-sm flex-shrink-0 md:hidden">
				<div className="flex items-center gap-3">
					<div className="w-6 h-6 border border-primary/50 flex items-center justify-center bg-primary/10">
						<span className="text-primary text-[10px] font-bold font-mono">wq</span>
					</div>
					<span className="text-[12px] font-mono text-foreground/60">workboard</span>
				</div>
				<ModeToggle mode="execute" onChange={handleModeChange} />
			</header>

			<div className="flex flex-1 overflow-hidden md:flex-row">
				<aside className="w-full bg-secondary/60 md:w-[320px] md:border-r md:border-border/50 flex-shrink-0">
					{/* Mode toggle in sidebar header for desktop */}
					<div className="hidden md:flex items-center justify-between px-4 py-3 border-b border-border/30">
						<div className="flex items-center gap-2">
							<div className="w-5 h-5 border border-primary/50 flex items-center justify-center bg-primary/10">
								<span className="text-primary text-[9px] font-bold font-mono">wq</span>
							</div>
							<span className="text-[11px] font-mono text-foreground/50">workboard</span>
						</div>
						<ModeToggle mode="execute" onChange={handleModeChange} />
					</div>
					<Sidebar
						workspaces={workspaceTrees}
						loading={workspacesLoading}
						error={workspacesError}
						expanded={expanded}
						selectedWorkspaceId={workspaceId || null}
						selectedContainerId={containerId || null}
						showGlobalDashboard={false}
						onSelectWorkspace={(wsId) => goToWorkspace(wsId)}
						onSelect={(wsId, cId) => goToContainer(wsId, cId)}
						onShowGlobalDashboard={goToGlobalDashboard}
						onToggle={toggleExpanded}
						onRetry={loadWorkspaceTrees}
					/>
				</aside>

				<main className="flex-1 overflow-hidden">
					{/* Show workspace dashboard when workspace selected but no container */}
					{selectedWorkspace && !containerId ? (
						<ProjectDashboard
							workspace={{ id: selectedWorkspace.projectId, name: selectedWorkspace.projectName }}
							containers={selectedWorkspaceContainers}
							onSelectContainer={(cId) => goToContainer(workspaceId!, cId)}
							onSelectTask={(cId, tId, taskState) => {
								// Switch to 'all' filter when navigating to a completed/archived task
								if (taskState === "completed" || taskState === "archived") {
									setFilter("all");
								}
								goToTask(workspaceId!, cId, tId);
							}}
							onTasksChanged={() => {
								setWorkspacesRequestId((n) => n + 1);
							}}
						/>
					) : containerId ? (
						/* Show task list and detail when container is selected */
						<div className="h-full pl-4 pr-0 py-4 md:pl-6 md:py-5">
							<div className="mx-auto h-full max-w-[1800px] grid grid-cols-1 gap-5 xl:grid-cols-[1.0fr,1.0fr] overflow-hidden">
								<TaskList
									workspaceId={workspaceId || ""}
									container={tasksState.container}
									tasks={tasksState.tasks}
									loading={tasksState.loading}
									refreshing={tasksState.refreshing}
									error={tasksState.error}
									filter={filter}
									sort={sort}
									selectedTaskId={taskId || null}
									onFilterChange={setFilter}
									onSortChange={setSort}
									onSelectTask={handleSelectTask}
									onRetry={() => setTasksRequestId((n) => n + 1)}
									onTaskCreated={() => {
										setTasksRequestId((n) => n + 1);
										setWorkspacesRequestId((n) => n + 1);
									}}
									onTaskUpdated={() => {
										setTasksRequestId((n) => n + 1);
										setWorkspacesRequestId((n) => n + 1);
									}}
								/>
								<TaskDetailPanel
									workspaceId={workspaceId || ""}
									selectedTaskId={taskId || null}
									task={taskDetailState.task}
									taskLoading={taskDetailState.loading}
									taskError={taskDetailState.error}
									comments={taskCommentsState.comments}
									commentsLoading={taskCommentsState.loading}
									commentsError={taskCommentsState.error}
									onRetryTask={() => setTaskDetailRequestId((n) => n + 1)}
									onRetryComments={() => setTaskCommentsRequestId((n) => n + 1)}
									onTaskUpdated={() => {
										setTaskDetailRequestId((n) => n + 1);
										setTasksRequestId((n) => n + 1);
										setWorkspacesRequestId((n) => n + 1);
									}}
									onCommentAdded={() => setTaskCommentsRequestId((n) => n + 1)}
								/>
							</div>
						</div>
					) : (
						/* Fallback - shouldn't normally reach here */
						<div className="flex items-center justify-center h-full">
							<p className="text-muted-foreground">Loading...</p>
						</div>
					)}
				</main>
			</div>
		</div>
	);
}
