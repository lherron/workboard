import {
	type ApiClientError,
	archiveTask,
	fetchAllWorkspacesTasks,
	updateTask,
} from "@/api/client";
import { useAppNavigation } from "@/hooks/useNavigation";
import { formatUpdated } from "@/lib/datetime";
import { formatProjectPath } from "@/lib/taskPaths";
import { cn } from "@/lib/utils";
import type { CrossProjectContainersTreeResponse, CrossProjectTaskListItem } from "@webwrkq/shared";
import {
	AlertTriangle,
	Archive,
	CheckCircle2,
	ChevronRight,
	Clock,
	Inbox,
	Layers,
	Loader2,
	RotateCcw,
	Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type TaskFilter = "open" | "all" | "in_progress" | "blocked";

type ProjectTree = CrossProjectContainersTreeResponse["projects"][number];

type GlobalDashboardProps = {
	workspaces: ProjectTree[];
	onSelectWorkspace: (workspaceId: string) => void;
	onSelectTask?: (
		workspaceId: string,
		containerId: string,
		taskId: string,
		taskState?: string,
	) => void;
	onTasksChanged?: () => void;
};

type RowActionState = "idle" | "archiving" | "completing" | "reopening" | "error";

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
		{ key: "in_progress", label: "ACTIVE", symbol: "◐" },
		{ key: "blocked", label: "BLOCKED", symbol: "◈" },
		{ key: "all", label: "ALL", symbol: "*" },
	];

	return (
		<div className={cn("flex items-center gap-1 font-mono text-[10px]", className)}>
			<span className="text-muted-foreground/50 mr-1">--filter</span>
			<div className="flex border border-primary/30 bg-black/40">
				{options.map((opt, idx) => (
					<button
						key={opt.key}
						onClick={() => onChange(opt.key)}
						className={cn(
							"relative px-3 py-1.5 transition-all duration-200 flex items-center gap-1.5",
							"hover:bg-primary/15",
							idx > 0 && "border-l border-primary/30",
							value === opt.key
								? "text-primary bg-primary/10"
								: "text-muted-foreground/60 hover:text-muted-foreground",
						)}
					>
						<span className={cn("font-bold", value === opt.key && "text-primary")}>
							{opt.symbol}
						</span>
						<span className="tracking-[0.1em]">{opt.label}</span>
						{value === opt.key && (
							<span className="absolute -bottom-px left-0 right-0 h-[2px] bg-primary/80" />
						)}
					</button>
				))}
			</div>
		</div>
	);
}

function HexGrid({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"absolute inset-0 overflow-hidden pointer-events-none opacity-[0.02]",
				className,
			)}
		>
			<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
				<defs>
					<pattern
						id="hexagons"
						width="50"
						height="43.4"
						patternUnits="userSpaceOnUse"
						patternTransform="scale(2)"
					>
						<polygon
							points="24.8,22 37.3,29.2 37.3,43.4 24.8,50.6 12.3,43.4 12.3,29.2"
							fill="none"
							stroke="currentColor"
							strokeWidth="0.5"
						/>
						<polygon
							points="0,0 12.5,7.2 12.5,21.4 0,28.6 -12.5,21.4 -12.5,7.2"
							fill="none"
							stroke="currentColor"
							strokeWidth="0.5"
						/>
						<polygon
							points="50,0 62.5,7.2 62.5,21.4 50,28.6 37.5,21.4 37.5,7.2"
							fill="none"
							stroke="currentColor"
							strokeWidth="0.5"
						/>
					</pattern>
				</defs>
				<rect width="100%" height="100%" fill="url(#hexagons)" className="text-primary" />
			</svg>
		</div>
	);
}

