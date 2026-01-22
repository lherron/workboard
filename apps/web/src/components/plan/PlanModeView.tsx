import {
	type ApiClientError,
	archiveTask,
	fetchAllWorkspacesTasks,
	restoreTask,
	updateTask,
} from "@/api/client";
import { cn } from "@/lib/utils";
import type { CrossProjectContainersTreeResponse, CrossProjectTaskListItem } from "@webwrkq/shared";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KanbanBoard } from "./KanbanBoard";
import { PlanSidebar } from "./PlanSidebar";

type ProjectTree = CrossProjectContainersTreeResponse["projects"][number];

type PlanModeViewProps = {
	workspaces: ProjectTree[];
	workspacesLoading: boolean;
};

export type KanbanColumnDef = {
	id: string;
	title: string;
	subtitle: string;
	tasks: CrossProjectTaskListItem[];
	color: string;
	glow: string;
};

export type PlanFilters = {
	priorities: number[];
	kinds: string[];
	labels: string[];
};

// Retro grid background
function GridBackground() {
	return (
		<div className="absolute inset-0 overflow-hidden pointer-events-none">
			{/* Perspective grid */}
			<div
				className="absolute inset-0 opacity-[0.03]"
				style={{
					backgroundImage: `
            linear-gradient(hsl(80 60% 55% / 0.5) 1px, transparent 1px),
            linear-gradient(90deg, hsl(80 60% 55% / 0.5) 1px, transparent 1px)
          `,
					backgroundSize: "60px 60px",
				}}
			/>
			{/* Gradient overlay */}
			<div
				className="absolute inset-0"
				style={{
					background: `
            radial-gradient(ellipse 80% 50% at 50% 0%, hsl(80 60% 55% / 0.03) 0%, transparent 50%),
            radial-gradient(ellipse 60% 30% at 50% 100%, hsl(80 60% 55% / 0.02) 0%, transparent 50%)
          `,
				}}
			/>
			{/* Scan line effect */}
			<div
				className="absolute inset-0 opacity-[0.015]"
				style={{
					backgroundImage:
						"repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(80 60% 55% / 0.3) 2px, hsl(80 60% 55% / 0.3) 4px)",
				}}
			/>
		</div>
	);
}

// Status indicator component
function StatusIndicator({
	status,
	pulse = false,
}: { status: "online" | "loading" | "error"; pulse?: boolean }) {
	return (
		<div className="flex items-center gap-2">
			<div
				className={cn(
					"w-2 h-2 rounded-full",
					status === "online" && "bg-primary shadow-[0_0_8px_hsl(80_60%_55%)]",
					status === "loading" && "bg-warning shadow-[0_0_8px_hsl(35_85%_55%)] animate-pulse",
					status === "error" && "bg-destructive shadow-[0_0_8px_hsl(0_65%_55%)]",
					pulse && "animate-pulse",
				)}
			/>
			<span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
				{status === "online" && "SYSTEM READY"}
				{status === "loading" && "SYNCING..."}
				{status === "error" && "CONN ERROR"}
			</span>
		</div>
	);
}

