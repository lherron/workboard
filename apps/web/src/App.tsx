import {
	type ApiClientError,
	fetchTaskComments,
	fetchTaskDetail,
	fetchTasksForContainer,
	fetchWorkspaceContainersTree,
} from "@/api/client";
import { GlobalDashboard } from "@/components/GlobalDashboard";
import { ProjectDashboard } from "@/components/ProjectDashboard";
import { Sidebar } from "@/components/Sidebar";
import { TaskDetailPanel } from "@/components/TaskDetail";
import { TaskList } from "@/components/TaskList";
import { ActorManagement } from "@/components/actors";
import { ModeToggle, PlanModeView } from "@/components/plan";
import { useQueryParam } from "@/lib/useQueryParam";
import type {
	ContainerNode,
	CrossProjectContainersTreeResponse,
	TaskComment,
	TaskDetail,
	TaskListItem,
} from "@workboard/shared";
import type { TaskState } from "@workboard/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

type WorkspaceTree = CrossProjectContainersTreeResponse["projects"][number];

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

function App() {
	const [workspaceTrees, setWorkspaceTrees] = useState<WorkspaceTree[]>([]);
	const [workspacesLoading, setWorkspacesLoading] = useState(true);
	const [workspacesError, setWorkspacesError] = useState<ApiClientError | null>(null);

	const [selectedWorkspaceId, setSelectedWorkspaceId] = useQueryParam("w");
	const [selectedContainerId, setSelectedContainerId] = useQueryParam("c");
	const [selectedTaskId, setSelectedTaskId] = useQueryParam("t");
	const [mode, setMode] = useQueryParam("mode");
	const [view] = useQueryParam("view");
	const [expanded, setExpanded] = useState<Set<string>>(new Set());

	// Derive current mode from URL param
	const currentMode: "execute" | "plan" = mode === "plan" ? "plan" : "execute";

	// Handle mode switch
	const handleModeChange = (newMode: "execute" | "plan") => {
		if (newMode === "plan") {
			// Clear execute mode state when entering plan mode
			setSelectedWorkspaceId(null, { replace: true });
			setSelectedContainerId(null, { replace: true });
			setSelectedTaskId(null, { replace: true });
			setMode("plan");
		} else {
			// Clear plan mode param when entering execute mode
			setMode(null, { replace: true });
		}
	};

	const [filter, setFilter] = useState<"open" | "all">("open");
	const [sort, setSort] = useState<"priority" | "due" | "updated_at" | "state">("priority");
	const [tasksRequestId, setTasksRequestId] = useState(0);
	const [workspacesRequestId, setWorkspacesRequestId] = useState(0);

	const [tasksState, setTasksState] = useState<TasksState>({
		tasks: [],
		loading: false,
		refreshing: false,
		error: null,
		container: undefined,
		workspaceId: undefined,
	});

	const [taskDetailState, setTaskDetailState] = useState<TaskDetailState>({
		task: undefined,
		loading: false,
		error: null,
	});
	const [taskCommentsState, setTaskCommentsState] = useState<TaskCommentsState>({
		comments: [],
		loading: false,
		error: null,
	});
	const [taskDetailRequestId, setTaskDetailRequestId] = useState(0);
	const [taskCommentsRequestId, setTaskCommentsRequestId] = useState(0);

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

	const containerIndex = useMemo(() => {
		const byId = new Map<string, { workspaceId: string; node: ContainerNode }>();
		const byUuid = new Map<string, { workspaceId: string; node: ContainerNode }>();

		const walk = (workspaceId: string, nodes: ContainerNode[]) => {
			nodes.forEach((node) => {
				byId.set(`${workspaceId}:${node.id}`, { workspaceId, node });
				byUuid.set(`${workspaceId}:${node.uuid}`, { workspaceId, node });
				if (node.children.length) walk(workspaceId, node.children);
			});
		};

		workspaceTrees.forEach((ws) => walk(ws.projectId, ws.containers));

		return { byId, byUuid };
	}, [workspaceTrees]);

	// Validate workspace selection - only redirect if an invalid workspace ID is in the URL
	// If no workspace is selected (null), show the global dashboard instead of auto-selecting
	useEffect(() => {
		if (workspacesLoading || workspacesError) return;

		if (workspaceTrees.length === 0) {
			if (selectedWorkspaceId) setSelectedWorkspaceId(null, { replace: true });
			if (selectedContainerId) setSelectedContainerId(null, { replace: true });
			if (selectedTaskId) setSelectedTaskId(null, { replace: true });
			return;
		}

		// If a workspace is selected, validate it exists
		if (selectedWorkspaceId) {
			const exists = workspaceTrees.some((ws) => ws.projectId === selectedWorkspaceId);
			if (!exists) {
				// Invalid workspace ID in URL - clear it to show global dashboard
				setSelectedWorkspaceId(null, { replace: true });
				setSelectedContainerId(null, { replace: true });
				setSelectedTaskId(null, { replace: true });
			}
		}
		// If no workspace selected, show global dashboard (don't auto-select)
	}, [
		workspacesLoading,
		workspacesError,
		workspaceTrees,
		selectedWorkspaceId,
		selectedContainerId,
		selectedTaskId,
		setSelectedContainerId,
		setSelectedTaskId,
		setSelectedWorkspaceId,
	]);

	// Expand ancestors when container changes
	useEffect(() => {
		if (!selectedWorkspaceId || !selectedContainerId) return;
		const entry = containerIndex.byId.get(`${selectedWorkspaceId}:${selectedContainerId}`);
		if (!entry) return;

		const ancestors: string[] = [];
		let current = entry.node;
		while (current.parent_uuid) {
			const parent = containerIndex.byUuid.get(`${selectedWorkspaceId}:${current.parent_uuid}`);
			if (!parent) break;
			ancestors.push(parent.node.id);
			current = parent.node;
		}

		setExpanded((prev) => {
			const next = new Set(prev);
			[entry.node.id, ...ancestors].forEach((id) => next.add(expandedKey(selectedWorkspaceId, id)));
			return next;
		});
	}, [selectedWorkspaceId, selectedContainerId, containerIndex]);

	// Load tasks for selected container/workspace
	// biome-ignore lint/correctness/useExhaustiveDependencies: tasksRequestId is intentionally used to force re-fetch
	useEffect(() => {
		if (!selectedWorkspaceId || !selectedContainerId) {
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

		const containerEntry = containerIndex.byId.get(`${selectedWorkspaceId}:${selectedContainerId}`);
		if (!containerEntry) {
			setTasksState((prev) => ({
				...prev,
				container: undefined,
				workspaceId: selectedWorkspaceId,
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
			workspaceId: selectedWorkspaceId,
			container: containerInfo,
			loading: prev.tasks.length === 0,
			refreshing: prev.tasks.length > 0,
			error: null,
		}));

		// For 'state' sort, use 'priority' for API call and apply client-side sorting
		const apiSort = sort === "state" ? "priority" : sort;
		fetchTasksForContainer(
			selectedWorkspaceId,
			selectedContainerId,
			{ filter, sort: apiSort },
			controller.signal,
		)
			.then((resp) => {
				const sortedTasks = sort === "state" ? sortTasksByState(resp.tasks) : resp.tasks;
				setTasksState({
					workspaceId: selectedWorkspaceId,
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
	}, [selectedWorkspaceId, selectedContainerId, filter, sort, tasksRequestId, containerIndex]);

	// Keep task selection in sync with list
	useEffect(() => {
		// No container selected at all - clear task selection
		if (!tasksState.container && !selectedContainerId) {
			if (selectedTaskId) setSelectedTaskId(null, { replace: true });
			return;
		}

		// Container selected but tasks not yet loaded - wait for fetch
		if (!tasksState.container || tasksState.container.id !== selectedContainerId) {
			return;
		}

		if (tasksState.loading || tasksState.refreshing) return;

		if (tasksState.tasks.length === 0) {
			if (selectedTaskId) setSelectedTaskId(null, { replace: true });
			return;
		}

		const hasSelected =
			selectedTaskId &&
			tasksState.tasks.some((task) => task.id === selectedTaskId || task.uuid === selectedTaskId);

		if (!hasSelected) {
			setSelectedTaskId(tasksState.tasks[0].id, { replace: true });
		}
	}, [tasksState, selectedTaskId, selectedContainerId, setSelectedTaskId]);

	// Task detail
	// biome-ignore lint/correctness/useExhaustiveDependencies: taskDetailRequestId is intentionally used to force re-fetch
	useEffect(() => {
		if (!selectedTaskId || !selectedWorkspaceId) {
			setTaskDetailState({ task: undefined, loading: false, error: null });
			return;
		}
		const controller = new AbortController();
		setTaskDetailState({ task: undefined, loading: true, error: null });

		fetchTaskDetail(selectedWorkspaceId, selectedTaskId, controller.signal)
			.then((task) => {
				setTaskDetailState({ task, loading: false, error: null });
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setTaskDetailState({ task: undefined, loading: false, error: err as ApiClientError });
			});

		return () => controller.abort();
	}, [selectedWorkspaceId, selectedTaskId, taskDetailRequestId]);

	// Task comments
	// biome-ignore lint/correctness/useExhaustiveDependencies: taskCommentsRequestId is intentionally used to force re-fetch
	useEffect(() => {
		if (!selectedTaskId || !selectedWorkspaceId) {
			setTaskCommentsState({ comments: [], loading: false, error: null });
			return;
		}

		const controller = new AbortController();
		setTaskCommentsState({ comments: [], loading: true, error: null });

		fetchTaskComments(selectedWorkspaceId, selectedTaskId, controller.signal)
			.then((resp) => {
				setTaskCommentsState({ comments: resp.comments, loading: false, error: null });
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setTaskCommentsState({ comments: [], loading: false, error: err as ApiClientError });
			});

		return () => controller.abort();
	}, [selectedWorkspaceId, selectedTaskId, taskCommentsRequestId]);

	const toggleExpanded = (workspaceId: string, containerId: string) => {
		setExpanded((prev) => {
			const next = new Set(prev);
			const key = expandedKey(workspaceId, containerId);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	};

	const selectedWorkspace =
		workspaceTrees.find((ws) => ws.projectId === selectedWorkspaceId) ?? null;
	const selectedWorkspaceContainers = selectedWorkspace?.containers ?? [];

	// Actor Management view
	if (view === "actors") {
		return <ActorManagement />;
	}

	// Plan Mode rendering
	if (currentMode === "plan") {
		return (
			<div className="flex h-screen flex-col overflow-hidden bg-background text-foreground noise-bg">
				{/* Header with mode toggle */}
				<header className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-secondary/40 backdrop-blur-sm flex-shrink-0">
					<div className="flex items-center gap-3">
						<div className="w-6 h-6 border border-primary/50 flex items-center justify-center bg-primary/10">
							<span className="text-primary text-[10px] font-bold font-mono">wq</span>
						</div>
						<span className="text-[12px] font-mono text-foreground/60 hidden sm:inline">
							workboard
						</span>
					</div>
					<ModeToggle mode={currentMode} onChange={handleModeChange} />
				</header>

				{/* Plan Mode content */}
				<div className="flex-1 overflow-hidden">
					<PlanModeView workspaces={workspaceTrees} workspacesLoading={workspacesLoading} />
				</div>
			</div>
		);
	}

	// Execute Mode rendering (original layout)
	return (
		<div className="flex h-screen flex-col overflow-hidden bg-background text-foreground noise-bg">
			{/* Header with mode toggle */}
			<header className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-secondary/40 backdrop-blur-sm flex-shrink-0 md:hidden">
				<div className="flex items-center gap-3">
					<div className="w-6 h-6 border border-primary/50 flex items-center justify-center bg-primary/10">
						<span className="text-primary text-[10px] font-bold font-mono">wq</span>
					</div>
					<span className="text-[12px] font-mono text-foreground/60">workboard</span>
				</div>
				<ModeToggle mode={currentMode} onChange={handleModeChange} />
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
						<ModeToggle mode={currentMode} onChange={handleModeChange} />
					</div>
					<Sidebar
						workspaces={workspaceTrees}
						loading={workspacesLoading}
						error={workspacesError}
						expanded={expanded}
						selectedWorkspaceId={selectedWorkspaceId}
						selectedContainerId={selectedContainerId}
						showGlobalDashboard={!selectedWorkspaceId}
						onSelectWorkspace={(workspaceId) => {
							setSelectedWorkspaceId(workspaceId);
							setSelectedContainerId(null);
							setSelectedTaskId(null);
						}}
						onSelect={(workspaceId, containerId) => {
							setSelectedWorkspaceId(workspaceId);
							setSelectedContainerId(containerId);
							setSelectedTaskId(null);
						}}
						onShowGlobalDashboard={() => {
							setSelectedWorkspaceId(null);
							setSelectedContainerId(null);
							setSelectedTaskId(null);
						}}
						onToggle={toggleExpanded}
						onRetry={loadWorkspaceTrees}
					/>
				</aside>

				<main className="flex-1 overflow-hidden">
					{/* Show global dashboard when no workspace selected */}
					{!selectedWorkspaceId ? (
						<GlobalDashboard
							workspaces={workspaceTrees}
							onSelectWorkspace={(workspaceId) => {
								setSelectedWorkspaceId(workspaceId);
								setSelectedContainerId(null);
								setSelectedTaskId(null);
							}}
							onSelectTask={(workspaceId, containerId, taskId, taskState) => {
								setSelectedWorkspaceId(workspaceId);
								setSelectedContainerId(containerId);
								setSelectedTaskId(taskId);
								if (taskState === "completed" || taskState === "archived") {
									setFilter("all");
								}
							}}
							onTasksChanged={() => {
								setWorkspacesRequestId((n) => n + 1);
							}}
						/>
					) : /* Show workspace dashboard when workspace selected but no container */
					selectedWorkspace && !selectedContainerId ? (
						<ProjectDashboard
							workspace={{ id: selectedWorkspace.projectId, name: selectedWorkspace.projectName }}
							containers={selectedWorkspaceContainers}
							onSelectContainer={(containerId) => {
								setSelectedContainerId(containerId);
								setSelectedTaskId(null);
							}}
							onSelectTask={(containerId, taskId, taskState) => {
								setSelectedContainerId(containerId);
								setSelectedTaskId(taskId);
								// Switch to 'all' filter when navigating to a completed/archived task
								if (taskState === "completed" || taskState === "archived") {
									setFilter("all");
								}
							}}
							onTasksChanged={() => {
								setWorkspacesRequestId((n) => n + 1);
							}}
						/>
					) : (
						<div className="h-full pl-4 pr-0 py-4 md:pl-6 md:py-5">
							<div className="mx-auto h-full max-w-[1800px] grid grid-cols-1 gap-5 xl:grid-cols-[1.0fr,1.0fr] overflow-hidden">
								<TaskList
									workspaceId={selectedWorkspaceId}
									container={tasksState.container}
									tasks={tasksState.tasks}
									loading={tasksState.loading}
									refreshing={tasksState.refreshing}
									error={tasksState.error}
									filter={filter}
									sort={sort}
									selectedTaskId={selectedTaskId}
									onFilterChange={setFilter}
									onSortChange={setSort}
									onSelectTask={(id) => setSelectedTaskId(id)}
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
									workspaceId={selectedWorkspaceId}
									selectedTaskId={selectedTaskId}
									task={taskDetailState.task}
									taskLoading={taskDetailState.loading}
									taskError={taskDetailState.error}
									comments={taskCommentsState.comments}
									commentsLoading={taskCommentsState.loading}
									commentsError={taskCommentsState.error}
									workspaces={workspaceTrees}
									onRetryTask={() => setTaskDetailRequestId((n) => n + 1)}
									onRetryComments={() => setTaskCommentsRequestId((n) => n + 1)}
									onTaskUpdated={(options?: { skipWorkspaceRefresh?: boolean }) => {
										setTaskDetailRequestId((n) => n + 1);
										setTasksRequestId((n) => n + 1);
										if (!options?.skipWorkspaceRefresh) {
											setWorkspacesRequestId((n) => n + 1);
										}
									}}
									onCommentAdded={() => setTaskCommentsRequestId((n) => n + 1)}
								/>
							</div>
						</div>
					)}
				</main>
			</div>
		</div>
	);
}

export default App;