function StatPanel({
	icon: Icon,
	label,
	value,
	accent = false,
	isActive = false,
	onClick,
	delay = 0,
}: {
	icon: React.ElementType;
	label: string;
	value: number | string;
	accent?: boolean;
	isActive?: boolean;
	onClick?: () => void;
	delay?: number;
}) {
	const isClickable = !!onClick;
	const highlighted = accent || isActive;

	return (
		<div
			className={cn(
				"relative border bg-secondary/40 backdrop-blur-sm p-4 animate-fade-in group transition-all",
				highlighted ? "border-primary/50" : "border-border/40",
				isActive && "ring-2 ring-primary/30 bg-primary/5",
				isClickable && "cursor-pointer hover:border-primary/60 hover:bg-secondary/60",
			)}
			style={{ animationDelay: `${delay}ms` }}
			onClick={onClick}
			role={isClickable ? "button" : undefined}
			tabIndex={isClickable ? 0 : undefined}
			onKeyDown={
				isClickable
					? (e) => {
							if (e.key === "Enter") onClick?.();
						}
					: undefined
			}
		>
			{/* Corner brackets */}
			<div
				className={cn(
					"absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2",
					highlighted ? "border-primary/70" : "border-muted-foreground/30",
				)}
			/>
			<div
				className={cn(
					"absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2",
					highlighted ? "border-primary/70" : "border-muted-foreground/30",
				)}
			/>
			<div
				className={cn(
					"absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2",
					highlighted ? "border-primary/70" : "border-muted-foreground/30",
				)}
			/>
			<div
				className={cn(
					"absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2",
					highlighted ? "border-primary/70" : "border-muted-foreground/30",
				)}
			/>

			<div className="flex items-start justify-between mb-3">
				<div
					className={cn(
						"p-1.5 border",
						highlighted
							? "bg-primary/15 border-primary/40 text-primary"
							: "bg-muted/30 border-border/40 text-muted-foreground/70",
					)}
				>
					<Icon className="w-3.5 h-3.5" />
				</div>
				<span
					className={cn(
						"inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.15em] border rounded-sm",
						highlighted
							? "bg-primary/15 border-primary/50 text-primary"
							: "bg-secondary/70 border-border/50 text-foreground/70",
					)}
				>
					{label}
				</span>
			</div>

			<div
				className={cn(
					"text-3xl font-light tracking-tight tabular-nums",
					highlighted ? "text-primary" : "text-foreground",
				)}
			>
				{value}
			</div>
		</div>
	);
}

