import {
	type ApiClientError,
	createComment,
	fetchTaskComments,
	fetchTaskDetail,
	fetchWorkspaceTasks,
	updateTask,
} from "@/api/client";
import { CommentsTimeline } from "@/components/CommentsTimeline";
import { ErrorBanner } from "@/components/ErrorBanner";
import { MarkdownContent } from "@/components/MarkdownContent";
import { CreateSubItemModal } from "@/components/roadmap/CreateSubItemModal";
import { useAppNavigation } from "@/hooks/useNavigation";
import { type WebhookTaskPayload, useTaskWebhook } from "@/hooks/useTaskWebhook";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type {
	ProjectTaskListItem,
	SubtaskReference,
	TaskComment,
	TaskDetail,
	TaskState,
} from "@webwrkq/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// State styling configuration (matches ContainerNavigator)
const stateConfig: Record<
	string,
	{ label: string; bg: string; text: string; glow: string; border: string }
> = {
	idea: {
		label: "IDEA",
		bg: "bg-cyan-500/15",
		text: "text-cyan-400",
		glow: "shadow-[0_0_20px_rgba(34,211,238,0.12)]",
		border: "border-cyan-500/30",
	},
	draft: {
		label: "DRAFT",
		bg: "bg-fuchsia-500/15",
		text: "text-fuchsia-400",
		glow: "shadow-[0_0_20px_rgba(232,121,249,0.12)]",
		border: "border-fuchsia-500/30",
	},
	open: {
		label: "OPEN",
		bg: "bg-emerald-500/15",
		text: "text-emerald-400",
		glow: "shadow-[0_0_20px_rgba(52,211,153,0.12)]",
		border: "border-emerald-500/30",
	},
	in_progress: {
		label: "ACTIVE",
		bg: "bg-amber-500/15",
		text: "text-amber-400",
		glow: "shadow-[0_0_20px_rgba(251,191,36,0.12)]",
		border: "border-amber-500/30",
	},
	completed: {
		label: "DONE",
		bg: "bg-zinc-600/20",
		text: "text-zinc-500",
		glow: "",
		border: "border-zinc-600/30",
	},
	blocked: {
		label: "BLOCKED",
		bg: "bg-rose-500/15",
		text: "text-rose-400",
		glow: "shadow-[0_0_20px_rgba(244,63,94,0.12)]",
		border: "border-rose-500/30",
	},
	cancelled: {
		label: "CANCELLED",
		bg: "bg-zinc-700/20",
		text: "text-zinc-600",
		glow: "",
		border: "border-zinc-700/30",
	},
	archived: {
		label: "ARCHIVED",
		bg: "bg-zinc-800/20",
		text: "text-zinc-600",
		glow: "",
		border: "border-zinc-800/30",
	},
};

// Priority indicators
const priorityConfig: Record<number, { marker: string; color: string; label: string }> = {
	1: { marker: "▓▓▓", color: "text-red-400", label: "CRITICAL" },
	2: { marker: "▓▓░", color: "text-amber-400", label: "HIGH" },
	3: { marker: "▓░░", color: "text-sky-400", label: "NORMAL" },
	4: { marker: "░░░", color: "text-zinc-500", label: "LOW" },
};

// State sort order for siblings
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

type ContainerDetailViewProps = {
	workspaceId: string;
	containerId: string;
	/** Task ID (T-xxxxx) or slug (my-task-slug) */
	taskRef: string;
};

/** Check if a taskRef is a task ID (T-xxxxx format) vs a slug */
function _isTaskId(ref: string): boolean {
	return /^T-\d+$/i.test(ref);
}

