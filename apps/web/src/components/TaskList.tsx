import { type ApiClientError, archiveTask, updateTask } from "@/api/client";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Skeleton } from "@/components/Skeleton";
import { PriorityBadge, StatePill } from "@/components/TaskBadges";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { formatUpdated } from "@/lib/datetime";
import { formatProjectPath } from "@/lib/taskPaths";
import { cn } from "@/lib/utils";
import type { TaskListItem } from "@webwrkq/shared";
import { Archive, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { CreateTaskModal } from "./CreateTaskModal";

type TaskListProps = {
	container?: {
		id: string;
		slug: string;
		title: string;
		path: string;
	};
	workspaceId: string | null;
	tasks: TaskListItem[];
	loading: boolean;
	refreshing: boolean;
	error: ApiClientError | null;
	filter: "open" | "all";
	sort: "priority" | "due" | "updated_at" | "state";
	selectedTaskId: string | null;
	onFilterChange: (filter: "open" | "all") => void;
	onSortChange: (sort: "priority" | "due" | "updated_at" | "state") => void;
	onSelectTask?: (taskId: string) => void;
	onRetry?: () => void;
	onTaskCreated?: () => void;
	onTaskUpdated?: () => void;
};

type RowActionState = "idle" | "archiving" | "completing" | "error";

type TaskRowProps = {
	task: TaskListItem;
	selected: boolean;
	workspaceId: string;
	onSelect?: (id: string) => void;
	onTaskUpdated?: () => void;
};

function Labels({ labels }: { labels: string[] }) {
	if (!labels?.length) {
		return <span className="text-[10px] text-muted-foreground/30">─</span>;
	}
	return (
		<div className="flex flex-wrap gap-1.5 justify-end">
			{labels.map((label) => (
				<span key={label} className="text-[10px] text-muted-foreground/70 tracking-wide font-mono">
					#{label}
				</span>
			))}
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

function TaskRow({ task, selected, workspaceId, onSelect, onTaskUpdated }: TaskRowProps) {
	const [actionState, setActionState] = useState<RowActionState>("idle");
	const [isHovered, setIsHovered] = useState(false);

	const handleComplete = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!workspaceId || actionState === "completing") return;

		setActionState("completing");
		try {
			await updateTask(workspaceId, task.id, { state: "completed" }, task.etag);
			onTaskUpdated?.();
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
			await archiveTask(workspaceId, task.id, task.etag);
			onTaskUpdated?.();
			setActionState("idle");
		} catch (err) {
			console.error("Failed to archive task:", err);
			setActionState("error");
			setTimeout(() => setActionState("idle"), 2000);
		}
	};

	const isCompleted = task.state === "completed";
	const isArchived = task.state === "archived";
	const showActions = isHovered && !isCompleted && !isArchived;

	return (
		<div
			role={onSelect ? "button" : undefined}
			tabIndex={onSelect ? 0 : undefined}
			onClick={() => onSelect?.(task.id)}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onKeyDown={(e) => {
				if (!onSelect) return;
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelect(task.id);
				}
			}}
			className={cn(
				"group relative grid grid-cols-[4fr,0.8fr,0.4fr,0.6fr] items-center gap-3 border-b border-border/30 px-4 py-2 last:border-b-0 cursor-pointer font-mono text-[12px] transition-colors duration-150",
				selected
					? "bg-muted/60 text-foreground"
					: "hover:bg-muted/20 text-muted-foreground hover:text-foreground",
				actionState === "error" && "bg-destructive/5",
			)}
		>
			{selected && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" />}

			{/* Title & ID */}
			<div className="space-y-0.5 min-w-0 overflow-hidden">
				<p
					className={cn(
						"truncate leading-relaxed tracking-wide",
						selected ? "text-foreground font-medium" : "text-muted-foreground",
						isCompleted && "line-through opacity-60",
					)}
				>
					{task.title}
				</p>
				<div className="flex items-center gap-2">
					<span className="text-[10px] text-muted-foreground/40 tracking-wider">{task.id}</span>
					<Labels labels={task.labels} />
				</div>
			</div>

			{/* Status */}
			<div className="flex items-center">
				<StatePill state={task.state} />
			</div>

			{/* Priority */}
			<div className="flex items-center">
				<PriorityBadge priority={task.priority} />
			</div>

			{/* Actions or Updated */}
			<div className="flex items-center justify-end">
				{showActions || actionState !== "idle" ? (
					<div className="flex items-center gap-1">
						{actionState === "error" ? (
							<span className="text-[9px] text-destructive">failed</span>
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
					<span className="text-[10px] text-muted-foreground/40 tracking-wider">
						{formatUpdated(task.updated_at)}
					</span>
				)}
			</div>
		</div>
	);
}

function TaskListSkeleton() {
	return (
		<div className="overflow-hidden border border-border/30 bg-secondary/10">
			{[...Array(5)].map((_, idx) => (
				<div
					key={idx}
					className="grid grid-cols-[4fr,0.8fr,0.4fr,0.6fr] gap-4 border-b border-border/30 px-4 py-3 last:border-b-0"
				>
					<div className="space-y-2">
						<Skeleton className="h-4 w-4/5 bg-muted/20" />
						<Skeleton className="h-3 w-1/3 bg-muted/20" />
					</div>
					<Skeleton className="h-5 w-20 bg-muted/20" />
					<Skeleton className="h-5 w-12 bg-muted/20" />

					<div className="flex flex-col items-end gap-2">
						<Skeleton className="h-3 w-16 bg-muted/20" />
						<Skeleton className="h-3 w-12 bg-muted/20" />
					</div>
				</div>
			))}
		</div>
	);
}

const sortOptions: Array<{ value: TaskListProps["sort"]; label: string }> = [
	{ value: "priority", label: "Priority" },
	{ value: "state", label: "State" },
	{ value: "updated_at", label: "Last updated" },
];

export function TaskList({
	workspaceId,
	container,
	tasks,
	loading,
	refreshing,
	error,
	filter,
	sort,
	selectedTaskId,
	onFilterChange,
	onSortChange,
	onSelectTask,
	onRetry,
	onTaskCreated,
	onTaskUpdated,
}: TaskListProps) {
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

	return (
		<div className="flex h-full flex-col gap-4">
			<CreateTaskModal
				isOpen={isCreateModalOpen}
				onClose={() => setIsCreateModalOpen(false)}
				workspaceId={workspaceId || ""}
				containerId={container?.id || ""}
				onSuccess={() => onTaskCreated?.()}
			/>

			{/* Header */}
			<div className="flex flex-wrap items-center justify-between gap-3 font-mono">
				<div className="space-y-0.5">
					<div className="flex items-center gap-2 text-[13px]">
						<span className="text-primary font-bold">$</span>
						<span className="text-muted-foreground">wrkq ls</span>
						<span className="text-foreground font-medium">{container ? container.slug : ""}</span>
						{refreshing && <span className="text-accent animate-pulse">...</span>}
					</div>
					<div className="text-[10px] text-muted-foreground/50 pl-4">
						{container ? `# ${formatProjectPath(container.path)}` : "# select a project"}
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-4">
					{container && (
						<button
							className="text-[11px] text-primary hover:underline flex items-center gap-1"
							onClick={() => setIsCreateModalOpen(true)}
						>
							<span>+ new</span>
						</button>
					)}

					<span className="text-border/50">│</span>

					{/* Filter */}
					<div className="flex gap-1 text-[11px]">
						<button
							className={cn(
								"px-1",
								filter === "open"
									? "text-primary underline decoration-primary/50"
									: "text-muted-foreground hover:text-foreground",
							)}
							onClick={() => onFilterChange("open")}
						>
							open
						</button>
						<span className="text-muted-foreground/50">/</span>
						<button
							className={cn(
								"px-1",
								filter === "all"
									? "text-primary underline decoration-primary/50"
									: "text-muted-foreground hover:text-foreground",
							)}
							onClick={() => onFilterChange("all")}
						>
							all
						</button>
					</div>

					{/* Sort */}
					<div className="flex items-center gap-1.5 text-[11px]">
						<span className="text-muted-foreground">--sort</span>
						<Select
							value={sort}
							onValueChange={(value) => onSortChange(value as TaskListProps["sort"])}
						>
							<SelectTrigger className="border-none p-0 h-auto">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{sortOptions.map((opt) => (
									<SelectItem key={opt.value} value={opt.value}>
										{opt.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>

			{/* Error state */}
			{error && (
				<ErrorBanner
					title="Could not load tasks"
					message={error.message}
					detail={typeof error.details === "string" ? error.details : undefined}
					onRetry={onRetry}
				/>
			)}

			{/* Content */}
			{!container ? (
				<EmptyState
					title="Select a project"
					description="Choose a project in the sidebar to see its tasks."
					className="mt-4"
				/>
			) : loading ? (
				<TaskListSkeleton />
			) : tasks.length === 0 ? (
				<EmptyState
					title={filter === "open" ? "No open tasks here" : "No tasks in this project"}
					description={
						filter === "open"
							? 'Try switching to "all" or create a task from the CLI.'
							: "Use `wrkq touch <project>/<slug>` to add the first task."
					}
				/>
			) : (
				<div className="flex-1 overflow-auto border border-border/30 bg-secondary/10">
					<div className="min-w-[500px]">
						{/* Column headers */}
						<div className="sticky top-0 grid grid-cols-[4fr,0.8fr,0.4fr,0.6fr] gap-4 border-b border-border/30 bg-background/95 backdrop-blur-sm px-4 py-2 font-mono z-10">
							<span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
								task
							</span>
							<span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
								status
							</span>
							<span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
								pri
							</span>

							<span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 text-right">
								updated
							</span>
						</div>

						{/* Task rows */}
						<div>
							{tasks.map((task) => (
								<TaskRow
									key={task.id}
									task={task}
									selected={selectedTaskId === task.id || selectedTaskId === task.uuid}
									workspaceId={workspaceId || ""}
									onSelect={onSelectTask}
									onTaskUpdated={onTaskUpdated}
								/>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
