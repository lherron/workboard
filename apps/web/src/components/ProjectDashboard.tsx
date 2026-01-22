import { type ApiClientError, archiveTask, fetchWorkspaceTasks, updateTask } from "@/api/client";
import { formatUpdated } from "@/lib/datetime";
import { formatProjectPath } from "@/lib/taskPaths";
import { cn } from "@/lib/utils";
import type { ContainerNode, ProjectTaskListItem } from "@webwrkq/shared";
import { Archive, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type TaskFilter = "open" | "all";

function FilterToggle({
	value,
	onChange,
	className,
}: {
	value: TaskFilter;
	onChange: (filter: TaskFilter) => void;
	className?: string;
}) {
	const options: { key: TaskFilter; label: string; symbol: string }[] = [
		{ key: "open", label: "OPEN", symbol: "○" },
		{ key: "all", label: "ALL", symbol: "◈" },
	];

	return (
		<div className={cn("flex items-center gap-1 font-mono text-[10px]", className)}>
			<span className="text-muted-foreground/30 mr-1">filter:</span>
			<div className="flex border border-border/40 bg-secondary/30">
				{options.map((opt, idx) => (
					<button
						key={opt.key}
						onClick={() => onChange(opt.key)}
						className={cn(
							"relative px-3 py-1.5 transition-all duration-200 flex items-center gap-1.5",
							"hover:bg-muted/30",
							idx > 0 && "border-l border-border/40",
							value === opt.key
								? "text-primary bg-primary/10"
								: "text-muted-foreground/50 hover:text-muted-foreground",
						)}
					>
						{/* Active indicator bar */}
						{value === opt.key && (
							<div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary/70" />
						)}
						<span
							className={cn("transition-transform duration-200", value === opt.key && "scale-110")}
						>
							{opt.symbol}
						</span>
						<span className="tracking-[0.15em]">{opt.label}</span>
					</button>
				))}
			</div>
			<span className="text-muted-foreground/20 ml-1">│</span>
		</div>
	);
}

type ProjectDashboardProps = {
	workspace: { id: string; name: string };
	containers: ContainerNode[];
	onSelectContainer: (containerId: string) => void;
	onSelectTask?: (containerId: string, taskId: string, taskState?: string) => void;
	onTasksChanged?: () => void;
};

type RowActionState = "idle" | "archiving" | "completing" | "reopening" | "error";

type AggregatedStats = {
	totalTasks: number;
	openTasks: number;
	completedTasks: number;
	containerCount: number;
	topContainers: Array<{
		id: string;
		title: string;
		slug: string;
		path: string;
		open: number;
		total: number;
		depth: number;
	}>;
};

function aggregateStats(containers: ContainerNode[]): AggregatedStats {
	// Root containers already have rolled-up counts (including all children),
	// so we only sum the roots to avoid double counting
	const totalTasks = containers.reduce((sum, c) => sum + c.total_task_count, 0);
	const openTasks = containers.reduce((sum, c) => sum + c.open_task_count, 0);

	// Walk tree to count containers and collect for "top containers" list
	let containerCount = 0;
	const allContainers: AggregatedStats["topContainers"] = [];

	const walk = (nodes: ContainerNode[], depth: number) => {
		nodes.forEach((node) => {
			containerCount++;

			if (node.total_task_count > 0) {
				allContainers.push({
					id: node.id,
					title: node.title || node.slug,
					slug: node.slug,
					path: node.path,
					open: node.open_task_count,
					total: node.total_task_count,
					depth,
				});
			}

			if (node.children.length) {
				walk(node.children, depth + 1);
			}
		});
	};

	walk(containers, 0);

	// Sort by open tasks descending, take top items
	const topContainers = allContainers
		.sort((a, b) => b.open - a.open || b.total - a.total)
		.slice(0, 8);

	return {
		totalTasks,
		openTasks,
		completedTasks: totalTasks - openTasks,
		containerCount,
		topContainers,
	};
}

function StatCard({
	label,
	value,
	sublabel,
	accent = "primary",
	delay = 0,
}: {
	label: string;
	value: number | string;
	sublabel?: string;
	accent?: "primary" | "warning" | "muted";
	delay?: number;
}) {
	const accentClasses = {
		primary: "text-primary border-primary/30",
		warning: "text-warning border-warning/30",
		muted: "text-muted-foreground border-border/50",
	};

	return (
		<div
			className={cn("relative border bg-secondary/30 p-4 animate-fade-in", accentClasses[accent])}
			style={{ animationDelay: `${delay}ms` }}
		>
			{/* Corner decorations */}
			<div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-current opacity-60" />
			<div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-current opacity-60" />
			<div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-current opacity-60" />
			<div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-current opacity-60" />

			<div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">
				{label}
			</div>
			<div
				className={cn("text-3xl font-semibold tracking-tight", accentClasses[accent].split(" ")[0])}
			>
				{value}
			</div>
			{sublabel && (
				<div className="text-[10px] text-muted-foreground/40 mt-1 font-mono">{sublabel}</div>
			)}
		</div>
	);
}

function ActionButton({
	onClick,
	disabled,
	loading,
	variant,
	children,
	title,
}: {
	onClick: (e: React.MouseEvent) => void;
	disabled?: boolean;
	loading?: boolean;
	variant: "default" | "danger" | "success";
	children: React.ReactNode;
	title: string;
}) {
	const variantClasses = {
		default: "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50",
		danger: "text-destructive/70 hover:text-destructive hover:bg-destructive/10",
		success: "text-primary/70 hover:text-primary hover:bg-primary/10",
	};

	return (
		<button
			onClick={onClick}
			disabled={disabled || loading}
			title={title}
			className={cn(
				"p-1.5 rounded transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed",
				variantClasses[variant],
			)}
		>
			{loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : children}
		</button>
	);
}

function TaskRow({
	task,
	index,
	workspaceId,
	filter,
	onSelect,
	onTaskRemoved,
	onTaskStateChanged,
	onTasksChanged,
}: {
	task: ProjectTaskListItem;
	index: number;
	workspaceId: string;
	filter: TaskFilter;
	onSelect: () => void;
	onTaskRemoved: (taskId: string) => void;
	onTaskStateChanged: (taskId: string, newState: string, newEtag: number) => void;
	onTasksChanged?: () => void;
}) {
	const [actionState, setActionState] = useState<RowActionState>("idle");
	const [isHovered, setIsHovered] = useState(false);

	const handleComplete = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!workspaceId || actionState === "completing") return;

		setActionState("completing");
		try {
			const updated = await updateTask(workspaceId, task.id, { state: "completed" }, task.etag);
			// When filter is 'all', keep task in list with updated state; otherwise remove
			if (filter === "all") {
				onTaskStateChanged(task.id, "completed", updated.etag);
			} else {
				onTaskRemoved(task.id);
			}
			onTasksChanged?.();
			setActionState("idle");
		} catch (err) {
			console.error("Failed to complete task:", err);
			setActionState("error");
			setTimeout(() => setActionState("idle"), 2000);
		}
	};

	const handleArchive = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!workspaceId || actionState === "archiving") return;

		setActionState("archiving");
		try {
			const updated = await archiveTask(workspaceId, task.id, task.etag);
			// When filter is 'all', keep task in list with updated state; otherwise remove
			if (filter === "all") {
				onTaskStateChanged(task.id, "archived", updated.etag);
			} else {
				onTaskRemoved(task.id);
			}
			onTasksChanged?.();
			setActionState("idle");
		} catch (err) {
			console.error("Failed to archive task:", err);
			setActionState("error");
			setTimeout(() => setActionState("idle"), 2000);
		}
	};

	const handleReopen = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!workspaceId || actionState === "reopening") return;

		setActionState("reopening");
		try {
			const updated = await updateTask(workspaceId, task.id, { state: "open" }, task.etag);
			// Update task state and etag locally so it stays in the list
			onTaskStateChanged(task.id, "open", updated.etag);
			onTasksChanged?.();
			setActionState("idle");
		} catch (err) {
			console.error("Failed to reopen task:", err);
			setActionState("error");
			setTimeout(() => setActionState("idle"), 2000);
		}
	};

	const prioritySymbol = task.priority <= 1 ? "▬" : task.priority === 2 ? "─" : "─";
	const stateSymbols: Record<string, string> = {
		idea: "✧",
		draft: "◇",
		open: "○",
		in_progress: "◐",
		completed: "●",
		blocked: "◈",
		cancelled: "⊘",
		archived: "◌",
	};
	const stateSymbol = stateSymbols[task.state] || "○";
	const isCompleted = task.state === "completed";
	const isArchived = task.state === "archived";
	const _isDraft = task.state === "draft";
	const canReopen = isCompleted || isArchived;
	const showActions = isHovered;

	return (
		<div
			className={cn(
				"grid grid-cols-[2.5fr,1.5fr,0.5fr,1fr] gap-4 py-2 px-3 border-b border-border/20 hover:bg-muted/30 cursor-pointer group animate-fade-in transition-colors",
				actionState === "error" && "bg-destructive/5",
			)}
			style={{ animationDelay: `${300 + index * 40}ms` }}
			onClick={onSelect}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === "Enter") onSelect();
			}}
		>
			{/* Task title + ID */}
			<div className="min-w-0">
				<div
					className={cn(
						"truncate text-[12px] text-muted-foreground group-hover:text-foreground transition-colors",
						isCompleted && "line-through opacity-60",
					)}
				>
					{task.title}
				</div>
				<div className="text-[9px] text-muted-foreground/40 font-mono truncate">{task.id}</div>
			</div>

			{/* Project */}
			<div className="min-w-0">
				<div className="truncate text-[11px] text-muted-foreground/70">{task.project.title}</div>
				<div className="text-[9px] text-muted-foreground/30 font-mono truncate">
					{formatProjectPath(task.project.path)}
				</div>
			</div>

			{/* Priority */}
			<div className="text-center">
				<span
					className={cn(
						"text-[12px] font-mono",
						task.priority <= 1
							? "text-warning"
							: task.priority === 2
								? "text-primary/70"
								: "text-muted-foreground/50",
					)}
				>
					{prioritySymbol} p{task.priority}
				</span>
			</div>

			{/* Actions or Status */}
			<div className="text-right flex items-center justify-end">
				{showActions || actionState !== "idle" ? (
					<div className="flex items-center gap-1">
						{actionState === "error" ? (
							<span className="text-[9px] text-destructive">failed</span>
						) : canReopen ? (
							<ActionButton
								onClick={handleReopen}
								loading={actionState === "reopening"}
								variant="default"
								title="Re-open task"
							>
								<RotateCcw className="w-3.5 h-3.5" />
							</ActionButton>
						) : (
							<>
								<ActionButton
									onClick={handleComplete}
									loading={actionState === "completing"}
									variant="success"
									title="Mark complete"
								>
									<CheckCircle2 className="w-3.5 h-3.5" />
								</ActionButton>
								<ActionButton
									onClick={handleArchive}
									loading={actionState === "archiving"}
									variant="default"
									title="Archive task"
								>
									<Archive className="w-3.5 h-3.5" />
								</ActionButton>
							</>
						)}
					</div>
				) : (
					<div>
						<div
							className={cn(
								"text-[11px]",
								task.state === "idea" && "text-cyan-300",
								task.state === "draft" && "text-fuchsia-300",
								task.state === "open" && "text-muted-foreground/70",
								task.state === "in_progress" && "text-primary",
								task.state === "blocked" && "text-amber-400",
								(task.state === "completed" ||
									task.state === "cancelled" ||
									task.state === "archived") &&
									"text-muted-foreground/50",
							)}
						>
							{stateSymbol} {task.state.replace("_", " ")}
						</div>
						<div className="text-[9px] text-muted-foreground/30 font-mono">
							{formatUpdated(task.updated_at)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export function ProjectDashboard({
	workspace,
	containers,
	onSelectContainer,
	onSelectTask,
	onTasksChanged,
}: ProjectDashboardProps) {
	const stats = useMemo(() => aggregateStats(containers), [containers]);
	const [tasks, setTasks] = useState<ProjectTaskListItem[]>([]);
	const [tasksLoading, setTasksLoading] = useState(true);
	const [tasksError, setTasksError] = useState<ApiClientError | null>(null);
	const [tasksRequestId, _setTasksRequestId] = useState(0);
	const [taskFilter, setTaskFilter] = useState<TaskFilter>("open");

	const handleTaskRemoved = (taskId: string) => {
		// Optimistically remove task from local state without refetching
		setTasks((prev) => prev.filter((t) => t.id !== taskId));
	};

	const handleTaskStateChanged = (taskId: string, newState: string, newEtag: number) => {
		// Update task state and sync the new etag
		setTasks((prev) =>
			prev.map((t) =>
				t.id === taskId
					? { ...t, state: newState as ProjectTaskListItem["state"], etag: newEtag }
					: t,
			),
		);
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: tasksRequestId is intentionally used to force re-fetch
	useEffect(() => {
		const controller = new AbortController();
		setTasksLoading(true);
		setTasksError(null);

		fetchWorkspaceTasks(
			workspace.id,
			{ filter: taskFilter, sort: "priority", limit: 50 },
			controller.signal,
		)
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
	}, [workspace.id, tasksRequestId, taskFilter]);

	const completionRate =
		stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;

	return (
		<div className="h-full overflow-auto">
			<div className="max-w-4xl mx-auto py-6 px-4">
				{/* Header */}
				<div className="mb-8 animate-fade-in">
					<div className="flex items-center gap-3 mb-2">
						<div className="w-2 h-2 bg-primary animate-pulse" />
						<span className="text-[10px] uppercase tracking-[0.3em] text-primary/70">
							workspace overview
						</span>
					</div>

					<h1 className="text-2xl font-semibold text-foreground tracking-tight mb-1">
						{workspace.name}
					</h1>

					<div className="flex items-center gap-2 text-[11px] text-muted-foreground/50 font-mono">
						<span className="text-primary/50">~</span>
						<span className="truncate">{workspace.id}</span>
					</div>
				</div>

				{/* Stats Grid */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
					<StatCard
						label="Open Tasks"
						value={stats.openTasks}
						sublabel="requiring attention"
						accent="primary"
						delay={50}
					/>
					<StatCard
						label="Completed"
						value={stats.completedTasks}
						sublabel={`${completionRate}% completion`}
						accent="muted"
						delay={100}
					/>
					<StatCard
						label="Total Tasks"
						value={stats.totalTasks}
						sublabel="across workspace"
						accent="muted"
						delay={150}
					/>
					<StatCard
						label="Projects"
						value={stats.containerCount}
						sublabel="containers"
						accent="muted"
						delay={200}
					/>
				</div>

				{/* Overall Progress */}
				<div
					className="border border-border/30 bg-secondary/20 p-4 mb-2 animate-fade-in"
					style={{ animationDelay: "250ms" }}
				>
					<div className="flex items-center justify-between mb-2">
						<span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
							Overall Progress
						</span>
						<span className="text-[11px] font-mono text-primary">
							{stats.completedTasks}/{stats.totalTasks}
						</span>
					</div>
					<div className="h-3 bg-border/20 relative overflow-hidden">
						<div
							className="absolute inset-y-0 left-0 bg-primary/80 transition-all duration-500"
							style={{ width: `${completionRate}%` }}
						/>
						{/* Scanline overlay for terminal effect */}
						<div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.1)_2px,rgba(0,0,0,0.1)_4px)]" />
					</div>
				</div>

				{/* Tasks Section - only show when workspace has tasks */}
				{stats.totalTasks > 0 && (
					<>
						{/* Section Header with Filter */}
						<div
							className="flex items-center gap-3 my-6 animate-fade-in"
							style={{ animationDelay: "300ms" }}
						>
							<div className="text-primary/30 font-mono text-[10px]">╔══</div>
							<div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70 font-semibold">
								{taskFilter === "open" ? "Open Tasks" : "All Tasks"}
							</div>
							<div className="flex-1 border-t border-dashed border-border/30" />
							<FilterToggle value={taskFilter} onChange={setTaskFilter} />
							<div className="text-primary/30 font-mono text-[10px]">══╗</div>
						</div>

						{/* Tasks Content */}
						{tasksLoading ? (
							<div className="py-8 text-center">
								<div className="text-muted-foreground/40 font-mono text-[11px] animate-pulse">
									loading tasks...
								</div>
							</div>
						) : tasksError ? (
							<div className="py-8 text-center">
								<div className="text-error/70 font-mono text-[11px]">{tasksError.message}</div>
							</div>
						) : tasks.length > 0 ? (
							<div
								className="border border-border/30 bg-secondary/10 animate-fade-in"
								style={{ animationDelay: "300ms" }}
							>
								{/* Table Header */}
								<div className="grid grid-cols-[2.5fr,1.5fr,0.5fr,1fr] gap-4 py-2 px-3 border-b border-border/40 bg-secondary/30">
									<span className="text-[9px] uppercase tracking-widest text-muted-foreground/50">
										Task
									</span>
									<span className="text-[9px] uppercase tracking-widest text-muted-foreground/50">
										Project
									</span>
									<span className="text-[9px] uppercase tracking-widest text-muted-foreground/50 text-center">
										Pri
									</span>
									<span className="text-[9px] uppercase tracking-widest text-muted-foreground/50 text-right">
										Status
									</span>
								</div>

								{/* Table Body */}
								{tasks.map((task, idx) => (
									<TaskRow
										key={task.id}
										task={task}
										index={idx}
										workspaceId={workspace.id}
										filter={taskFilter}
										onSelect={() => {
											if (onSelectTask) {
												onSelectTask(task.project.id, task.id, task.state);
											} else {
												onSelectContainer(task.project.id);
											}
										}}
										onTaskRemoved={handleTaskRemoved}
										onTaskStateChanged={handleTaskStateChanged}
										onTasksChanged={onTasksChanged}
									/>
								))}
							</div>
						) : (
							/* Empty filter results */
							<div
								className="border border-border/30 bg-secondary/10 py-12 text-center animate-fade-in"
								style={{ animationDelay: "300ms" }}
							>
								<div className="text-2xl mb-3 opacity-30">✓</div>
								<div className="text-muted-foreground/60 mb-1">
									{taskFilter === "open" ? "No open tasks" : "No tasks found"}
								</div>
								<div className="text-[10px] text-muted-foreground/40 font-mono">
									{taskFilter === "open"
										? "all tasks are completed or archived"
										: "workspace is empty"}
								</div>
							</div>
						)}
					</>
				)}

				{/* Empty State */}
				{stats.totalTasks === 0 && (
					<div className="text-center py-16 animate-fade-in" style={{ animationDelay: "300ms" }}>
						<div className="text-5xl mb-4 opacity-20">◇</div>
						<div className="text-muted-foreground/60 mb-2">No tasks yet</div>
						<div className="text-[11px] text-muted-foreground/40 font-mono">
							Use <span className="text-primary">wrkq touch &lt;path&gt;</span> to create tasks
						</div>
					</div>
				)}

				{/* Footer */}
				<div
					className="mt-8 pt-4 border-t border-dashed border-border/20 flex items-center justify-between text-[10px] text-muted-foreground/30 animate-fade-in"
					style={{ animationDelay: "500ms" }}
				>
					<span className="font-mono">wrkq v0.1</span>
					<span className="flex items-center gap-2">
						<span className="w-1.5 h-1.5 bg-primary/50 animate-pulse" />
						<span>system online</span>
					</span>
				</div>
			</div>
		</div>
	);
}