// Comment composer component
function CommentComposer({
	taskId,
	workspaceId,
	onCommentAdded,
	textareaRef,
}: {
	taskId: string;
	workspaceId: string;
	onCommentAdded?: () => void;
	textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
	const [body, setBody] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<ApiClientError | null>(null);

	const submitComment = async () => {
		if (!body.trim() || loading) return;
		setLoading(true);
		setError(null);
		try {
			await createComment(workspaceId, taskId, { body });
			setBody("");
			onCommentAdded?.();
		} catch (err) {
			setError(err as ApiClientError);
		} finally {
			setLoading(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			submitComment();
		}
	};

	return (
		<div className="space-y-2">
			{error && (
				<ErrorBanner
					title="Failed to post comment"
					message={error.message}
					detail={typeof error.details === "string" ? error.details : undefined}
				/>
			)}
			<div className="relative group">
				<div className="absolute left-3 top-3 text-amber-400/60 font-mono text-[11px]">›</div>
				<textarea
					ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
					value={body}
					onChange={(e) => setBody(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="add a thought..."
					rows={3}
					className={cn(
						"w-full resize-y bg-secondary/40 border border-border/40 pl-7 pr-4 py-3",
						"text-[12px] font-mono placeholder:text-muted-foreground/30",
						"focus:outline-none focus:border-amber-500/40 focus:bg-secondary/60",
						"disabled:cursor-not-allowed disabled:opacity-50 tracking-wide min-h-[80px]",
						"transition-all duration-200",
					)}
					disabled={loading}
				/>
				<div className="flex justify-between items-center pt-2 px-1">
					<span className="text-[9px] font-mono text-muted-foreground/30 uppercase tracking-wider">
						markdown supported
					</span>
					<button
						type="button"
						onClick={submitComment}
						disabled={loading || !body.trim()}
						className={cn(
							"text-[10px] uppercase tracking-[0.15em] font-mono px-3 py-1.5 border transition-all",
							loading || !body.trim()
								? "text-muted-foreground/20 border-border/20 cursor-not-allowed"
								: "text-amber-400 border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500/50",
						)}
					>
						{loading ? "sending..." : "send ↵"}
					</button>
				</div>
			</div>
		</div>
	);
}

// Sub-item card component
function SubItemCard({
	item,
	onClick,
	isSelected,
}: {
	item: SubtaskReference;
	onClick: () => void;
	isSelected: boolean;
}) {
	const state = stateConfig[item.state] || stateConfig.open;
	const priority = priorityConfig[item.priority] || priorityConfig[3];

	return (
		<button
			onClick={onClick}
			className={cn(
				"w-full text-left p-4 border transition-all duration-200 group",
				"bg-secondary/30 hover:bg-secondary/50",
				isSelected
					? "border-amber-500/50 bg-amber-500/[0.06] ring-1 ring-amber-500/20"
					: "border-border/40 hover:border-border/60",
			)}
		>
			<div className="flex items-center justify-between gap-3 mb-2">
				<div className="flex items-center gap-2">
					<span
						className={cn(
							"text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5",
							state.bg,
							state.text,
						)}
					>
						{state.label}
					</span>
					<span className={cn("font-mono text-[9px]", priority.color)} title={priority.label}>
						{priority.marker}
					</span>
				</div>
				<span className="text-[9px] font-mono text-muted-foreground/40">{item.id}</span>
			</div>
			<p
				className={cn(
					"text-[13px] font-mono leading-relaxed",
					"text-foreground/80 group-hover:text-foreground",
					item.state === "cancelled" && "line-through",
				)}
			>
				{item.title}
			</p>
		</button>
	);
}

// Section header component
function SectionHeader({
	title,
	count,
	action,
	onAction,
	actionKey,
}: {
	title: string;
	count?: number;
	action?: string;
	onAction?: () => void;
	actionKey?: string;
}) {
	return (
		<div className="flex items-center justify-between mb-4 pb-2 border-b border-border/20">
			<div className="flex items-center gap-3">
				<span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
					{title}
				</span>
				{count !== undefined && (
					<span className="text-[9px] font-mono text-muted-foreground/40 px-1.5 py-0.5 bg-secondary/60 border border-border/30">
						{count}
					</span>
				)}
			</div>
			{action && onAction && (
				<button
					onClick={onAction}
					className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50 hover:text-amber-400 transition-colors"
				>
					{actionKey && (
						<kbd className="px-1.5 py-0.5 bg-secondary/60 border border-border/30 text-muted-foreground/60">
							{actionKey}
						</kbd>
					)}
					<span>{action}</span>
				</button>
			)}
		</div>
	);
}

export function ContainerDetailView({
	workspaceId,
	containerId,
	taskRef,
}: ContainerDetailViewProps) {
	const { goToContainerView, goToContainerViewTask, goToGlobalDashboard, goToWorkspace } =
		useAppNavigation();

	// Data state
	const [task, setTask] = useState<TaskDetail | null>(null);
	const [taskLoading, setTaskLoading] = useState(true);
	const [taskError, setTaskError] = useState<ApiClientError | null>(null);

	const [comments, setComments] = useState<TaskComment[]>([]);
	const [commentsLoading, setCommentsLoading] = useState(true);
	const [commentsError, setCommentsError] = useState<ApiClientError | null>(null);

	const [siblings, setSiblings] = useState<ProjectTaskListItem[]>([]);
	const [siblingsLoading, setSiblingsLoading] = useState(true);

	// UI state
	const [isEditingDescription, setIsEditingDescription] = useState(false);
	const [descriptionDraft, setDescriptionDraft] = useState("");
	const [updating, setUpdating] = useState(false);
	const [updateError, setUpdateError] = useState<ApiClientError | null>(null);
	const [selectedSubItemIndex, _setSelectedSubItemIndex] = useState(-1);
	const [isCreateSubItemModalOpen, setIsCreateSubItemModalOpen] = useState(false);

	// Refs
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
	const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
	const taskDataRef = useRef<TaskDetail | null>(null);

	// Keep taskDataRef in sync for webhook handler
	useEffect(() => {
		taskDataRef.current = task;
	}, [task]);

	// Webhook handler for real-time updates
	const handleWebhookUpdate = useCallback(
		(payload: WebhookTaskPayload) => {
			const currentTask = taskDataRef.current;
			if (!currentTask) return;

			// Only handle updates for the current task
			if (payload.ticket_id !== currentTask.id && payload.ticket_uuid !== currentTask.uuid) {
				return;
			}

			console.info("[ContainerDetailView] webhook: updating task", {
				ticketId: payload.ticket_id,
				state: payload.state,
			});

			// Update task in-place with webhook payload fields
			setTask((prev) => {
				if (!prev) return prev;
				return {
					...prev,
					state: payload.state ?? prev.state,
					priority: payload.priority ?? prev.priority,
					kind: payload.kind ?? prev.kind,
					run_status: payload.run_status !== undefined ? payload.run_status : prev.run_status,
					resolution: payload.resolution !== undefined ? payload.resolution : prev.resolution,
					meta: payload.meta !== undefined ? payload.meta : prev.meta,
					cp_project_id:
						payload.cp_project_id !== undefined ? payload.cp_project_id : prev.cp_project_id,
					cp_run_id: payload.cp_run_id !== undefined ? payload.cp_run_id : prev.cp_run_id,
					cp_session_id:
						payload.cp_session_id !== undefined ? payload.cp_session_id : prev.cp_session_id,
					sdk_session_id:
						payload.sdk_session_id !== undefined ? payload.sdk_session_id : prev.sdk_session_id,
					etag: payload.etag ?? prev.etag,
				};
			});

			// Also refresh comments - webhook might indicate a new comment was added
			// The webhook payload doesn't include comment details, so we do a full refresh
			// Use the actual task ID from the ref for API calls
			const actualTaskId = currentTask.id;
			fetchTaskComments(workspaceId, actualTaskId)
				.then((data) => {
					setComments(data.comments);
				})
				.catch((err) => {
					console.warn("[ContainerDetailView] webhook: failed to refresh comments", err);
				});
		},
		[workspaceId],
	);

	// Subscribe to webhook updates
	useTaskWebhook({
		onTaskUpdate: handleWebhookUpdate,
	});

	// Fetch task detail (API accepts both task ID and slug)
	const fetchTask = useCallback(() => {
		const controller = new AbortController();
		setTaskLoading(true);
		setTaskError(null);

		fetchTaskDetail(workspaceId, taskRef, controller.signal)
			.then((data) => {
				setTask(data);
				setTaskLoading(false);
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setTaskError(err as ApiClientError);
				setTaskLoading(false);
			});

		return () => controller.abort();
	}, [workspaceId, taskRef]);

	// Fetch comments (showLoading=false for refreshes to avoid scroll reset)
	// Note: Uses taskRef which works for both ID and slug
	const fetchComments = useCallback(
		(showLoading = true) => {
			const controller = new AbortController();
			if (showLoading) {
				setCommentsLoading(true);
			}
			setCommentsError(null);

			fetchTaskComments(workspaceId, taskRef, controller.signal)
				.then((data) => {
					setComments(data.comments);
					setCommentsLoading(false);
				})
				.catch((err) => {
					if ((err as Error).name === "AbortError") return;
					setCommentsError(err as ApiClientError);
					setCommentsLoading(false);
				});

			return () => controller.abort();
		},
		[workspaceId, taskRef],
	);

	// Refresh comments without loading state (used after adding a comment)
	const refreshComments = useCallback(() => {
		fetchComments(false);
	}, [fetchComments]);

	// Fetch sibling tasks for navigation
	useEffect(() => {
		const controller = new AbortController();
		setSiblingsLoading(true);

		fetchWorkspaceTasks(
			workspaceId,
			{ filter: "idea,draft,open,in_progress,blocked", sort: "priority", limit: 200 },
			controller.signal,
		)
			.then((resp) => {
				// Filter to container path
				const filteredTasks = resp.tasks.filter((t) => {
					const taskPath = t.project?.path || "";
					return taskPath === containerId || taskPath.startsWith(`${containerId}/`);
				});

				// Sort by state, then priority
				const sorted = [...filteredTasks].sort((a, b) => {
					const aOrder = STATE_SORT_ORDER[a.state] ?? 99;
					const bOrder = STATE_SORT_ORDER[b.state] ?? 99;
					if (aOrder !== bOrder) return aOrder - bOrder;
					return a.priority - b.priority;
				});

				setSiblings(sorted);
				setSiblingsLoading(false);
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setSiblingsLoading(false);
			});

		return () => controller.abort();
	}, [workspaceId, containerId]);

	// Initial data fetch
	useEffect(() => {
		const cleanupTask = fetchTask();
		const cleanupComments = fetchComments();
		return () => {
			cleanupTask();
			cleanupComments();
		};
	}, [fetchTask, fetchComments]);

	// Current task index in siblings (compare against both ID and slug)
	const currentIndex = useMemo(() => {
		return siblings.findIndex((s) => s.id === taskRef || s.slug === taskRef);
	}, [siblings, taskRef]);

	const hasPrevSibling = currentIndex > 0;
	const hasNextSibling = currentIndex < siblings.length - 1;
	const prevSibling = hasPrevSibling ? siblings[currentIndex - 1] : null;
	const nextSibling = hasNextSibling ? siblings[currentIndex + 1] : null;

	// Navigation handlers (prefer slug for cleaner URLs)
	const goToPrevSibling = useCallback(() => {
		if (prevSibling) {
			goToContainerViewTask(workspaceId, containerId, prevSibling.slug);
		}
	}, [prevSibling, workspaceId, containerId, goToContainerViewTask]);

	const goToNextSibling = useCallback(() => {
		if (nextSibling) {
			goToContainerViewTask(workspaceId, containerId, nextSibling.slug);
		}
	}, [nextSibling, workspaceId, containerId, goToContainerViewTask]);

	const goBack = useCallback(() => {
		goToContainerView(workspaceId, containerId);
	}, [workspaceId, containerId, goToContainerView]);

	// Description editing
	const startEditingDescription = useCallback(() => {
		setDescriptionDraft(task?.description || "");
		setIsEditingDescription(true);
		setTimeout(() => descriptionTextareaRef.current?.focus(), 50);
	}, [task?.description]);

	const saveDescription = useCallback(async () => {
		if (!task || updating) return;
		setUpdating(true);
		setUpdateError(null);
		try {
			await updateTask(workspaceId, task.id, { description: descriptionDraft }, task.etag);
			setIsEditingDescription(false);
			fetchTask();
		} catch (err) {
			setUpdateError(err as ApiClientError);
		} finally {
			setUpdating(false);
		}
	}, [task, workspaceId, descriptionDraft, updating, fetchTask]);

	const cancelEditDescription = useCallback(() => {
		setIsEditingDescription(false);
		setDescriptionDraft("");
	}, []);

	// Focus comment composer
	const focusCommentComposer = useCallback(() => {
		commentTextareaRef.current?.focus();
		commentTextareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
	}, []);

	// Keyboard navigation
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

			// Allow Escape to exit edit mode or go back
			if (e.key === "Escape") {
				e.preventDefault();
				if (isEditingDescription) {
					cancelEditDescription();
				} else if (isInput) {
					(target as HTMLInputElement | HTMLTextAreaElement).blur();
				} else {
					goBack();
				}
				return;
			}

			// Don't handle other keys if in input
			if (isInput) return;

			switch (e.key) {
				case "h":
				case "ArrowLeft":
					e.preventDefault();
					goToPrevSibling();
					break;
				case "l":
				case "ArrowRight":
					e.preventDefault();
					goToNextSibling();
					break;
				case "j":
				case "ArrowDown":
					e.preventDefault();
					scrollContainerRef.current?.scrollBy({ top: 100, behavior: "smooth" });
					break;
				case "k":
				case "ArrowUp":
					e.preventDefault();
					scrollContainerRef.current?.scrollBy({ top: -100, behavior: "smooth" });
					break;
				case "c":
					e.preventDefault();
					focusCommentComposer();
					break;
				case "e":
					e.preventDefault();
					if (!isEditingDescription) {
						startEditingDescription();
					}
					break;
				case "Enter":
					e.preventDefault();
					if (task?.subtasks && task.subtasks.length > 0 && selectedSubItemIndex >= 0) {
						const subItem = task.subtasks[selectedSubItemIndex];
						if (subItem) {
							// Prefer slug for cleaner URLs, fall back to ID
							goToContainerViewTask(workspaceId, containerId, subItem.slug || subItem.id);
						}
					}
					break;
				case "n":
					e.preventDefault();
					if (task) {
						setIsCreateSubItemModalOpen(true);
					}
					break;
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [
		goBack,
		goToPrevSibling,
		goToNextSibling,
		focusCommentComposer,
		startEditingDescription,
		isEditingDescription,
		cancelEditDescription,
		task?.subtasks,
		selectedSubItemIndex,
		workspaceId,
		containerId,
		goToContainerViewTask,
		task,
	]);

	// Derived values
	const state = task ? stateConfig[task.state] || stateConfig.open : stateConfig.open;
	const priority = task ? priorityConfig[task.priority] || priorityConfig[3] : priorityConfig[3];
	const hasSubtasks = task?.subtasks && task.subtasks.length > 0;
	const descriptionIsEmpty = !task?.description?.trim();

	return (
		<div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
			{/* Atmospheric background - more dramatic for detail view */}
			<div className="fixed inset-0 pointer-events-none">
				<div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-transparent to-transparent" />
				<div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary/[0.04] blur-[120px] rounded-full" />
				{/* Secondary ambient glow based on task state */}
				{task && (
					<div
						className={cn(
							"absolute top-20 right-0 w-[400px] h-[300px] blur-[100px] rounded-full opacity-30",
							task.state === "in_progress" && "bg-amber-500/20",
							task.state === "blocked" && "bg-rose-500/20",
							task.state === "open" && "bg-emerald-500/20",
							task.state === "idea" && "bg-cyan-500/20",
							task.state === "draft" && "bg-fuchsia-500/20",
						)}
					/>
				)}
			</div>

			{/* Header - Sticky */}
			<header className="relative z-10 flex-shrink-0 border-b border-border/30 bg-background/80 backdrop-blur-sm">
				<div className="max-w-4xl mx-auto px-6 py-4">
					{/* Breadcrumb */}
					<div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50 mb-3">
						<button onClick={goToGlobalDashboard} className="hover:text-primary transition-colors">
							wrkq
						</button>
						<span className="text-muted-foreground/30">/</span>
						<button
							onClick={() => goToWorkspace(workspaceId)}
							className="hover:text-primary transition-colors"
						>
							{workspaceId}
						</button>
						<span className="text-muted-foreground/30">/</span>
						<button onClick={goBack} className="hover:text-primary transition-colors">
							{containerId}
						</button>
						<span className="text-muted-foreground/30">/</span>
						<span className="text-foreground/70">{task?.slug || taskRef}</span>
					</div>

					{/* Title row with sibling navigation */}
					<div className="flex items-start justify-between gap-6">
						<div className="flex items-start gap-4 flex-1 min-w-0">
							{/* Back button */}
							<button
								onClick={goBack}
								className="group flex-shrink-0 w-10 h-10 border border-border/50 flex items-center justify-center bg-secondary/30 hover:bg-secondary/60 hover:border-primary/40 transition-all mt-1"
							>
								<svg
									width="16"
									height="16"
									viewBox="0 0 16 16"
									fill="none"
									className="text-muted-foreground group-hover:text-primary transition-colors"
								>
									<path
										d="M10 12L6 8L10 4"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							</button>

							{/* Task info */}
							<div className="flex-1 min-w-0">
								{taskLoading ? (
									<div className="space-y-2">
										<div className="h-6 w-48 bg-secondary/50 animate-pulse" />
										<div className="h-4 w-32 bg-secondary/30 animate-pulse" />
									</div>
								) : task ? (
									<>
										<div className="flex items-center gap-3 mb-2">
											{/* State badge */}
											<span
												className={cn(
													"text-[10px] font-mono font-medium uppercase tracking-[0.15em] px-2.5 py-1",
													state.bg,
													state.text,
													state.border,
													"border",
												)}
											>
												{state.label}
											</span>
											{/* Priority */}
											<span
												className={cn("font-mono text-[11px]", priority.color)}
												title={priority.label}
											>
												{priority.marker}
											</span>
											{/* Task ID */}
											<span className="text-[10px] font-mono text-muted-foreground/50">
												{task.id}
											</span>
										</div>
										<h1 className="text-xl font-mono font-medium tracking-tight text-foreground/95 leading-snug">
											{task.title}
										</h1>
									</>
								) : (
									<p className="text-muted-foreground/60 font-mono text-sm">Task not found</p>
								)}
							</div>
						</div>

						{/* Sibling navigation */}
						{!siblingsLoading && siblings.length > 1 && (
							<div className="flex items-center gap-2 flex-shrink-0">
								<button
									onClick={goToPrevSibling}
									disabled={!hasPrevSibling}
									className={cn(
										"w-8 h-8 border flex items-center justify-center transition-all",
										hasPrevSibling
											? "border-border/50 bg-secondary/30 hover:bg-secondary/60 hover:border-primary/40 text-muted-foreground hover:text-primary"
											: "border-border/20 bg-secondary/10 text-muted-foreground/20 cursor-not-allowed",
									)}
									title={prevSibling ? `Previous: ${prevSibling.title}` : "No previous task"}
								>
									<svg width="12" height="12" viewBox="0 0 16 16" fill="none">
										<path
											d="M10 12L6 8L10 4"
											stroke="currentColor"
											strokeWidth="1.5"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								</button>

								<div className="text-[10px] font-mono text-muted-foreground/50 px-2">
									{currentIndex + 1}/{siblings.length}
								</div>

								<button
									onClick={goToNextSibling}
									disabled={!hasNextSibling}
									className={cn(
										"w-8 h-8 border flex items-center justify-center transition-all",
										hasNextSibling
											? "border-border/50 bg-secondary/30 hover:bg-secondary/60 hover:border-primary/40 text-muted-foreground hover:text-primary"
											: "border-border/20 bg-secondary/10 text-muted-foreground/20 cursor-not-allowed",
									)}
									title={nextSibling ? `Next: ${nextSibling.title}` : "No next task"}
								>
									<svg width="12" height="12" viewBox="0 0 16 16" fill="none">
										<path
											d="M6 4L10 8L6 12"
											stroke="currentColor"
											strokeWidth="1.5"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								</button>
							</div>
						)}
					</div>
				</div>
			</header>

			{/* Main content - Scrollable */}
			<main ref={scrollContainerRef} className="relative z-10 flex-1 overflow-y-auto">
				<div className="max-w-4xl mx-auto px-6 py-8">
					{taskError ? (
						<ErrorBanner
							title="Failed to load task"
							message={taskError.message}
							detail={typeof taskError.details === "string" ? taskError.details : undefined}
							onRetry={fetchTask}
						/>
					) : taskLoading ? (
						<div className="space-y-8">
							<div className="h-32 bg-secondary/30 animate-pulse" />
							<div className="h-48 bg-secondary/20 animate-pulse" />
						</div>
					) : task ? (
						<div className="space-y-10">
							{/* Update error */}
							{updateError && (
								<ErrorBanner
									title="Failed to update"
									message={updateError.message}
									detail={typeof updateError.details === "string" ? updateError.details : undefined}
									onRetry={() => setUpdateError(null)}
								/>
							)}

							{/* Description Section */}
							<section>
								<SectionHeader
									title="Description"
									action={isEditingDescription ? undefined : "edit"}
									onAction={isEditingDescription ? undefined : startEditingDescription}
									actionKey="e"
								/>

								{isEditingDescription ? (
									<div className="space-y-3">
										<textarea
											ref={descriptionTextareaRef}
											value={descriptionDraft}
											onChange={(e) => setDescriptionDraft(e.target.value)}
											className={cn(
												"w-full resize-y bg-secondary/40 border border-amber-500/30 p-4",
												"text-[13px] font-mono leading-relaxed",
												"focus:outline-none focus:border-amber-500/50",
												"min-h-[200px]",
											)}
											placeholder="# Task description (markdown supported)"
											disabled={updating}
										/>
										<div className="flex justify-end gap-3">
											<button
												onClick={cancelEditDescription}
												disabled={updating}
												className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
											>
												cancel
											</button>
											<button
												onClick={saveDescription}
												disabled={updating}
												className="text-[10px] font-mono uppercase tracking-wider text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-500/50 px-4 py-1.5 transition-all"
											>
												{updating ? "saving..." : "save"}
											</button>
										</div>
									</div>
								) : descriptionIsEmpty ? (
									<button
										onClick={startEditingDescription}
										className={cn(
											"w-full border border-dashed border-border/40 bg-secondary/20",
											"px-6 py-10 text-center",
											"text-[12px] font-mono text-muted-foreground/40",
											"hover:border-amber-500/30 hover:text-muted-foreground/60 hover:bg-secondary/30",
											"transition-all cursor-pointer",
										)}
									>
										<span className="text-amber-400/50">›</span> click to add description
									</button>
								) : (
									<div className={cn("border border-border/30 bg-secondary/20 p-6", state.glow)}>
										<MarkdownContent content={task.description} />
									</div>
								)}
							</section>

							{/* Comments Section */}
							<section>
								<SectionHeader
									title="Comments"
									count={comments.length}
									action="add"
									onAction={focusCommentComposer}
									actionKey="c"
								/>

								<div className="space-y-6">
									<CommentsTimeline
										comments={comments}
										loading={commentsLoading}
										error={commentsError}
										onRetry={fetchComments}
									/>

									<CommentComposer
										taskId={task.id}
										workspaceId={workspaceId}
										onCommentAdded={refreshComments}
										textareaRef={commentTextareaRef}
									/>
								</div>
							</section>

							{/* Sub-items Section */}
							<section>
								<SectionHeader
									title="Sub-items"
									count={task.subtasks?.length || 0}
									action="add"
									onAction={() => setIsCreateSubItemModalOpen(true)}
									actionKey="n"
								/>

								{hasSubtasks ? (
									<div className="grid gap-3 sm:grid-cols-2">
										{task.subtasks.map((item, idx) => (
											<SubItemCard
												key={item.id}
												item={item}
												onClick={() =>
													goToContainerViewTask(workspaceId, containerId, item.slug || item.id)
												}
												isSelected={selectedSubItemIndex === idx}
											/>
										))}
									</div>
								) : (
									<div className="border border-dashed border-border/30 bg-secondary/10 px-6 py-8 text-center">
										<p className="text-[11px] font-mono text-muted-foreground/40">
											No sub-items yet
										</p>
										<p className="text-[10px] font-mono text-muted-foreground/30 mt-1">
											Press{" "}
											<kbd className="px-1 py-0.5 bg-secondary/60 border border-border/30">n</kbd>{" "}
											to create one
										</p>
									</div>
								)}
							</section>

							{/* Related Section (Future) */}
							<section>
								<SectionHeader title="Related" />

								<div className="border border-dashed border-border/20 bg-secondary/5 px-6 py-6 text-center">
									<p className="text-[10px] font-mono text-muted-foreground/30 uppercase tracking-wider">
										coming soon
									</p>
									<p className="text-[9px] font-mono text-muted-foreground/20 mt-1">
										Link related tasks, blockers, and dependencies
									</p>
								</div>
							</section>

							{/* Metadata footer */}
							<section className="border-t border-border/20 pt-6">
								<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[10px] font-mono">
									<div>
										<span className="text-muted-foreground/40 uppercase tracking-wider block mb-1">
											Created
										</span>
										<span className="text-muted-foreground/70">{task.created_by.slug}</span>
										<span className="text-muted-foreground/40 block">
											{formatDateTime(task.created_at)}
										</span>
									</div>
									<div>
										<span className="text-muted-foreground/40 uppercase tracking-wider block mb-1">
											Updated
										</span>
										<span className="text-muted-foreground/70">{task.updated_by.slug}</span>
										<span className="text-muted-foreground/40 block">
											{formatDateTime(task.updated_at)}
										</span>
									</div>
									<div>
										<span className="text-muted-foreground/40 uppercase tracking-wider block mb-1">
											Labels
										</span>
										{task.labels.length > 0 ? (
											<div className="flex flex-wrap gap-1">
												{task.labels.map((label) => (
													<span
														key={label}
														className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary/70 border border-primary/20"
													>
														{label}
													</span>
												))}
											</div>
										) : (
											<span className="text-muted-foreground/30">—</span>
										)}
									</div>
									<div>
										<span className="text-muted-foreground/40 uppercase tracking-wider block mb-1">
											Version
										</span>
										<span className="text-muted-foreground/50">v{task.etag}</span>
									</div>
								</div>
							</section>
						</div>
					) : (
						<div className="flex flex-col items-center justify-center py-20">
							<div className="w-16 h-16 border border-border/40 bg-secondary/30 flex items-center justify-center mb-4">
								<span className="text-2xl text-muted-foreground/30">?</span>
							</div>
							<p className="text-[13px] font-mono text-foreground/70">Task not found</p>
							<button
								onClick={goBack}
								className="mt-4 text-[11px] font-mono text-primary hover:underline"
							>
								← back to container
							</button>
						</div>
					)}
				</div>

				{/* Bottom padding */}
				<div className="h-24" />
			</main>

			{/* Footer - Keyboard hints */}
			<footer className="relative z-10 flex-shrink-0 border-t border-border/20 bg-secondary/30 backdrop-blur-sm">
				<div className="max-w-4xl mx-auto px-6 py-2.5 flex items-center justify-between">
					<div className="flex items-center gap-4 text-[9px] font-mono text-muted-foreground/40">
						<span className="text-amber-400/60 uppercase tracking-[0.2em]">nav</span>
						<div className="flex items-center gap-2">
							<kbd className="px-1.5 py-0.5 bg-secondary/60 border border-border/30">h/l</kbd>
							<span>sibling</span>
						</div>
						<div className="flex items-center gap-2">
							<kbd className="px-1.5 py-0.5 bg-secondary/60 border border-border/30">j/k</kbd>
							<span>scroll</span>
						</div>
						<div className="flex items-center gap-2">
							<kbd className="px-1.5 py-0.5 bg-secondary/60 border border-border/30">c</kbd>
							<span>comment</span>
						</div>
						<div className="flex items-center gap-2">
							<kbd className="px-1.5 py-0.5 bg-secondary/60 border border-border/30">e</kbd>
							<span>edit</span>
						</div>
						<div className="flex items-center gap-2">
							<kbd className="px-1.5 py-0.5 bg-secondary/60 border border-border/30">esc</kbd>
							<span>back</span>
						</div>
					</div>
					<div className="text-[9px] font-mono text-muted-foreground/30 uppercase tracking-[0.15em]">
						task detail • t-00524
					</div>
				</div>
			</footer>

			{/* Create Sub-Item Modal */}
			{task && (
				<CreateSubItemModal
					isOpen={isCreateSubItemModalOpen}
					onClose={() => setIsCreateSubItemModalOpen(false)}
					onSuccess={() => {
						// Refresh task data to show the new sub-item
						fetchTask();
					}}
					workspaceId={workspaceId}
					containerId={containerId}
					parentTaskUuid={task.uuid}
				/>
			)}
		</div>
	);
}
