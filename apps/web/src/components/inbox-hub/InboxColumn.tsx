import type { ApiClientError } from "@/api/client";
import { launchTerminal, startContainerBatchTriage } from "@/api/client";
import { useAppNavigation } from "@/hooks/useNavigation";
import { buildTerminalLaunchRequest, getSessionLaunch } from "@/lib/sessionLaunches";
import { cn } from "@/lib/utils";
import type {
	BatchTriageResponse,
	ContainerNode,
	ProjectTaskListItem,
	TaskListItem,
} from "@workboard/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InboxTaskCard } from "./InboxTaskCard";
import { ProjectSettingsModal } from "./ProjectSettingsModal";
import { QuickAddCard } from "./QuickAddCard";
import type { CardSize } from "./types";

// ============================================================================
// CONTAINER GROUP HEADER COMPONENT
// ============================================================================

type ContainerGroupHeaderProps = {
	containerName: string;
	taskCount: number;
	isFirst?: boolean;
	onAddTask?: () => void;
	onDelete?: () => void;
	isReadOnly?: boolean;
};

function ContainerGroupHeader({
	containerName,
	taskCount,
	isFirst,
	onAddTask,
	onDelete,
	isReadOnly,
}: ContainerGroupHeaderProps) {
	return (
		<div
			className={cn(
				"flex items-center gap-2 pl-3 pr-2 py-1 animate-chip-in group/header",
				!isFirst && "mt-3",
				"mb-1",
			)}
		>
			{/* Container connector line */}
			<div className="w-[2px] h-3 bg-gradient-to-b from-transparent via-violet-500/40 to-violet-500/50 rounded-full animate-connector-draw" />

			{/* Container chip */}
			<div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-violet-500/[0.08] border border-violet-500/20 shadow-[0_0_12px_rgba(139,92,246,0.08)]">
				{/* Folder icon */}
				<svg width="10" height="10" viewBox="0 0 14 14" fill="none" className="text-violet-400/70">
					<path
						d="M2 4.5C2 3.67 2.67 3 3.5 3H5.59c.3 0 .59.11.8.29l.82.71H10.5c.83 0 1.5.67 1.5 1.5V10c0 .83-.67 1.5-1.5 1.5h-7C2.67 11.5 2 10.83 2 10V4.5z"
						stroke="currentColor"
						strokeWidth="1.1"
						fill="none"
					/>
				</svg>
				<span className="text-[9px] font-mono font-medium text-violet-300/80 tracking-wide truncate max-w-[100px]">
					{containerName}
				</span>
				<span className="text-[8px] font-mono text-violet-400/50 tabular-nums">{taskCount}</span>
			</div>

			{/* Add task button - appears on hover with smooth reveal */}
			{!isReadOnly && onAddTask && (
				<button
					onClick={(e) => {
						e.stopPropagation();
						onAddTask();
					}}
					className={cn(
						"flex items-center justify-center w-5 h-5 rounded-sm",
						"transition-all duration-200 ease-out",
						"opacity-0 scale-90 group-hover/header:opacity-100 group-hover/header:scale-100",
						"text-violet-400/60 hover:text-violet-300",
						"hover:bg-violet-500/20 hover:shadow-[0_0_8px_rgba(139,92,246,0.2)]",
						"focus:outline-none focus:ring-1 focus:ring-violet-400/50",
					)}
					title={`Add task to ${containerName}`}
				>
					<svg width="11" height="11" viewBox="0 0 14 14" fill="none">
						<path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
					</svg>
				</button>
			)}

			{/* Delete container button - appears on hover with smooth reveal */}
			{!isReadOnly && onDelete && (
				<button
					onClick={(e) => {
						e.stopPropagation();
						onDelete();
					}}
					className={cn(
						"flex items-center justify-center w-5 h-5 rounded-sm",
						"transition-all duration-200 ease-out",
						"opacity-0 scale-90 group-hover/header:opacity-100 group-hover/header:scale-100",
						"text-red-400/60 hover:text-red-300",
						"hover:bg-red-500/15 hover:shadow-[0_0_8px_rgba(239,68,68,0.18)]",
						"focus:outline-none focus:ring-1 focus:ring-red-400/50",
					)}
					title={`Delete ${containerName}`}
				>
					<svg width="11" height="11" viewBox="0 0 16 16" fill="none">
						<path
							d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z"
							stroke="currentColor"
							strokeWidth="1.3"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</button>
			)}
		</div>
	);
}

// ============================================================================
// LOOSE TASKS SEPARATOR COMPONENT
// ============================================================================

function LooseTasksSeparator({ isFirst }: { isFirst?: boolean }) {
	if (isFirst) return null;
	return (
		<div className="flex items-center gap-2 pl-1 py-1.5 mt-2 mb-1">
			<div className="flex-1 h-px bg-gradient-to-r from-border/40 via-border/20 to-transparent" />
			<span className="text-[8px] font-mono uppercase tracking-[0.15em] text-muted-foreground/30 px-1">
				inbox
			</span>
			<div className="flex-1 h-px bg-gradient-to-l from-border/40 via-border/20 to-transparent" />
		</div>
	);
}