function WorkspacePill({
	name,
	count,
	isActive,
}: { name: string; count: number; isActive?: boolean }) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider border transition-colors",
				isActive
					? "bg-primary/15 border-primary/40 text-primary"
					: "bg-secondary/60 border-border/40 text-foreground/80 hover:border-primary/30 hover:bg-secondary/80",
			)}
		>
			<span
				className={cn("w-1.5 h-1.5 rounded-sm", isActive ? "bg-primary" : "bg-muted-foreground/50")}
			/>
			<span className="truncate max-w-[100px]">{name}</span>
			{count > 0 && (
				<span
					className={cn(
						"min-w-[18px] text-center font-semibold",
						isActive ? "text-primary" : "text-foreground/60",
					)}
				>
					{count}
				</span>
			)}
		</span>
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
		default: "text-muted-foreground hover:text-foreground hover:bg-muted/60",
		danger: "text-destructive/80 hover:text-destructive hover:bg-destructive/15",
		success: "text-primary hover:text-primary hover:bg-primary/15",
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
	index: _index,
	filter,
	onSelect,
	onTaskRemoved,
	onTaskStateChanged,
	onTasksChanged,
}: {
	task: CrossProjectTaskListItem;
	index: number;
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
		if (actionState === "completing") return;

		setActionState("completing");
		try {
			const updated = await updateTask(task.projectId, task.id, { state: "completed" }, task.etag);
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
		if (actionState === "archiving") return;

		setActionState("archiving");
		try {
			const updated = await archiveTask(task.projectId, task.id, task.etag);
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
		if (actionState === "reopening") return;

		setActionState("reopening");
		try {
			const updated = await updateTask(task.projectId, task.id, { state: "open" }, task.etag);
			onTaskStateChanged(task.id, "open", updated.etag);
			onTasksChanged?.();
			setActionState("idle");
		} catch (err) {
			console.error("Failed to reopen task:", err);
			setActionState("error");
			setTimeout(() => setActionState("idle"), 2000);
		}
	};

	const stateConfig = {
		idea: { symbol: "✧", color: "text-cyan-300" },
		draft: { symbol: "◇", color: "text-fuchsia-300" },
		open: { symbol: "○", color: "text-foreground/70" },
		in_progress: { symbol: "◐", color: "text-primary" },
		completed: { symbol: "●", color: "text-muted-foreground/50" },
		archived: { symbol: "◌", color: "text-muted-foreground/40" },
		blocked: { symbol: "◈", color: "text-warning" },
		cancelled: { symbol: "⊘", color: "text-muted-foreground/40" },
		deleted: { symbol: "⌫", color: "text-red-400/60" },
	}[task.state] || { symbol: "○", color: "text-foreground/70" };

	const isCompleted = task.state === "completed";
	const isArchived = task.state === "archived";
	const canReopen = isCompleted || isArchived;
	const showActions = isHovered;

	return (
		<div
			className={cn(
				"grid grid-cols-[1.2fr,1fr,auto,auto] gap-4 py-3 px-4 hover:bg-primary/[0.05] cursor-pointer group transition-all",
				actionState === "error" && "bg-destructive/10",
			)}
			onClick={onSelect}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === "Enter") onSelect();
			}}
		>
			{/* Feature container */}
			<div className="flex items-center gap-2 min-w-[120px] max-w-[180px]">
				<span className={cn("text-sm font-mono", stateConfig.color)}>{stateConfig.symbol}</span>
				<div className="min-w-0 flex flex-col">
					<span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/80 truncate">
						{formatProjectPath(task.project.path)}
					</span>
				</div>
			</div>

			{/* Task title + ID */}
			<div className="min-w-0 flex flex-col justify-center">
				<div
					className={cn(
						"truncate text-[13px] group-hover:text-primary transition-colors",
						isCompleted ? "line-through text-muted-foreground/50" : "text-foreground/90",
					)}
				>
					{task.title}
				</div>
				<div className="text-[10px] text-foreground/50 font-mono truncate mt-0.5">{task.id}</div>
			</div>

			{/* Priority */}
			<div className="flex items-center">
				<span
					className={cn(
						"text-[10px] font-mono font-semibold px-2 py-0.5 border rounded-sm",
						task.priority === 1
							? "text-warning border-warning/40 bg-warning/10"
							: task.priority === 2
								? "text-primary border-primary/30 bg-primary/10"
								: "text-foreground/50 border-border/40 bg-secondary/50",
					)}
				>
					P{task.priority}
				</span>
			</div>

			{/* Actions or Updated */}
			<div className="flex items-center justify-end min-w-[80px]">
				{showActions || actionState !== "idle" ? (
					<div className="flex items-center gap-1">
						{actionState === "error" ? (
							<span className="text-[10px] text-destructive font-mono">error</span>
						) : canReopen ? (
							<ActionButton
								onClick={handleReopen}
								loading={actionState === "reopening"}
								variant="default"
								title="Re-open"
							>
								<RotateCcw className="w-3.5 h-3.5" />
							</ActionButton>
						) : (
							<>
								<ActionButton
									onClick={handleComplete}
									loading={actionState === "completing"}
									variant="success"
									title="Complete"
								>
									<CheckCircle2 className="w-3.5 h-3.5" />
								</ActionButton>
								<ActionButton
									onClick={handleArchive}
									loading={actionState === "archiving"}
									variant="default"
									title="Archive"
								>
									<Archive className="w-3.5 h-3.5" />
								</ActionButton>
							</>
						)}
					</div>
				) : (
					<span className="text-[10px] font-mono text-foreground/40">
						{formatUpdated(task.updated_at)}
					</span>
				)}
			</div>
		</div>
	);
}

