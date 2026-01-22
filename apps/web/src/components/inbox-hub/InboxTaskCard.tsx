import { RunStatusBadge } from "@/components/RunStatusBadge";
import { cn } from "@/lib/utils";
import type { ProjectTaskListItem, TaskListItem, TaskRunStatus } from "@webwrkq/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CardSize } from "./types";

type InboxTaskCardProps = {
	task: TaskListItem | ProjectTaskListItem;
	workspaceId: string;
	onComplete: () => void;
	onClick: () => void;
	onSelect: () => void;
	onDelete: () => Promise<void>;
	actionMode?: "complete" | "ack" | "none";
	draggable?: boolean;
	runStatus?: TaskRunStatus | null;
	isSelected?: boolean;
	isCompleting?: boolean;
	cardSize?: CardSize;
	selectionScrollBehavior?: ScrollBehavior;
	suppressSelectionScroll?: boolean;
	searchActive?: boolean;
	searchMatch?: boolean;
	containerPath?: string;
	/** Whether this task is part of a container group (vs loose inbox task) */
	isGrouped?: boolean;
	/** The container name this task belongs to (when grouped) */
	groupContainerName?: string;
};

// State styling configuration - matches TaskDetailModal
const stateConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
	idea: {
		label: "Idea",
		bg: "bg-cyan-500/20",
		text: "text-cyan-300",
		border: "border-cyan-500/40",
	},
	draft: {
		label: "Draft",
		bg: "bg-fuchsia-500/20",
		text: "text-fuchsia-300",
		border: "border-fuchsia-500/40",
	},
	open: {
		label: "Open",
		bg: "bg-emerald-500/20",
		text: "text-emerald-300",
		border: "border-emerald-500/40",
	},
	in_progress: {
		label: "In Progress",
		bg: "bg-sky-500/20",
		text: "text-sky-300",
		border: "border-sky-500/40",
	},
	completed: {
		label: "Completed",
		bg: "bg-zinc-500/20",
		text: "text-zinc-400",
		border: "border-zinc-500/40",
	},
	blocked: {
		label: "Blocked",
		bg: "bg-amber-500/20",
		text: "text-amber-300",
		border: "border-amber-500/40",
	},
	cancelled: {
		label: "Cancelled",
		bg: "bg-rose-500/20",
		text: "text-rose-300",
		border: "border-rose-500/40",
	},
	archived: {
		label: "Archived",
		bg: "bg-zinc-600/20",
		text: "text-zinc-400",
		border: "border-zinc-600/40",
	},
};

function DeleteConfirmModal({
	taskTitle,
	onConfirm,
	onCancel,
	deleting,
	error,
}: {
	taskTitle: string;
	onConfirm: () => void;
	onCancel: () => void;
	deleting: boolean;
	error: string | null;
}) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			{/* Backdrop */}
			<div className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={onCancel} />

			{/* Modal */}
			<div className="relative w-full max-w-sm bg-background border border-border/50 rounded-lg shadow-2xl overflow-hidden animate-fade-in">
				{/* Header */}
				<div className="px-4 py-3 border-b border-border/30 bg-secondary/30">
					<div className="flex items-center gap-2">
						<svg
							width="16"
							height="16"
							viewBox="0 0 16 16"
							fill="none"
							className="text-destructive"
						>
							<path
								d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z"
								stroke="currentColor"
								strokeWidth="1.3"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
						<h3 className="text-[14px] font-medium text-foreground">Delete Task</h3>
					</div>
				</div>

				{/* Content */}
				<div className="px-4 py-4">
					<p className="text-[13px] text-foreground/80 mb-2">
						Are you sure you want to delete this task?
					</p>
					<p className="text-[12px] text-muted-foreground/70 bg-secondary/50 px-3 py-2 rounded border border-border/30 truncate">
						"{taskTitle}"
					</p>
					<p className="text-[11px] text-destructive/70 mt-3">This action cannot be undone.</p>
					{error && (
						<p className="text-[11px] text-red-400 mt-2 px-2 py-1.5 bg-red-500/10 border border-red-500/30 rounded">
							{error}
						</p>
					)}
				</div>

				{/* Footer */}
				<div className="px-4 py-3 border-t border-border/30 bg-secondary/20 flex items-center justify-end gap-2">
					<button
						onClick={onCancel}
						disabled={deleting}
						className={cn(
							"px-3 py-1.5 text-[12px] rounded border border-border/50",
							"bg-secondary/60 hover:bg-secondary/80 text-foreground/80",
							"transition-colors",
							deleting && "opacity-50 pointer-events-none",
						)}
					>
						Cancel
					</button>
					<button
						onClick={onConfirm}
						disabled={deleting}
						className={cn(
							"px-3 py-1.5 text-[12px] rounded border",
							"bg-destructive/20 hover:bg-destructive/30 border-destructive/50 text-destructive",
							"transition-colors flex items-center gap-2",
							deleting && "opacity-70",
						)}
					>
						{deleting ? (
							<>
								<div className="w-3 h-3 border border-destructive/30 border-t-destructive rounded-full animate-spin" />
								Deleting...
							</>
						) : (
							"Delete"
						)}
					</button>
				</div>
			</div>
		</div>
	);
}