export function PlanModeView({ workspaces, workspacesLoading }: PlanModeViewProps) {
	const [tasks, setTasks] = useState<CrossProjectTaskListItem[]>([]);
	const [tasksLoading, setTasksLoading] = useState(true);
	const [tasksError, setTasksError] = useState<ApiClientError | null>(null);
	const [refreshKey, setRefreshKey] = useState(0);

	// Filter state
	const [selectedWorkspaces, setSelectedWorkspaces] = useState<Set<string>>(new Set());
	const [filters, setFilters] = useState<PlanFilters>({
		priorities: [],
		kinds: [],
		labels: [],
	});
	const [showDone, setShowDone] = useState(false);
	const [compactMode, setCompactMode] = useState(false);

	// Initialize selected workspaces when workspaces load
	useEffect(() => {
		if (!workspacesLoading && workspaces.length > 0 && selectedWorkspaces.size === 0) {
			setSelectedWorkspaces(new Set(workspaces.map((w) => w.projectId)));
		}
	}, [workspaces, workspacesLoading, selectedWorkspaces.size]);

	// Fetch all tasks
	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is intentionally used to force re-fetch
	useEffect(() => {
		const controller = new AbortController();
		setTasksLoading(true);
		setTasksError(null);

		fetchAllWorkspacesTasks({ filter: "all", sort: "priority", limit: 500 }, controller.signal)
			.then((resp) => {
				setTasks(resp.tasks);
				setTasksLoading(false);
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setTasksError(err as ApiClientError);
				setTasksLoading(false);
			});

		return () => controller.abort();
	}, [refreshKey]);

	// Refresh handler
	const handleRefresh = useCallback(() => {
		setRefreshKey((k) => k + 1);
	}, []);

	// Filter and organize tasks into columns
	const columns = useMemo((): KanbanColumnDef[] => {
		let filtered = tasks;

		// Filter by selected workspaces
		if (selectedWorkspaces.size > 0) {
			filtered = filtered.filter((t) => selectedWorkspaces.has(t.projectId));
		}

		// Filter by priorities
		if (filters.priorities.length > 0) {
			filtered = filtered.filter((t) => filters.priorities.includes(t.priority));
		}

		// Filter by kinds
		if (filters.kinds.length > 0) {
			filtered = filtered.filter((t) => filters.kinds.includes(t.kind));
		}

		// Filter by labels
		if (filters.labels.length > 0) {
			filtered = filtered.filter((t) => t.labels.some((label) => filters.labels.includes(label)));
		}

		// Sort by priority within each column
		const sortByPriority = (a: CrossProjectTaskListItem, b: CrossProjectTaskListItem) => {
			if (a.priority !== b.priority) return a.priority - b.priority;
			return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
		};

		return [
			{
				id: "ideas",
				title: "IDEAS",
				subtitle: "BRAINSTORM",
				tasks: filtered.filter((t) => t.state === "idea").sort(sortByPriority),
				color: "hsl(190 70% 55%)",
				glow: "hsl(190 70% 55% / 0.3)",
			},
			{
				id: "backlog",
				title: "BACKLOG",
				subtitle: "PRI 3-4",
				tasks: filtered.filter((t) => t.state === "open" && t.priority > 2).sort(sortByPriority),
				color: "hsl(0 0% 45%)",
				glow: "hsl(0 0% 45% / 0.3)",
			},
			{
				id: "ready",
				title: "READY",
				subtitle: "PRI 1-2",
				tasks: filtered.filter((t) => t.state === "open" && t.priority <= 2).sort(sortByPriority),
				color: "hsl(200 70% 55%)",
				glow: "hsl(200 70% 55% / 0.3)",
			},
			{
				id: "active",
				title: "ACTIVE",
				subtitle: "IN_PROGRESS",
				tasks: filtered.filter((t) => t.state === "in_progress").sort(sortByPriority),
				color: "hsl(80 60% 55%)",
				glow: "hsl(80 60% 55% / 0.4)",
			},
			{
				id: "blocked",
				title: "BLOCKED",
				subtitle: "WAITING",
				tasks: filtered.filter((t) => t.state === "blocked").sort(sortByPriority),
				color: "hsl(35 85% 55%)",
				glow: "hsl(35 85% 55% / 0.4)",
			},
			{
				id: "done",
				title: "DONE",
				subtitle: "COMPLETED",
				tasks: showDone
					? filtered
							.filter((t) => t.state === "completed" || t.state === "archived")
							.sort(sortByPriority)
					: [],
				color: "hsl(0 0% 35%)",
				glow: "hsl(0 0% 35% / 0.2)",
			},
		];
	}, [tasks, selectedWorkspaces, filters, showDone]);

	// Handle task state change (from drag or action)
	const handleTaskStateChange = useCallback(
		async (
			taskId: string,
			newState: "idea" | "open" | "in_progress" | "blocked" | "completed" | "archived",
			newPriority?: number,
		) => {
			const task = tasks.find((t) => t.id === taskId);
			if (!task) return;

			const originalTask = { ...task };

			// Optimistic update
			setTasks((prev) =>
				prev.map((t) => {
					if (t.id === taskId) {
						return {
							...t,
							state: newState,
							priority: newPriority ?? t.priority,
						};
					}
					return t;
				}),
			);

			try {
				if (newState === "archived") {
					await archiveTask(task.projectId, taskId, task.etag);
				} else if (originalTask.state === "archived") {
					// Restore from archive first, then update state if needed
					await restoreTask(task.projectId, taskId, task.etag);
					if (newState !== "open") {
						// After restore, update to the target state
						const updates: {
							state?:
								| "idea"
								| "open"
								| "in_progress"
								| "blocked"
								| "completed"
								| "archived"
								| "cancelled";
							priority?: number;
						} = { state: newState };
						if (newPriority !== undefined) {
							updates.priority = newPriority;
						}
						// Need fresh etag after restore
						await updateTask(task.projectId, taskId, updates, task.etag + 1);
					}
				} else {
					const updates: {
						state?:
							| "idea"
							| "open"
							| "in_progress"
							| "blocked"
							| "completed"
							| "archived"
							| "cancelled";
						priority?: number;
					} = { state: newState };
					if (newPriority !== undefined) {
						updates.priority = newPriority;
					}
					await updateTask(task.projectId, taskId, updates, task.etag);
				}
			} catch (err) {
				// Rollback on failure
				console.error("Failed to update task:", err);
				setTasks((prev) =>
					prev.map((t) => {
						if (t.id === taskId) {
							return originalTask;
						}
						return t;
					}),
				);
			}
		},
		[tasks],
	);

	// Get all unique labels across tasks for filter options
	const allLabels = useMemo(() => {
		const labels = new Set<string>();
		tasks.forEach((t) => t.labels.forEach((l) => labels.add(l)));
		return Array.from(labels).sort();
	}, [tasks]);

	// Compute stats
	const stats = useMemo(() => {
		const openTasks = columns.slice(0, 4).reduce((sum, col) => sum + col.tasks.length, 0);
		const activeTasks = columns.find((c) => c.id === "active")?.tasks.length || 0;
		const blockedTasks = columns.find((c) => c.id === "blocked")?.tasks.length || 0;
		return { openTasks, activeTasks, blockedTasks };
	}, [columns]);

	if (tasksLoading || workspacesLoading) {
		return (
			<div className="h-full flex items-center justify-center relative">
				<GridBackground />
				<div className="flex flex-col items-center gap-4 relative z-10">
					<div className="relative">
						<div className="w-16 h-16 border-2 border-primary/30 flex items-center justify-center">
							<Loader2 className="w-8 h-8 text-primary animate-spin" />
						</div>
						<div className="absolute -inset-1 border border-primary/20 animate-pulse" />
					</div>
					<div className="text-center">
						<div className="text-[11px] font-mono text-primary tracking-[0.3em] mb-1">
							INITIALIZING
						</div>
						<div className="text-[10px] font-mono text-muted-foreground/50 tracking-wider">
							Loading task database...
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (tasksError) {
		return (
			<div className="h-full flex items-center justify-center relative">
				<GridBackground />
				<div className="flex flex-col items-center gap-4 relative z-10 max-w-md text-center">
					<div className="w-16 h-16 border-2 border-destructive/50 flex items-center justify-center bg-destructive/5">
						<AlertTriangle className="w-8 h-8 text-destructive" />
					</div>
					<div>
						<div className="text-[11px] font-mono text-destructive tracking-[0.2em] mb-2">
							SYSTEM ERROR
						</div>
						<div className="text-[12px] font-mono text-muted-foreground mb-4">
							{tasksError.message}
						</div>
						<button
							onClick={handleRefresh}
							className="flex items-center gap-2 px-4 py-2 text-[11px] font-mono text-primary border border-primary/40 hover:bg-primary/10 hover:border-primary/60 transition-all mx-auto"
						>
							<RefreshCw className="w-3.5 h-3.5" />
							<span>RETRY CONNECTION</span>
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full flex overflow-hidden relative bg-background">
			<GridBackground />

			{/* Sidebar */}
			<aside className="w-[260px] border-r border-border/60 bg-secondary/80 backdrop-blur-sm flex-shrink-0 overflow-y-auto relative z-10">
				<PlanSidebar
					workspaces={workspaces}
					selectedWorkspaces={selectedWorkspaces}
					onToggleWorkspace={(id) => {
						setSelectedWorkspaces((prev) => {
							const next = new Set(prev);
							if (next.has(id)) {
								next.delete(id);
							} else {
								next.add(id);
							}
							return next;
						});
					}}
					onSelectAll={() => {
						setSelectedWorkspaces(new Set(workspaces.map((w) => w.projectId)));
					}}
					onSelectNone={() => {
						setSelectedWorkspaces(new Set());
					}}
					filters={filters}
					onFiltersChange={setFilters}
					allLabels={allLabels}
					showDone={showDone}
					onShowDoneChange={setShowDone}
					compactMode={compactMode}
					onCompactModeChange={setCompactMode}
					onRefresh={handleRefresh}
					isRefreshing={tasksLoading}
				/>
			</aside>

			{/* Main content - Kanban board */}
			<main className="flex-1 overflow-hidden flex flex-col relative z-10">
				{/* Header */}
				<header className="flex-shrink-0 px-6 py-4 border-b border-border/40 bg-secondary/30 backdrop-blur-sm">
					<div className="flex items-start justify-between">
						<div className="flex items-center gap-4">
							{/* Logo/Icon */}
							<div className="relative">
								<div
									className="w-10 h-10 border-2 flex items-center justify-center"
									style={{
										borderColor: "hsl(80 60% 55% / 0.6)",
										background:
											"linear-gradient(135deg, hsl(80 60% 55% / 0.1) 0%, transparent 50%)",
									}}
								>
									<span className="text-primary text-lg font-bold tracking-tighter">#</span>
								</div>
								<div
									className="absolute -inset-0.5 pointer-events-none"
									style={{
										border: "1px solid hsl(80 60% 55% / 0.2)",
									}}
								/>
							</div>

							<div>
								<h1 className="text-lg font-semibold tracking-wide text-foreground flex items-center gap-3">
									PLANNING BOARD
									<span className="text-[9px] font-mono text-muted-foreground/40 tracking-[0.15em] px-2 py-0.5 border border-border/50">
										v2.0
									</span>
								</h1>
								<div className="text-[10px] font-mono text-muted-foreground/50 tracking-[0.15em] mt-0.5">
									CROSS-WORKSPACE TASK MANAGEMENT
								</div>
							</div>
						</div>

						{/* Stats & Status */}
						<div className="flex items-center gap-6">
							{/* Quick stats */}
							<div className="flex items-center gap-4 text-[10px] font-mono">
								<div className="flex items-center gap-1.5">
									<span className="text-muted-foreground/50">OPEN:</span>
									<span className="text-foreground">{stats.openTasks}</span>
								</div>
								<div className="flex items-center gap-1.5">
									<span className="text-muted-foreground/50">ACTIVE:</span>
									<span className="text-primary">{stats.activeTasks}</span>
								</div>
								{stats.blockedTasks > 0 && (
									<div className="flex items-center gap-1.5">
										<span className="text-muted-foreground/50">BLOCKED:</span>
										<span className="text-warning">{stats.blockedTasks}</span>
									</div>
								)}
							</div>

							<div className="w-px h-4 bg-border/40" />

							<StatusIndicator
								status={tasksLoading ? "loading" : tasksError ? "error" : "online"}
							/>
						</div>
					</div>
				</header>

				{/* Kanban Board */}
				<div className="flex-1 overflow-hidden p-4">
					<KanbanBoard
						columns={columns}
						onTaskStateChange={handleTaskStateChange}
						compactMode={compactMode}
					/>
				</div>
			</main>
		</div>
	);
}