function WorkspaceSection({
	workspaceId,
	workspaceName,
	tasks,
	filter,
	index,
	onSelectWorkspace,
	onSelectTask,
	onTaskRemoved,
	onTaskStateChanged,
	onTasksChanged,
}: {
	workspaceId: string;
	workspaceName: string;
	tasks: CrossProjectTaskListItem[];
	filter: TaskFilter;
	index: number;
	onSelectWorkspace: (workspaceId: string) => void;
	onSelectTask?: (
		workspaceId: string,
		containerId: string,
		taskId: string,
		taskState?: string,
	) => void;
	onTaskRemoved: (taskId: string) => void;
	onTaskStateChanged: (taskId: string, newState: string, newEtag: number) => void;
	onTasksChanged?: () => void;
}) {
	return (
		<div className="animate-fade-in" style={{ animationDelay: `${200 + index * 100}ms` }}>
			{/* Workspace Header */}
			<button
				onClick={() => onSelectWorkspace(workspaceId)}
				className="w-full flex items-center gap-3 px-4 py-3 bg-secondary/70 border border-border/50 hover:border-primary/30 hover:bg-secondary/90 transition-all group"
			>
				<span className="text-[12px] font-semibold text-foreground/90 uppercase tracking-wider">
					{workspaceName}
				</span>
				<span className="text-[11px] font-mono text-foreground/50">
					{tasks.length} task{tasks.length !== 1 ? "s" : ""}
				</span>
				<div className="flex-1" />
				<ChevronRight className="w-4 h-4 text-foreground/30 group-hover:text-primary/70 group-hover:translate-x-0.5 transition-all" />
			</button>

			{/* Task rows */}
			<div className="border-x border-b border-border/30 bg-background/50 divide-y divide-border/20">
				{tasks.map((task, taskIdx) => (
					<TaskRow
						key={`${task.projectId}:${task.id}`}
						task={task}
						index={taskIdx}
						filter={filter}
						onSelect={() => {
							if (onSelectTask) {
								onSelectTask(task.projectId, task.project.id, task.id, task.state);
							} else {
								onSelectWorkspace(task.projectId);
							}
						}}
						onTaskRemoved={onTaskRemoved}
						onTaskStateChanged={onTaskStateChanged}
						onTasksChanged={onTasksChanged}
					/>
				))}
			</div>
		</div>
	);
}