// ============================================================================
// DELETE CONTAINER MODAL
// ============================================================================

function DeleteContainerModal({
	containerName,
	containerPath,
	onConfirm,
	onCancel,
	deleting,
	error,
}: {
	containerName: string;
	containerPath?: string;
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
						<h3 className="text-[14px] font-medium text-foreground">Delete Container</h3>
					</div>
				</div>

				{/* Content */}
				<div className="px-4 py-4">
					<p className="text-[13px] text-foreground/80 mb-2">
						Are you sure you want to delete this container?
					</p>
					<div className="text-[12px] text-muted-foreground/70 bg-secondary/50 px-3 py-2 rounded border border-border/30 truncate">
						{containerName}
					</div>
					{containerPath && (
						<p className="text-[10px] text-muted-foreground/60 mt-2 font-mono truncate">
							{containerPath}
						</p>
					)}
					<p className="text-[11px] text-destructive/70 mt-3">
						Deletion only succeeds for empty containers.
					</p>
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

// ============================================================================
// TASK GROUPING UTILITIES
// ============================================================================

export type GroupedTasks = {
	type: "loose" | "container";
	containerPath?: string;
	containerName?: string;
	tasks: (TaskListItem | ProjectTaskListItem)[];
};

export function groupTasksByContainer(
	tasks: (TaskListItem | ProjectTaskListItem)[],
	baseContainerPath?: string,
	childContainers?: ContainerNode[],
): GroupedTasks[] {
	if (!baseContainerPath) {
		// No container path - treat all as loose
		return [{ type: "loose", tasks }];
	}

	const looseTasks: (TaskListItem | ProjectTaskListItem)[] = [];
	const containerGroups = new Map<string, (TaskListItem | ProjectTaskListItem)[]>();

	// Pre-populate groups for all known child containers (so empty ones appear)
	if (childContainers) {
		for (const child of childContainers) {
			containerGroups.set(child.path, []);
		}
	}

	for (const task of tasks) {
		const taskPath = (task as { project?: { path?: string } }).project?.path;

		if (!taskPath || taskPath === baseContainerPath) {
			// Task is directly in the inbox container (loose)
			looseTasks.push(task);
		} else if (taskPath.startsWith(`${baseContainerPath}/`)) {
			// Task is in a sub-container
			const relativePath = taskPath.slice(baseContainerPath.length + 1);
			// Get the immediate child container name (first segment)
			const immediateChild = relativePath.split("/")[0];
			const fullChildPath = `${baseContainerPath}/${immediateChild}`;

			if (!containerGroups.has(fullChildPath)) {
				containerGroups.set(fullChildPath, []);
			}
			containerGroups.get(fullChildPath)!.push(task);
		} else {
			// Fallback - shouldn't happen but treat as loose
			looseTasks.push(task);
		}
	}

	// Build result: loose tasks first, then container groups sorted by name
	const result: GroupedTasks[] = [];

	if (looseTasks.length > 0) {
		result.push({ type: "loose", tasks: looseTasks });
	}

	// Sort container groups by name
	const sortedContainers = Array.from(containerGroups.entries()).sort(([a], [b]) =>
		a.localeCompare(b),
	);

	for (const [fullPath, groupTasks] of sortedContainers) {
		const containerName = fullPath.split("/").pop() || fullPath;
		result.push({
			type: "container",
			containerPath: fullPath,
			containerName,
			tasks: groupTasks,
		});
	}

	return result;
}

// ============================================================================
// TRIAGE BUTTON COMPONENT
// ============================================================================

type TriageButtonProps = {
	onClick: () => void;
	loading: boolean;
	disabled?: boolean;
};

function TriageButton({ onClick, loading, disabled }: TriageButtonProps) {
	return (
		<button
			onClick={onClick}
			disabled={disabled || loading}
			title="Triage all eligible tasks"
			className={cn(
				"group relative flex items-center justify-center w-7 h-7 rounded flex-shrink-0",
				"transition-all duration-200",
				loading
					? "cursor-wait"
					: disabled
						? "opacity-40 cursor-not-allowed"
						: "hover:scale-105 active:scale-95",
				// Idle state: amber glow
				!loading && !disabled && "text-amber-400/80 hover:text-amber-300",
				// Background with subtle gradient
				!loading &&
					!disabled &&
					"bg-gradient-to-br from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10",
				!loading && !disabled && "border border-amber-500/30 hover:border-amber-400/50",
				// Loading state: pulsing
				loading && "text-amber-400 bg-amber-500/15 border border-amber-400/40",
				// Disabled state
				disabled && "text-muted-foreground/30 bg-transparent border border-border/20",
			)}
		>
			{loading ? (
				// Pulsing spark animation
				<div className="relative w-4 h-4">
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						className="absolute inset-0 animate-pulse"
					>
						<path d="M8 1L6 7h4L6 15l6-8H8l2-6H8z" fill="currentColor" opacity="0.6" />
					</svg>
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						className="absolute inset-0 animate-ping opacity-40"
					>
						<path d="M8 1L6 7h4L6 15l6-8H8l2-6H8z" fill="currentColor" />
					</svg>
				</div>
			) : (
				// Zap/spark icon
				<svg
					width="14"
					height="14"
					viewBox="0 0 16 16"
					fill="none"
					className="transition-transform group-hover:rotate-12"
				>
					<path
						d="M8.5 1L5.5 7h4L5.5 15l7-9H8l2.5-5H8.5z"
						stroke="currentColor"
						strokeWidth="1.3"
						strokeLinecap="round"
						strokeLinejoin="round"
						fill="none"
					/>
					{/* Spark accent dots */}
					<circle
						cx="3"
						cy="4"
						r="0.8"
						fill="currentColor"
						className="opacity-50 group-hover:opacity-80"
					/>
					<circle
						cx="13"
						cy="11"
						r="0.6"
						fill="currentColor"
						className="opacity-40 group-hover:opacity-70"
					/>
				</svg>
			)}
			{/* Glow effect on hover */}
			{!loading && !disabled && (
				<div className="absolute inset-0 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-amber-400/10 blur-sm -z-10" />
			)}
		</button>
	);
}

// ============================================================================
// TRIAGE RESULTS BANNER COMPONENT
// ============================================================================

type TriageResultsBannerProps = {
	results: BatchTriageResponse;
	onDismiss: () => void;
};

function TriageResultsBanner({ results, onDismiss }: TriageResultsBannerProps) {
	const { started, skipped, blocked } = results;
	const total = started.length + skipped.length + blocked.length;

	if (total === 0) {
		return (
			<div className="mx-2 mb-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/40 flex items-center justify-between animate-fade-in">
				<span className="text-[11px] text-muted-foreground/70 font-mono">No eligible tasks</span>
				<button
					onClick={onDismiss}
					className="text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
				>
					<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
						<path
							d="M2 2l8 8M10 2l-8 8"
							stroke="currentColor"
							strokeWidth="1.3"
							strokeLinecap="round"
						/>
					</svg>
				</button>
			</div>
		);
	}

	return (
		<div className="mx-2 mb-2 animate-fade-in">
			{/* Results container with sleek gradient border */}
			<div className="relative rounded-lg overflow-hidden">
				{/* Gradient border effect */}
				<div className="absolute inset-0 bg-gradient-to-r from-emerald-500/30 via-amber-500/30 to-orange-500/30 rounded-lg" />
				<div className="relative m-[1px] px-3 py-2 rounded-[7px] bg-background/95 backdrop-blur-sm">
					<div className="flex items-center justify-between gap-3">
						{/* Status pills */}
						<div className="flex items-center gap-2 flex-wrap">
							{/* Started - emerald/green */}
							{started.length > 0 && (
								<div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
									<div className="relative">
										<div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
										<div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping opacity-50" />
									</div>
									<span className="text-[10px] font-mono font-semibold text-emerald-400 tracking-wide">
										{started.length}
									</span>
									<span className="text-[9px] font-mono text-emerald-400/70 uppercase tracking-wider">
										started
									</span>
								</div>
							)}

							{/* Skipped - muted gray */}
							{skipped.length > 0 && (
								<div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/40 border border-border/50">
									<div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
									<span className="text-[10px] font-mono font-medium text-muted-foreground/70 tracking-wide">
										{skipped.length}
									</span>
									<span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider">
										skipped
									</span>
								</div>
							)}

							{/* Blocked - orange/amber */}
							{blocked.length > 0 && (
								<div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-500/15 border border-orange-500/30">
									<svg
										width="10"
										height="10"
										viewBox="0 0 12 12"
										fill="none"
										className="text-orange-400"
									>
										<path
											d="M6 2v4M6 8v.5"
											stroke="currentColor"
											strokeWidth="1.5"
											strokeLinecap="round"
										/>
									</svg>
									<span className="text-[10px] font-mono font-semibold text-orange-400 tracking-wide">
										{blocked.length}
									</span>
									<span className="text-[9px] font-mono text-orange-400/70 uppercase tracking-wider">
										blocked
									</span>
								</div>
							)}
						</div>

						{/* Dismiss button */}
						<button
							onClick={onDismiss}
							className="flex-shrink-0 p-1 rounded text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-muted/30 transition-colors"
						>
							<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
								<path
									d="M2 2l8 8M10 2l-8 8"
									stroke="currentColor"
									strokeWidth="1.3"
									strokeLinecap="round"
								/>
							</svg>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

type DragData = {
	taskId: string;
	taskTitle: string;
	sourceWorkspaceId: string;
	globalTaskId: string;
};

export type TaskCreateResult =
	| { success: true; taskId: string; taskSlug: string; taskTitle: string }
	| { success: false; error: string };

type InboxColumnProps = {
	workspaceId: string;
	workspaceName: string;
	containerId: string;
	containerTitle: string;
	containerPath?: string;
	/** Child containers for showing empty sub-containers */
	childContainers?: ContainerNode[];
	tasks: (TaskListItem | ProjectTaskListItem)[];
	loading: boolean;
	error: ApiClientError | null;
	onTaskComplete: (task: TaskListItem | ProjectTaskListItem) => void;
	/** Create a task. If targetContainerPath is provided, creates in that sub-container. */
	onTaskCreate: (
		title: string,
		description?: string,
		targetContainerPath?: string,
	) => Promise<TaskCreateResult>;
	onTaskClick: (taskId: string) => void;
	onTaskSelect: (taskId: string) => void;
	onTaskDelete: (task: TaskListItem | ProjectTaskListItem) => Promise<void>;
	onContainerDelete?: (containerPath: string) => Promise<void>;
	onTaskDrop?: (dragData: DragData, targetWorkspaceId: string) => Promise<void>;
	onRefresh?: () => void;
	style?: React.CSSProperties;
	mode?: "action" | "awaiting_ack" | "completed";
	// Keyboard navigation props
	isFocused?: boolean;
	selectedTaskId?: string | null;
	suppressSelectionScrollTaskId?: string | null;
	forceQuickAdd?: boolean;
	onQuickAddClose?: () => void;
	// Animation state
	completingTasks?: Set<string>;
	// Card size/density
	cardSize?: CardSize;
	selectionScrollBehavior?: ScrollBehavior;
	// Search state
	searchActive?: boolean;
	searchMatches?: Set<string>;
};

export function InboxColumn({
	workspaceId,
	workspaceName,
	containerId,
	containerTitle,
	containerPath,
	childContainers,
	tasks,
	loading,
	error,
	onTaskComplete,
	onTaskCreate,
	onTaskClick,
	onTaskSelect,
	onTaskDelete,
	onContainerDelete,
	onTaskDrop,
	onRefresh,
	style,
	mode = "action",
	isFocused = false,
	selectedTaskId = null,
	suppressSelectionScrollTaskId = null,
	forceQuickAdd = false,
	onQuickAddClose,
	completingTasks,
	cardSize = "default",
	selectionScrollBehavior = "smooth",
	searchActive = false,
	searchMatches,
}: InboxColumnProps) {
	const { goToContainer, goToContainerView } = useAppNavigation();
	const [showQuickAdd, setShowQuickAdd] = useState(false);
	// Track which container the quick-add is for (null = inbox root, string = sub-container path)
	const [quickAddContainerPath, setQuickAddContainerPath] = useState<string | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const [collapsed, setCollapsed] = useState(false);
	const [isDragOver, setIsDragOver] = useState(false);
	const [isDropping, setIsDropping] = useState(false);
	const [dropError, setDropError] = useState<string | null>(null);
	const [terminalLoading, setTerminalLoading] = useState(false);
	const [triageLoading, setTriageLoading] = useState(false);
	const [triageResults, setTriageResults] = useState<BatchTriageResponse | null>(null);
	const [triageError, setTriageError] = useState<string | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<{ path: string; name: string } | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [settingsModalOpen, setSettingsModalOpen] = useState(false);
	const isReadOnly = mode === "awaiting_ack" || mode === "completed";
	const allowDrop = mode === "action" && !!onTaskDrop;
	const isEmptyFocused = isFocused && tasks.length === 0 && !loading;
	const isSearchActive = searchActive;

	// Group tasks by their container path for visual hierarchy
	const groupedTasks = useMemo(
		() => groupTasksByContainer(tasks, containerPath, childContainers),
		[tasks, containerPath, childContainers],
	);

	// Column width based on card size (default: 375px, expanded: +30% = ~488px)
	const columnWidth = cardSize === "expanded" ? "md:w-[488px]" : "md:w-[375px]";

	// Handle forceQuickAdd from keyboard navigation
	useEffect(() => {
		if (forceQuickAdd && !isReadOnly) {
			setShowQuickAdd(true);
			setCollapsed(false);
		}
	}, [forceQuickAdd, isReadOnly]);

	// Notify parent when quick add closes
	const handleQuickAddClose = useCallback(() => {
		setShowQuickAdd(false);
		setQuickAddContainerPath(null);
		onQuickAddClose?.();
	}, [onQuickAddClose]);

	// Open quick-add for a specific container
	const handleOpenQuickAddForContainer = useCallback((targetPath: string | null) => {
		setQuickAddContainerPath(targetPath);
		setShowQuickAdd(true);
		setCollapsed(false);
	}, []);

	const canDeleteContainers = !!onContainerDelete && !isReadOnly;

	const handleOpenDeleteContainer = useCallback((path: string, name: string) => {
		setDeleteError(null);
		setDeleteTarget({ path, name });
	}, []);

	const handleDeleteContainerCancel = useCallback(() => {
		if (deleteLoading) return;
		setDeleteTarget(null);
		setDeleteError(null);
	}, [deleteLoading]);

	const handleDeleteContainerConfirm = useCallback(async () => {
		if (!deleteTarget || !onContainerDelete) return;
		setDeleteLoading(true);
		setDeleteError(null);
		try {
			await onContainerDelete(deleteTarget.path);
			setDeleteTarget(null);
		} catch (err) {
			const apiError = err as ApiClientError;
			setDeleteError(apiError.message || "Failed to delete container");
		} finally {
			setDeleteLoading(false);
		}
	}, [deleteTarget, onContainerDelete]);

	// Handle opening terminal with clod
	const handleOpenTerminal = useCallback(async () => {
		setTerminalLoading(true);
		try {
			const launch = getSessionLaunch("interactive-clod");
			await launchTerminal(
				buildTerminalLaunchRequest(
					launch,
					{
						projectId: workspaceId,
						statusbar: { left: "", right: `clod@${workspaceId}` },
					},
					"inbox",
				),
			);
		} catch (err) {
			console.error("Failed to open terminal:", err);
		} finally {
			setTerminalLoading(false);
		}
	}, [workspaceId]);

	// Handle opening terminal with triage command for a specific task
	const handleOpenTriageTerminal = useCallback(
		async (params: { taskId: string; taskSlug: string; taskTitle: string }) => {
			const launch = getSessionLaunch("triage-clod");
			await launchTerminal(
				buildTerminalLaunchRequest(
					launch,
					{
						projectId: workspaceId,
						statusbar: { right: `clod@${workspaceId}` },
						task: { id: params.taskId, slug: `inbox/${params.taskSlug}`, title: params.taskTitle },
					},
					"inbox",
				),
			);
		},
		[workspaceId],
	);

	// Handle opening terminal with implement command for a specific task
	const handleOpenImplementTerminal = useCallback(
		async (params: { taskId: string; taskSlug: string; taskTitle: string }) => {
			const launch = getSessionLaunch("implement-clod");
			await launchTerminal(
				buildTerminalLaunchRequest(
					launch,
					{
						projectId: workspaceId,
						statusbar: { right: `clod@${workspaceId}` },
						task: { id: params.taskId, slug: `inbox/${params.taskSlug}`, title: params.taskTitle },
					},
					"inbox",
				),
			);
		},
		[workspaceId],
	);

	// Handle batch triage for all eligible tasks in this container
	const handleBatchTriage = useCallback(async () => {
		setTriageLoading(true);
		setTriageResults(null);
		setTriageError(null);
		try {
			const results = await startContainerBatchTriage(workspaceId, containerId);
			setTriageResults(results);
			// Auto-dismiss results after 10 seconds
			setTimeout(() => setTriageResults(null), 10000);
		} catch (err) {
			console.error("Failed to start batch triage:", err);
			const errorMessage =
				err && typeof err === "object" && "message" in err
					? (err as { message: string }).message
					: "Failed to start triage";
			setTriageError(errorMessage);
			// Auto-clear error after 5 seconds
			setTimeout(() => setTriageError(null), 5000);
		} finally {
			setTriageLoading(false);
		}
	}, [workspaceId, containerId]);

	const handleDragOver = (e: React.DragEvent) => {
		if (!allowDrop) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		setIsDragOver(true);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		if (!allowDrop) return;
		// Only set isDragOver to false if we're leaving the column entirely
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX;
		const y = e.clientY;
		if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
			setIsDragOver(false);
		}
	};

	const handleDrop = async (e: React.DragEvent) => {
		if (!allowDrop) return;
		e.preventDefault();
		setIsDragOver(false);
		setDropError(null);

		try {
			const data = e.dataTransfer.getData("application/json");
			if (!data) return;

			const dragData: DragData = JSON.parse(data);

			// Don't allow dropping in the same workspace
			if (dragData.sourceWorkspaceId === workspaceId) {
				return;
			}

			setIsDropping(true);
			await onTaskDrop(dragData, workspaceId);
		} catch (err) {
			console.error("Failed to handle drop:", err);
			// Extract error message for display
			const errorMessage =
				err && typeof err === "object" && "message" in err
					? (err as { message: string }).message
					: "Failed to move task";
			setDropError(errorMessage);
			// Auto-clear error after 5 seconds
			setTimeout(() => setDropError(null), 5000);
		} finally {
			setIsDropping(false);
		}
	};

	const handleAddTask = async (title: string, description?: string) => {
		const result = await onTaskCreate(title, description, quickAddContainerPath ?? undefined);
		if (result.success) {
			setShowQuickAdd(false);
			setQuickAddContainerPath(null);
			onQuickAddClose?.();
		}
		return result;
	};

	const openInMainApp = () => {
		// Navigate to main app view for this container using wouter
		goToContainer(workspaceId, containerId);
	};

	return (
		<div
			data-column-workspace-id={workspaceId}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			className={cn(
				"flex flex-col w-full flex-shrink-0",
				columnWidth,
				collapsed ? "h-auto" : "h-auto md:h-full",
				"animate-fade-in",
				"rounded-lg transition-all duration-200",
				isDragOver && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background bg-primary/5",
				isDropping && "opacity-70",
			)}
			style={style}
		>
			{/* Column Header */}
			<div
				className={cn(
					"flex items-center justify-between px-2 py-2 mb-2 relative transition-colors",
					// Focused state: amber cursor line on left edge
					isFocused &&
						"bg-amber-500/[0.06] before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:bg-amber-400 before:rounded-full before:shadow-[0_0_8px_rgba(251,191,36,0.5)] before:animate-cursor-in",
				)}
			>
				<div className="flex items-center gap-2 min-w-0">
					<button
						onClick={() => setCollapsed(!collapsed)}
						className="text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 12 12"
							fill="none"
							className={cn("transition-transform", collapsed && "-rotate-90")}
						>
							<path
								d="M3 4.5l3 3 3-3"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</button>
					<button
						onClick={() => goToContainerView(workspaceId, "inbox")}
						className={cn(
							"text-[14px] font-semibold truncate hover:underline transition-colors text-left",
							isFocused ? "text-amber-300" : "text-primary hover:text-primary/80",
						)}
						title={`Open ${workspaceName}/inbox in container view`}
					>
						{workspaceName}
					</button>
					<span className="text-[12px] text-muted-foreground/70 tabular-nums flex-shrink-0">
						{tasks.length}
					</span>
				</div>

				<div className="flex items-center gap-1">
					{/* Triage Container Button - only show in action mode */}
					{!isReadOnly && (
						<TriageButton
							onClick={handleBatchTriage}
							loading={triageLoading}
							disabled={tasks.length === 0}
						/>
					)}
					<button
						onClick={handleOpenTerminal}
						disabled={terminalLoading}
						title="Open terminal"
						className={cn(
							"flex items-center justify-center w-7 h-7 rounded flex-shrink-0",
							"text-primary/70 hover:text-primary hover:bg-primary/15",
							"transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
							terminalLoading && "cursor-wait",
						)}
					>
						{terminalLoading ? (
							<div className="w-4 h-4 border border-current/30 border-t-current rounded-full animate-spin" />
						) : (
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
								<rect
									x="2"
									y="3"
									width="12"
									height="10"
									rx="1.5"
									stroke="currentColor"
									strokeWidth="1.2"
								/>
								<path
									d="M4.5 6.5l2 1.5-2 1.5"
									stroke="currentColor"
									strokeWidth="1.2"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
								<path d="M8 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
							</svg>
						)}
					</button>
					{/* Settings Cog */}
					<button
						onClick={() => setSettingsModalOpen(true)}
						title="Project settings"
						className={cn(
							"flex items-center justify-center w-7 h-7 rounded flex-shrink-0",
							"text-muted-foreground/50 hover:text-foreground/80 hover:bg-secondary/60",
							"transition-colors",
						)}
					>
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
							<path
								d="M6.5 1.5h3v1.7a4.5 4.5 0 011.3.5l1.2-1.2 2.1 2.1-1.2 1.2c.2.4.4.8.5 1.3h1.7v3h-1.7a4.5 4.5 0 01-.5 1.3l1.2 1.2-2.1 2.1-1.2-1.2c-.4.2-.8.4-1.3.5v1.7h-3v-1.7a4.5 4.5 0 01-1.3-.5l-1.2 1.2-2.1-2.1 1.2-1.2a4.5 4.5 0 01-.5-1.3H1.5v-3h1.7c.1-.5.3-.9.5-1.3L2.5 4.6l2.1-2.1 1.2 1.2c.4-.2.8-.4 1.3-.5V1.5z"
								stroke="currentColor"
								strokeWidth="1.2"
								strokeLinejoin="round"
							/>
							<circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
						</svg>
					</button>
					<div className="relative">
						<button
							onClick={() => setMenuOpen(!menuOpen)}
							className={cn(
								"p-1.5 rounded text-muted-foreground/50 hover:text-muted-foreground/80 hover:bg-secondary/60 transition-colors",
								menuOpen && "bg-secondary/60 text-muted-foreground/80",
							)}
						>
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
								<circle cx="3" cy="8" r="1.5" fill="currentColor" />
								<circle cx="8" cy="8" r="1.5" fill="currentColor" />
								<circle cx="13" cy="8" r="1.5" fill="currentColor" />
							</svg>
						</button>

						{menuOpen && (
							<>
								<div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
								<div className="absolute right-0 top-full mt-1 z-20 min-w-[180px] bg-popover border border-border/50 rounded-lg shadow-xl py-1 overflow-hidden">
									{/* Add task */}
									{!isReadOnly && (
										<button
											onClick={() => {
												setMenuOpen(false);
												setShowQuickAdd(true);
												setCollapsed(false);
											}}
											className="w-full text-left px-3 py-2 text-[12px] text-foreground/90 hover:bg-secondary/60 flex items-center gap-2"
										>
											<svg
												width="14"
												height="14"
												viewBox="0 0 14 14"
												fill="none"
												className="text-primary/70"
											>
												<path
													d="M7 3v8M3 7h8"
													stroke="currentColor"
													strokeWidth="1.5"
													strokeLinecap="round"
												/>
											</svg>
											Add task
										</button>
									)}

									{!isReadOnly && <div className="border-t border-border/30 my-1" />}

									{/* Refresh column */}
									{onRefresh && (
										<button
											onClick={() => {
												setMenuOpen(false);
												onRefresh();
											}}
											className="w-full text-left px-3 py-2 text-[12px] text-foreground/90 hover:bg-secondary/60 flex items-center gap-2"
										>
											<svg
												width="14"
												height="14"
												viewBox="0 0 14 14"
												fill="none"
												className="text-muted-foreground/70"
											>
												<path
													d="M2.5 7a4.5 4.5 0 018.5-2M11.5 7a4.5 4.5 0 01-8.5 2"
													stroke="currentColor"
													strokeWidth="1.3"
													strokeLinecap="round"
												/>
												<path
													d="M11 3v2h-2M3 9v2h2"
													stroke="currentColor"
													strokeWidth="1.3"
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											</svg>
											Refresh
										</button>
									)}

									{/* Collapse/Expand */}
									<button
										onClick={() => {
											setMenuOpen(false);
											setCollapsed(!collapsed);
										}}
										className="w-full text-left px-3 py-2 text-[12px] text-foreground/90 hover:bg-secondary/60 flex items-center gap-2"
									>
										<svg
											width="14"
											height="14"
											viewBox="0 0 14 14"
											fill="none"
											className="text-muted-foreground/70"
										>
											{collapsed ? (
												<path
													d="M3 5l4 4 4-4"
													stroke="currentColor"
													strokeWidth="1.3"
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											) : (
												<path
													d="M3 9l4-4 4 4"
													stroke="currentColor"
													strokeWidth="1.3"
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											)}
										</svg>
										{collapsed ? "Expand" : "Collapse"}
									</button>

									<div className="border-t border-border/30 my-1" />

									{/* View in main app */}
									<button
										onClick={() => {
											setMenuOpen(false);
											openInMainApp();
										}}
										className="w-full text-left px-3 py-2 text-[12px] text-foreground/90 hover:bg-secondary/60 flex items-center gap-2"
									>
										<svg
											width="14"
											height="14"
											viewBox="0 0 14 14"
											fill="none"
											className="text-muted-foreground/70"
										>
											<path
												d="M10 4L4 10M10 4H6M10 4v4"
												stroke="currentColor"
												strokeWidth="1.3"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
										</svg>
										Open in app
									</button>

									{/* Path info footer */}
									<div className="border-t border-border/20 mt-1 pt-2 pb-1.5 px-3">
										<div className="text-[10px] text-muted-foreground/50 font-mono truncate">
											{workspaceName}/{containerTitle}
										</div>
									</div>
								</div>
							</>
						)}
					</div>
				</div>
			</div>

			{/* Triage Results Banner */}
			{triageResults && (
				<TriageResultsBanner results={triageResults} onDismiss={() => setTriageResults(null)} />
			)}

			{/* Triage Error Banner */}
			{triageError && (
				<div className="mx-2 mb-2 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-start gap-2 animate-fade-in">
					<svg
						width="14"
						height="14"
						viewBox="0 0 16 16"
						fill="none"
						className="text-amber-400 flex-shrink-0 mt-0.5"
					>
						<path
							d="M8.5 1L5.5 7h4L5.5 15l7-9H8l2.5-5H8.5z"
							stroke="currentColor"
							strokeWidth="1.3"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
					<div className="flex-1 min-w-0">
						<p className="text-[11px] text-amber-400/90 break-words">{triageError}</p>
					</div>
					<button
						onClick={() => setTriageError(null)}
						className="text-amber-400/60 hover:text-amber-400 transition-colors flex-shrink-0"
					>
						<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
							<path
								d="M2 2l8 8M10 2l-8 8"
								stroke="currentColor"
								strokeWidth="1.3"
								strokeLinecap="round"
							/>
						</svg>
					</button>
				</div>
			)}

			{/* Drop Error Banner */}
			{dropError && (
				<div className="mx-2 mb-2 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 flex items-start gap-2 animate-fade-in">
					<svg
						width="14"
						height="14"
						viewBox="0 0 16 16"
						fill="none"
						className="text-red-400 flex-shrink-0 mt-0.5"
					>
						<circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" />
						<path
							d="M8 5v3.5M8 10.5v.5"
							stroke="currentColor"
							strokeWidth="1.3"
							strokeLinecap="round"
						/>
					</svg>
					<div className="flex-1 min-w-0">
						<p className="text-[11px] text-red-400/90 break-words">{dropError}</p>
					</div>
					<button
						onClick={() => setDropError(null)}
						className="text-red-400/60 hover:text-red-400 transition-colors flex-shrink-0"
					>
						<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
							<path
								d="M2 2l8 8M10 2l-8 8"
								stroke="currentColor"
								strokeWidth="1.3"
								strokeLinecap="round"
							/>
						</svg>
					</button>
				</div>
			)}

			{/* Delete Container Modal */}
			{deleteTarget && (
				<DeleteContainerModal
					containerName={deleteTarget.name}
					containerPath={deleteTarget.path}
					onConfirm={handleDeleteContainerConfirm}
					onCancel={handleDeleteContainerCancel}
					deleting={deleteLoading}
					error={deleteError}
				/>
			)}

			{/* Task List - scrollable container with Add button inside */}
			{!collapsed && (
				<div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-gutter-stable pr-1">
					<div className="space-y-2 pb-2">
						{loading ? (
							<div className="px-2 py-8 text-center">
								<div className="w-5 h-5 border-2 border-primary/30 border-t-primary/70 rounded-full animate-spin mx-auto mb-2" />
								<p className="text-[11px] text-muted-foreground/60">Loading...</p>
							</div>
						) : error ? (
							<div className="px-3 py-4 text-center">
								<p className="text-[11px] text-red-400/80">{error.message}</p>
							</div>
						) : tasks.length === 0 && !showQuickAdd ? (
							<div className="px-3 py-8 text-center">
								<p className="text-[12px] text-muted-foreground/60 mb-1">
									{mode === "completed"
										? "No completed tasks"
										: mode === "awaiting_ack"
											? "No tasks awaiting ack"
											: "No tasks"}
								</p>
								{!isReadOnly && (
									<p className="text-[11px] text-muted-foreground/40">Click below to add one</p>
								)}
							</div>
						) : (
							<>
								{groupedTasks.map((group, groupIndex) => (
									<div key={group.type === "container" ? group.containerPath : "loose"}>
										{/* Group header */}
										{group.type === "container" && group.containerName && (
											<ContainerGroupHeader
												containerName={group.containerName}
												taskCount={group.tasks.length}
												isFirst={groupIndex === 0}
												onAddTask={() =>
													handleOpenQuickAddForContainer(group.containerPath ?? null)
												}
												onDelete={
													canDeleteContainers && group.containerPath
														? () =>
																handleOpenDeleteContainer(
																	group.containerPath!,
																	group.containerName || group.containerPath!,
																)
														: undefined
												}
												isReadOnly={isReadOnly}
											/>
										)}
										{group.type === "loose" && groupIndex > 0 && (
											<LooseTasksSeparator isFirst={groupIndex === 0} />
										)}

										{/* Task cards with container grouping visual treatment */}
										{/* Indentation: pl-5 (20px) aligns task cards with folder name text */}
										<div className={cn(group.type === "container" && "pl-5")}>
											<div className="space-y-2">
												{group.tasks.map((task) => {
													const runStatus = task.run_status;
													const taskKey = `${workspaceId}:${task.id}`;
													const isCompleting = completingTasks?.has(taskKey) ?? false;
													const isMatch = isSearchActive
														? (searchMatches?.has(task.id) ?? false)
														: true;
													return (
														<InboxTaskCard
															key={task.id}
															task={task}
															workspaceId={workspaceId}
															onComplete={() => onTaskComplete(task)}
															onClick={() => onTaskClick(task.id)}
															onSelect={() => onTaskSelect(task.id)}
															onDelete={() => onTaskDelete(task)}
															actionMode={
																mode === "awaiting_ack"
																	? "ack"
																	: mode === "completed"
																		? "none"
																		: "complete"
															}
															draggable={!isReadOnly}
															runStatus={
																runStatus as import("@workboard/shared").TaskRunStatus | null
															}
															isSelected={selectedTaskId === task.id}
															isCompleting={isCompleting}
															cardSize={cardSize}
															selectionScrollBehavior={selectionScrollBehavior}
															suppressSelectionScroll={suppressSelectionScrollTaskId === task.id}
															searchActive={isSearchActive}
															searchMatch={isMatch}
															containerPath={containerPath}
															isGrouped={group.type === "container"}
															groupContainerName={group.containerName}
														/>
													);
												})}
											</div>
										</div>
									</div>
								))}
							</>
						)}

						{/* Quick Add Card - inside scrollable area */}
						{!isReadOnly && showQuickAdd && (
							<QuickAddCard
								workspaceName={workspaceName}
								containerTitle={
									quickAddContainerPath
										? quickAddContainerPath.split("/").pop() || containerTitle
										: containerTitle
								}
								onSubmit={handleAddTask}
								onCancel={handleQuickAddClose}
								onOpenTriageTerminal={handleOpenTriageTerminal}
								onOpenImplementTerminal={handleOpenImplementTerminal}
							/>
						)}

						{/* Add Task Button - at bottom of scrollable list */}
						{!isReadOnly && !showQuickAdd && (
							<button
								onClick={() => setShowQuickAdd(true)}
								className={cn(
									"flex items-center gap-2 w-full px-2 py-2.5 mt-1 rounded-lg",
									"text-[13px] transition-colors group",
									// Focused empty column state
									isEmptyFocused
										? "text-amber-300/90 bg-amber-500/[0.08] border border-amber-500/30 ring-1 ring-amber-400/20"
										: "text-muted-foreground/60 hover:text-foreground/90 hover:bg-secondary/50",
								)}
							>
								<span
									className={cn(
										"w-5 h-5 flex items-center justify-center transition-colors",
										isEmptyFocused ? "text-amber-400" : "text-primary/70 group-hover:text-primary",
									)}
								>
									<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
										<path
											d="M7 1v12M1 7h12"
											stroke="currentColor"
											strokeWidth="1.5"
											strokeLinecap="round"
										/>
									</svg>
								</span>
								<span>Add task</span>
								{isEmptyFocused && (
									<kbd className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400/70 border border-amber-500/20">
										n
									</kbd>
								)}
							</button>
						)}
					</div>
				</div>
			)}

			{/* Project Settings Modal */}
			<ProjectSettingsModal
				open={settingsModalOpen}
				projectId={workspaceId}
				projectName={workspaceName}
				onClose={() => setSettingsModalOpen(false)}
			/>
		</div>
	);
}