export function InboxTaskCard({
	task,
	workspaceId,
	onComplete,
	onClick,
	onSelect,
	onDelete,
	actionMode = "complete",
	draggable = true,
	runStatus,
	isSelected = false,
	isCompleting = false,
	cardSize = "default",
	selectionScrollBehavior = "smooth",
	suppressSelectionScroll = false,
	searchActive = false,
	searchMatch = true,
	containerPath,
	isGrouped = false,
	groupContainerName: _groupContainerName,
}: InboxTaskCardProps) {
	const [completing, setCompleting] = useState(false);
	const [hovered, setHovered] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const cardRef = useRef<HTMLDivElement>(null);

	// Scroll into view when selected via keyboard navigation
	useEffect(() => {
		if (isSelected && cardRef.current && !suppressSelectionScroll) {
			// Cast to any to support 'instant' which may not be in older TS ScrollBehavior type
			cardRef.current.scrollIntoView({
				behavior: selectionScrollBehavior as ScrollBehavior,
				block: "nearest",
			});
		}
	}, [isSelected, selectionScrollBehavior, suppressSelectionScroll]);
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const acknowledgedAt = (task as { acknowledged_at?: string | null }).acknowledged_at;
	const isAckMode = actionMode === "ack";
	const isNoneMode = actionMode === "none";
	const actionDisabled =
		isNoneMode ||
		completing ||
		(!isAckMode && task.state === "completed") ||
		(isAckMode && !!acknowledgedAt);
	const actionTitle = isNoneMode ? "" : isAckMode ? "Acknowledge task" : "Complete task";
	const showRunStatus = runStatus && (runStatus === "running" || runStatus === "queued");
	const triagedAt = (task as { meta?: Record<string, unknown> }).meta?.triaged_at;
	const isTriaged = typeof triagedAt === "string" && triagedAt.length > 0;
	const blockedByArray = (task as { blocked_by?: Array<{ id: string; state: string }> }).blocked_by;
	const isBlocked = task.state === "blocked" || (blockedByArray && blockedByArray.length > 0);
	const showSearchHighlight = searchActive && searchMatch && !isCompleting && !isSelected;
	const showSearchAura = showSearchHighlight;
	const showSearchDim = searchActive && !searchMatch && !isCompleting && !isDragging;

	// Container path logic - determine if task is nested within a sub-container
	const taskPath = (task as { project?: { path?: string } }).project?.path;
	const isNestedTask =
		containerPath &&
		taskPath &&
		taskPath !== containerPath &&
		taskPath.startsWith(`${containerPath}/`);
	const nestedPathSuffix =
		isNestedTask && taskPath ? taskPath.slice(containerPath!.length + 1) : null;

	const handleDragStart = (e: React.DragEvent) => {
		setIsDragging(true);
		// Store the task data and source workspace for the drop handler
		const dragData = {
			taskId: task.id,
			taskTitle: task.title,
			sourceWorkspaceId: workspaceId,
			globalTaskId: `${workspaceId}:${task.id}`,
		};
		e.dataTransfer.setData("application/json", JSON.stringify(dragData));
		e.dataTransfer.effectAllowed = "move";
	};

	const handleDragEnd = () => {
		setIsDragging(false);
	};

	const handleComplete = async (e: React.MouseEvent) => {
		e.stopPropagation();
		setCompleting(true);
		try {
			await onComplete();
		} finally {
			setCompleting(false);
		}
	};

	const handleMenuClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		setMenuOpen(!menuOpen);
	};

	const handleDeleteClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		setMenuOpen(false);
		setDeleteError(null);
		setShowDeleteConfirm(true);
	};

	const handleDeleteConfirm = async () => {
		setDeleting(true);
		setDeleteError(null);
		try {
			await onDelete();
			setShowDeleteConfirm(false);
			setDeleting(false);
		} catch (err) {
			console.error("Failed to delete task:", err);
			const errorMessage =
				err && typeof err === "object" && "message" in err
					? (err as { message: string }).message
					: "Failed to delete task";
			setDeleteError(errorMessage);
			setDeleting(false);
		}
	};

	const handleDeleteCancel = () => {
		setShowDeleteConfirm(false);
		setDeleteError(null);
	};

	// Priority colors - increased brightness
	const priorityColors: Record<number, string> = {
		1: "border-red-500/70 hover:border-red-500",
		2: "border-amber-500/70 hover:border-amber-500",
		3: "border-sky-500/60 hover:border-sky-500",
		4: "border-zinc-500/40 hover:border-zinc-500/60",
	};

	const checkboxColor = priorityColors[task.priority] || priorityColors[4];
	const state = stateConfig[task.state] || stateConfig.open;

	// Card size-specific styling
	// All modes use same card styling (13px, px-2 py-2, 16x16 checkbox)
	// Compact hides metadata, expanded increases column width (handled in InboxColumn)
	const sizeStyles = {
		compact: {
			padding: "px-2 py-2",
			gap: "gap-2",
			titleSize: "text-[13px]",
			checkboxSize: "w-[16px] h-[16px]",
			checkmarkSize: { width: 8, height: 8 },
			showMetadata: false,
			showBody: false,
		},
		default: {
			padding: "px-2 py-2",
			gap: "gap-2",
			titleSize: "text-[13px]",
			checkboxSize: "w-[16px] h-[16px]",
			checkmarkSize: { width: 8, height: 8 },
			showMetadata: true,
			showBody: false,
		},
		expanded: {
			padding: "px-2 py-2",
			gap: "gap-2",
			titleSize: "text-[13px]",
			checkboxSize: "w-[16px] h-[16px]",
			checkmarkSize: { width: 8, height: 8 },
			showMetadata: true,
			showBody: true,
		},
	};

	// Get task description and truncate to 10 lines
	const taskDescription = (task as { description?: string }).description;
	const truncatedDescription = useMemo(() => {
		if (!taskDescription) return null;
		const lines = taskDescription.split("\n").slice(0, 10);
		const truncated = lines.join("\n");
		const hasMore =
			taskDescription.split("\n").length > 10 || truncated.length < taskDescription.length;
		return { text: truncated, hasMore };
	}, [taskDescription]);

	const currentSize = sizeStyles[cardSize];

	return (
		<>
			<div
				ref={cardRef}
				data-task-id={task.id}
				draggable={draggable}
				onDragStart={draggable ? handleDragStart : undefined}
				onDragEnd={draggable ? handleDragEnd : undefined}
				onClick={onSelect}
				onDoubleClick={onClick}
				onMouseEnter={() => setHovered(true)}
				onMouseLeave={() => {
					setHovered(false);
					setMenuOpen(false);
				}}
				className={cn(
					"group relative rounded-lg cursor-pointer",
					"before:pointer-events-none before:absolute before:inset-0 before:rounded-lg before:bg-gradient-to-r before:from-sky-500/12 before:via-sky-500/8 before:to-transparent before:opacity-0 before:transition-opacity before:duration-150",
					currentSize.padding,
					// All cards have consistent 3px left border to prevent layout shift
					"border-l-[3px]",
					// Completing animation - takes precedence
					isCompleting && "animate-task-complete",
					// Selected state (keyboard navigation) - amber block cursor style
					!isCompleting && isSelected
						? "bg-amber-500/[0.08] border border-amber-500/40 border-l-amber-400 shadow-[inset_0_0_12px_rgba(251,191,36,0.08),0_0_0_1px_rgba(251,191,36,0.15)] ring-1 ring-amber-400/30 ring-offset-1 ring-offset-background"
						: // Blocked tasks get prominent amber warning styling
							!isCompleting && isBlocked
							? "bg-rose-500/[0.03] hover:bg-rose-500/[0.05] border border-transparent border-l-rose-400/40"
							: // In-progress tasks get prominent sky-blue "full card" styling
								!isCompleting && task.state === "in_progress" && !showRunStatus
								? "bg-sky-500/10 hover:bg-sky-500/15 border border-sky-500/30 hover:border-sky-500/50 border-l-sky-400"
								: // Async running/queued tasks get draft-colored (fuchsia) styling
									!isCompleting && showRunStatus
									? "bg-fuchsia-500/10 hover:bg-fuchsia-500/15 border border-fuchsia-500/30 hover:border-fuchsia-500/40 border-l-fuchsia-400/50"
									: // Triaged tasks: emerald left accent matching badge (border-emerald-500/30)
										!isCompleting && isTriaged
										? "bg-secondary/50 hover:bg-secondary/80 border border-border/40 hover:border-border/60 border-l-emerald-400"
										: // Grouped tasks (in sub-container): violet tint for visual grouping
											!isCompleting && isGrouped
											? "bg-violet-500/[0.04] hover:bg-violet-500/[0.08] border border-violet-500/15 hover:border-violet-500/25 border-l-violet-500/40"
											: // Nested tasks: subtle indentation indicator with muted border
												!isCompleting && isNestedTask
												? "bg-secondary/40 hover:bg-secondary/70 border border-border/30 hover:border-border/50 border-l-muted-foreground/30"
												: // Default card (loose inbox task)
													!isCompleting &&
													"bg-secondary/50 hover:bg-secondary/80 border border-border/40 hover:border-border/60 border-l-transparent",
					"transition-all duration-150",
					showSearchHighlight && "before:opacity-100",
					showSearchAura &&
						"shadow-[inset_0_0_0_1px_rgba(56,189,248,0.45),0_0_12px_rgba(56,189,248,0.16)]",
					completing && "opacity-50 scale-98 pointer-events-none",
					task.state === "cancelled" && "opacity-60",
					showSearchDim && "opacity-40 saturate-50",
					isDragging && "opacity-50 scale-95 ring-2 ring-primary/50",
				)}
			>
				<div className={cn("flex items-start", currentSize.gap)}>
					{/* Checkbox */}
					<button
						onClick={handleComplete}
						disabled={actionDisabled}
						title={actionTitle}
						className={cn(
							"flex-shrink-0 mt-0.5 rounded-full border-2 transition-all duration-200",
							currentSize.checkboxSize,
							task.state === "completed"
								? "bg-emerald-500/30 border-emerald-500/50"
								: checkboxColor,
							"hover:bg-secondary/80 active:scale-90",
							"flex items-center justify-center",
							completing && "bg-primary/20",
						)}
					>
						{(hovered || completing || task.state === "completed") && (
							<svg
								width={currentSize.checkmarkSize.width}
								height={currentSize.checkmarkSize.height}
								viewBox="0 0 10 10"
								fill="none"
								className={cn(task.state === "completed" ? "opacity-80" : "opacity-60")}
							>
								<path
									d="M2 5l2.5 2.5L8 3"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						)}
					</button>

					{/* Content */}
					<div className="flex-1 min-w-0">
						<div className="flex items-start justify-between gap-2">
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									onClick();
								}}
								className={cn(
									"leading-snug break-words text-left",
									currentSize.titleSize,
									task.state === "cancelled" ? "text-white/40 line-through" : "text-white/80",
									"hover:text-primary transition-colors",
									"focus:outline-none focus-visible:text-primary focus-visible:underline",
								)}
							>
								{task.title}
							</button>
							{showRunStatus && <RunStatusBadge status={runStatus} variant="compact" />}
						</div>

						{/* Metadata row - hidden in compact mode */}
						{currentSize.showMetadata ? (
							<div className="flex items-center gap-2 mt-2 flex-wrap">
								{/* Blocked indicator - prominent warning badge with icon */}
								{isBlocked && (
									<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-400/70">
										<svg
											width="10"
											height="10"
											viewBox="0 0 16 16"
											fill="none"
											className="opacity-70"
										>
											<circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
											<path
												d="M4.5 11.5l7-7"
												stroke="currentColor"
												strokeWidth="1.5"
												strokeLinecap="round"
											/>
										</svg>
										<span className="text-[9px] font-medium uppercase tracking-wide">blocked</span>
									</span>
								)}

								{/* Async label badge - shown when task has active async run */}
								{showRunStatus && (
									<span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
										async
									</span>
								)}

								{/* State badge - skip for blocked since we show prominent badge above */}
								{!isBlocked && (
									<span
										className={cn(
											"text-[10px] font-medium px-1.5 py-0.5 rounded",
											state.bg,
											state.text,
										)}
									>
										{state.label.toLowerCase()}
									</span>
								)}

								{isTriaged && (
									<span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
										triaged
									</span>
								)}

								{/* Labels */}
								{task.labels && task.labels.length > 0 && (
									<div className="flex items-center gap-1">
										{task.labels.slice(0, 2).map((label) => (
											<span
												key={label}
												className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary/90"
											>
												{label}
											</span>
										))}
										{task.labels.length > 2 && (
											<span className="text-[10px] text-muted-foreground/60">
												+{task.labels.length - 2}
											</span>
										)}
									</div>
								)}

								{/* Due date */}
								{task.due_at && (
									<span className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
										<svg
											width="10"
											height="10"
											viewBox="0 0 10 10"
											fill="none"
											className="opacity-70"
										>
											<rect
												x="1"
												y="2"
												width="8"
												height="7"
												rx="1"
												stroke="currentColor"
												strokeWidth="1"
											/>
											<path
												d="M3 1v2M7 1v2"
												stroke="currentColor"
												strokeWidth="1"
												strokeLinecap="round"
											/>
										</svg>
										{new Date(task.due_at).toLocaleDateString("en-US", {
											month: "short",
											day: "numeric",
										})}
									</span>
								)}

								{/* Container path indicator - shown for nested tasks */}
								{nestedPathSuffix && (
									<span className="text-[9px] font-mono text-muted-foreground/50 flex items-center gap-1 ml-auto">
										<svg
											width="8"
											height="8"
											viewBox="0 0 12 12"
											fill="none"
											className="opacity-60"
										>
											<path
												d="M2 3h3v6H2V3zM7 3h3v6H7V3z"
												stroke="currentColor"
												strokeWidth="1.2"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
										</svg>
										<span className="truncate max-w-[80px]" title={nestedPathSuffix}>
											{nestedPathSuffix}
										</span>
									</span>
								)}

								{/* Task ID - right aligned */}
								<span
									className={cn(
										"text-[10px] font-mono text-muted-foreground/60",
										!nestedPathSuffix && "ml-auto",
									)}
								>
									{task.id}
								</span>
							</div>
						) : (
							/* Compact mode: show blocked icon + task ID inline */
							<div className="flex items-center gap-1.5 mt-1">
								{isBlocked && (
									<span className="text-amber-400/80" title="Blocked">
										<svg width="9" height="9" viewBox="0 0 16 16" fill="none">
											<circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
											<path
												d="M4.5 11.5l7-7"
												stroke="currentColor"
												strokeWidth="1.5"
												strokeLinecap="round"
											/>
										</svg>
									</span>
								)}
								<span className="text-[9px] font-mono text-muted-foreground/50">{task.id}</span>
							</div>
						)}

						{/* Task body preview - expanded mode only */}
						{currentSize.showBody && truncatedDescription && (
							<div className="mt-3 relative group/body">
								{/* Accent border and container */}
								<div
									className={cn(
										"relative pl-3 pr-2 py-2 rounded-r-md",
										"border-l-2 border-primary/30",
										"bg-gradient-to-r from-primary/[0.04] to-transparent",
									)}
								>
									{/* Body text with line clamp */}
									<pre
										className={cn(
											"text-[11px] leading-relaxed text-muted-foreground/70 whitespace-pre-wrap break-words",
											"font-mono tracking-tight",
											"max-h-[200px] overflow-hidden",
										)}
									>
										{truncatedDescription.text}
									</pre>

									{/* Fade overlay when content is truncated */}
									{truncatedDescription.hasMore && (
										<div
											className={cn(
												"absolute bottom-0 left-0 right-0 h-10",
												"bg-gradient-to-t from-background via-background/80 to-transparent",
												"pointer-events-none",
												"flex items-end justify-center pb-1",
											)}
										>
											<span className="text-[9px] text-primary/50 font-medium tracking-wider uppercase">
												···
											</span>
										</div>
									)}
								</div>
							</div>
						)}
					</div>

					{/* Hover menu */}
					<div
						className={cn(
							"absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity",
							"flex items-center gap-0.5",
						)}
					>
						<div className="relative">
							<button
								onClick={handleMenuClick}
								className={cn(
									"p-1 text-muted-foreground/50 hover:text-muted-foreground/80 hover:bg-secondary/80 rounded transition-colors",
									menuOpen && "bg-secondary/80 text-muted-foreground/80",
								)}
							>
								<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
									<circle cx="3" cy="7" r="1" fill="currentColor" />
									<circle cx="7" cy="7" r="1" fill="currentColor" />
									<circle cx="11" cy="7" r="1" fill="currentColor" />
								</svg>
							</button>

							{/* Dropdown Menu */}
							{menuOpen && (
								<>
									<div
										className="fixed inset-0 z-10"
										onClick={(e) => {
											e.stopPropagation();
											setMenuOpen(false);
										}}
									/>
									<div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] bg-popover border border-border/50 rounded-lg shadow-xl py-1 overflow-hidden">
										<button
											onClick={handleDeleteClick}
											className="w-full text-left px-3 py-2 text-[12px] text-destructive hover:bg-destructive/10 flex items-center gap-2 transition-colors"
										>
											<svg
												width="14"
												height="14"
												viewBox="0 0 16 16"
												fill="none"
												className="opacity-80"
											>
												<path
													d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z"
													stroke="currentColor"
													strokeWidth="1.3"
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											</svg>
											Delete task
										</button>
									</div>
								</>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Delete Confirmation Modal */}
			{showDeleteConfirm && (
				<DeleteConfirmModal
					taskTitle={task.title}
					onConfirm={handleDeleteConfirm}
					onCancel={handleDeleteCancel}
					deleting={deleting}
					error={deleteError}
				/>
			)}
		</>
	);
}