export function GlobalDashboard({
	workspaces,
	onSelectWorkspace,
	onSelectTask,
	onTasksChanged,
}: GlobalDashboardProps) {
	const { goToInboxHub } = useAppNavigation();
	const [tasks, setTasks] = useState<CrossProjectTaskListItem[]>([]);
	const [tasksLoading, setTasksLoading] = useState(true);
	const [tasksError, setTasksError] = useState<ApiClientError | null>(null);
	const [taskFilter, setTaskFilter] = useState<TaskFilter>("open");
	const [_totalOpenTasks, setTotalOpenTasks] = useState(0);

	const handleTaskRemoved = (taskId: string) => {
		setTasks((prev) => prev.filter((t) => t.id !== taskId));
	};

	const handleTaskStateChanged = (taskId: string, newState: string, newEtag: number) => {
		setTasks((prev) =>
			prev.map((t) =>
				t.id === taskId
					? { ...t, state: newState as CrossProjectTaskListItem["state"], etag: newEtag }
					: t,
			),
		);
	};

	useEffect(() => {
		const controller = new AbortController();
		setTasksLoading(true);
		setTasksError(null);

		// Map UI filter to API filter - API only supports 'open' and 'all'
		const apiFilter = taskFilter === "all" ? "all" : "open";

		fetchAllWorkspacesTasks({ filter: apiFilter, sort: "priority", limit: 100 }, controller.signal)
			.then((resp) => {
				setTasks(resp.tasks);
				setTotalOpenTasks(resp.totalOpenTasks);
				setTasksLoading(false);
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setTasksError(err as ApiClientError);
				setTasksLoading(false);
			});

		return () => controller.abort();
	}, [taskFilter]);

	// Aggregate stats
	const stats = useMemo(() => {
		const totalTasks = workspaces.reduce(
			(sum, ws) => ws.containers.reduce((s, c) => s + c.total_task_count, sum),
			0,
		);
		const openTasks = workspaces.reduce(
			(sum, ws) => ws.containers.reduce((s, c) => s + c.open_task_count, sum),
			0,
		);
		const inProgressTasks = tasks.filter((t) => t.state === "in_progress").length;
		const blockedTasks = tasks.filter((t) => t.state === "blocked").length;

		return { totalTasks, openTasks, inProgressTasks, blockedTasks };
	}, [workspaces, tasks]);

	// Filter tasks based on current filter
	const filteredTasks = useMemo(() => {
		if (taskFilter === "in_progress") {
			return tasks.filter((t) => t.state === "in_progress");
		}
		if (taskFilter === "blocked") {
			return tasks.filter((t) => t.state === "blocked");
		}
		// 'open' and 'all' are already handled by the API
		return tasks;
	}, [tasks, taskFilter]);

	// Sort tasks by feature container (project path), then priority/recency
	const sortedTasks = useMemo(() => {
		return [...filteredTasks].sort((a, b) => {
			const pathCompare = a.project.path.localeCompare(b.project.path, undefined, {
				sensitivity: "base",
			});
			if (pathCompare !== 0) return pathCompare;
			if (a.priority !== b.priority) return a.priority - b.priority;
			return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
		});
	}, [filteredTasks]);

	// Group tasks by workspace - preserve order by first task appearance
	const tasksByWorkspace = useMemo(() => {
		const grouped: {
			workspaceId: string;
			workspaceName: string;
			tasks: CrossProjectTaskListItem[];
		}[] = [];
		const seen = new Set<string>();

		sortedTasks.forEach((task) => {
			if (!seen.has(task.projectId)) {
				seen.add(task.projectId);
				grouped.push({
					workspaceId: task.projectId,
					workspaceName: task.projectName,
					tasks: [],
				});
			}
			const group = grouped.find((g) => g.workspaceId === task.projectId);
			if (group) group.tasks.push(task);
		});

		return grouped;
	}, [sortedTasks]);

	return (
		<div className="h-full overflow-auto relative">
			<HexGrid />

			<div className="relative max-w-5xl mx-auto py-8 px-6">
				{/* Header */}
				<div className="mb-8 animate-fade-in">
					<div className="flex items-center gap-3 mb-4">
						<div className="relative">
							<div className="w-10 h-10 border-2 border-primary/60 flex items-center justify-center bg-primary/10">
								<Layers className="w-5 h-5 text-primary" />
							</div>
							<div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary animate-pulse" />
						</div>
						<div>
							<h1 className="text-2xl font-light tracking-wide text-foreground">COMMAND CENTER</h1>
							<div className="text-[11px] font-mono text-foreground/50 tracking-[0.3em]">
								GLOBAL TASK OVERVIEW
							</div>
						</div>
					</div>

					{/* Workspace pills */}
					<div className="flex flex-wrap items-center gap-2 mt-5">
						{workspaces.map(({ projectId, projectName, containers }) => {
							const openCount = containers.reduce((s, c) => s + c.open_task_count, 0);
							return (
								<button
									key={projectId}
									onClick={() => onSelectWorkspace(projectId)}
									className="transition-transform hover:scale-105 active:scale-95"
								>
									<WorkspacePill name={projectName} count={openCount} />
								</button>
							);
						})}

						{/* Separator */}
						<div className="h-6 w-px bg-border/40 mx-1" />

						{/* Inbox Hub link */}
						<button
							onClick={goToInboxHub}
							className={cn(
								"inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider border transition-all",
								"bg-primary/10 border-primary/40 text-primary hover:bg-primary/20 hover:border-primary/60",
								"hover:scale-105 active:scale-95",
							)}
						>
							<Inbox className="w-3.5 h-3.5" />
							<span>Inbox Hub</span>
						</button>
					</div>
				</div>

				{/* Stats Grid */}
				<div className="grid grid-cols-3 gap-3 mb-8">
					<StatPanel
						icon={Zap}
						label="OPEN"
						value={stats.openTasks}
						accent={taskFilter === "open"}
						isActive={taskFilter === "open"}
						onClick={() => setTaskFilter(taskFilter === "open" ? "all" : "open")}
						delay={50}
					/>
					<StatPanel
						icon={Clock}
						label="IN PROGRESS"
						value={stats.inProgressTasks}
						isActive={taskFilter === "in_progress"}
						onClick={() => setTaskFilter(taskFilter === "in_progress" ? "open" : "in_progress")}
						delay={100}
					/>
					<StatPanel
						icon={AlertTriangle}
						label="BLOCKED"
						value={stats.blockedTasks}
						isActive={taskFilter === "blocked"}
						onClick={() => setTaskFilter(taskFilter === "blocked" ? "open" : "blocked")}
						delay={150}
					/>
				</div>

				{/* Tasks Section */}
				<div className="animate-fade-in" style={{ animationDelay: "250ms" }}>
					{/* Section Header */}
					<div className="flex items-center justify-between mb-5 pb-3 border-b border-border/30">
						<div className="flex items-center gap-3">
							<div className="text-primary font-mono text-sm font-bold">{">"}</div>
							<span className="text-sm font-semibold uppercase tracking-[0.15em] text-foreground/80">
								{taskFilter === "open"
									? "OPEN TASKS"
									: taskFilter === "in_progress"
										? "IN PROGRESS"
										: taskFilter === "blocked"
											? "BLOCKED TASKS"
											: "ALL TASKS"}
							</span>
							<span className="text-[11px] font-mono text-foreground/50 bg-secondary/60 px-2 py-0.5 rounded">
								{sortedTasks.length} items
							</span>
						</div>
						<FilterToggle value={taskFilter} onChange={setTaskFilter} />
					</div>

					{/* Tasks Content - Grouped by Workspace */}
					{tasksLoading ? (
						<div className="py-20 text-center">
							<div className="inline-flex items-center gap-3 text-foreground/50 font-mono text-sm">
								<Loader2 className="w-5 h-5 animate-spin text-primary" />
								<span>Loading tasks...</span>
							</div>
						</div>
					) : tasksError ? (
						<div className="py-20 text-center">
							<div className="text-destructive font-mono text-sm">Error: {tasksError.message}</div>
						</div>
					) : tasksByWorkspace.length > 0 ? (
						<div className="space-y-4">
							{tasksByWorkspace.map((group, idx) => (
								<WorkspaceSection
									key={group.workspaceId}
									workspaceId={group.workspaceId}
									workspaceName={group.workspaceName}
									tasks={group.tasks}
									filter={taskFilter}
									index={idx}
									onSelectWorkspace={onSelectWorkspace}
									onSelectTask={onSelectTask}
									onTaskRemoved={handleTaskRemoved}
									onTaskStateChanged={handleTaskStateChanged}
									onTasksChanged={onTasksChanged}
								/>
							))}
						</div>
					) : (
						<div className="border border-border/30 bg-secondary/30 py-20 text-center rounded">
							<div className="text-4xl mb-4 opacity-30">◇</div>
							<div className="text-foreground/60 mb-2 font-medium">
								{taskFilter === "open" ? "No open tasks" : "No tasks found"}
							</div>
							<div className="text-sm text-foreground/40 font-mono">
								{taskFilter === "open" ? "All systems nominal" : "Workspaces are empty"}
							</div>
						</div>
					)}
				</div>

				{/* Footer */}
				<div
					className="mt-10 pt-4 border-t border-dashed border-border/30 flex items-center justify-between text-[10px] text-foreground/40 font-mono animate-fade-in"
					style={{ animationDelay: "400ms" }}
				>
					<span className="flex items-center gap-2">
						<span className="text-primary">$</span>
						<span>wrkq global-view</span>
					</span>
					<span className="flex items-center gap-3">
						<span className="flex items-center gap-1.5">
							<span className="w-2 h-2 bg-primary rounded-sm animate-pulse" />
							<span className="text-foreground/60">CONNECTED</span>
						</span>
						<span className="text-foreground/20">|</span>
						<span>
							{workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}
						</span>
					</span>
				</div>
			</div>
		</div>
	);
}
