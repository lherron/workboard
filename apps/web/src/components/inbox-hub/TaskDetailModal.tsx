import { createComment, createTask, fetchTaskComments } from "@/api/client";
import { MarkdownContent } from "@/components/MarkdownContent";
import { RunStatusBadge } from "@/components/RunStatusBadge";
import { SessionStreamPanel } from "@/components/SessionStreamPanel";
import { TerminalButtons, type TerminalButtonsHandle } from "@/components/TerminalButtons";
import { useAppNavigation } from "@/hooks/useNavigation";
import { formatDateTime, formatDateTimeFull } from "@/lib/datetime";
import { getSessionLaunch, getShortcutForScope, matchesShortcut } from "@/lib/sessionLaunches";
import { cn } from "@/lib/utils";
import type { TaskComment, TaskDetail, UpdateTaskRequest } from "@webwrkq/shared";
import { useCallback, useEffect, useRef, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Task ID Badge - prominent, copyable identifier with warm accent
function TaskIdBadge({ taskId }: { taskId: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(taskId);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			const textArea = document.createElement("textarea");
			textArea.value = taskId;
			document.body.appendChild(textArea);
			textArea.select();
			document.execCommand("copy");
			document.body.removeChild(textArea);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	return (
		<button
			onClick={handleCopy}
			className={cn(
				"group relative flex items-center gap-2 px-3 py-1.5 rounded",
				"bg-amber-500/8 border border-amber-500/25",
				"transition-all duration-200 ease-out",
				"hover:bg-amber-500/12 hover:border-amber-400/40",
				copied && "bg-emerald-500/10 border-emerald-400/40",
			)}
		>
			<svg
				width="13"
				height="13"
				viewBox="0 0 14 14"
				fill="none"
				className={cn(
					"transition-colors duration-200",
					copied ? "text-emerald-400" : "text-amber-400/70 group-hover:text-amber-300",
				)}
			>
				<rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
				<path
					d="M5 7l1.5 1.5L9 5.5"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
			<span
				className={cn(
					"font-mono text-[12px] font-semibold tracking-wide",
					"transition-colors duration-200",
					copied ? "text-emerald-300" : "text-amber-200/80 group-hover:text-amber-100",
				)}
			>
				{taskId}
			</span>
			<span
				className={cn(
					"text-[9px] uppercase tracking-wider transition-all duration-200",
					copied ? "text-emerald-400" : "text-amber-500/40 group-hover:text-amber-400/60",
				)}
			>
				{copied ? "copied" : "copy"}
			</span>
		</button>
	);
}

// Copyable ID Field - compact copy-on-hover for metadata values
function CopyableIdField({ value, label }: { value: string | null | undefined; label: string }) {
	const [copied, setCopied] = useState(false);
	const timeoutRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
		};
	}, []);

	if (!value) {
		return <span className="font-mono text-right text-[9px] text-zinc-600">—</span>;
	}

	const handleCopy = async () => {
		const setCopiedForMoment = () => {
			setCopied(true);
			if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
			timeoutRef.current = window.setTimeout(() => setCopied(false), 1500);
		};

		try {
			await navigator.clipboard.writeText(value);
			setCopiedForMoment();
		} catch {
			const textArea = document.createElement("textarea");
			textArea.value = value;
			document.body.appendChild(textArea);
			textArea.select();
			document.execCommand("copy");
			document.body.removeChild(textArea);
			setCopiedForMoment();
		}
	};

	return (
		<button
			type="button"
			onClick={handleCopy}
			className={cn(
				"group/copyid flex items-center gap-1 font-mono text-right text-[9px] transition-all duration-150",
				"hover:text-zinc-200",
				copied ? "text-emerald-400" : "text-zinc-400",
			)}
			title={copied ? "Copied!" : `Copy ${label}`}
		>
			<span className="break-all max-w-[100px] truncate">{value}</span>
			{copied && (
				<svg
					width="9"
					height="9"
					viewBox="0 0 10 10"
					fill="none"
					className="text-emerald-400 flex-shrink-0"
				>
					<path
						d="M2 5l2 2 4-4"
						stroke="currentColor"
						strokeWidth="1.4"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			)}
		</button>
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

type TaskDetailModalProps = {
	workspaceId: string;
	workspaceName: string;
	containerId: string;
	containerTitle: string;
	task: TaskDetail | null;
	loading: boolean;
	onClose: () => void;
	onTaskUpdate: (
		workspaceId: string,
		taskId: string,
		updates: UpdateTaskRequest,
		etag: number,
	) => Promise<TaskDetail>;
	onTaskComplete: () => void;
};

const stateConfig: Record<
	string,
	{ label: string; bg: string; text: string; border: string; dot: string }
> = {
	idea: {
		label: "Idea",
		bg: "bg-cyan-500/15",
		text: "text-cyan-300",
		border: "border-cyan-500/30",
		dot: "bg-cyan-400",
	},
	draft: {
		label: "Draft",
		bg: "bg-fuchsia-500/15",
		text: "text-fuchsia-300",
		border: "border-fuchsia-500/30",
		dot: "bg-fuchsia-400",
	},
	open: {
		label: "Open",
		bg: "bg-emerald-500/15",
		text: "text-emerald-300",
		border: "border-emerald-500/30",
		dot: "bg-emerald-400",
	},
	in_progress: {
		label: "In Progress",
		bg: "bg-sky-500/15",
		text: "text-sky-300",
		border: "border-sky-500/30",
		dot: "bg-sky-400",
	},
	completed: {
		label: "Completed",
		bg: "bg-emerald-500/15",
		text: "text-emerald-300",
		border: "border-emerald-500/30",
		dot: "bg-emerald-400",
	},
	blocked: {
		label: "Blocked",
		bg: "bg-amber-500/15",
		text: "text-amber-300",
		border: "border-amber-500/30",
		dot: "bg-amber-400",
	},
	cancelled: {
		label: "Cancelled",
		bg: "bg-rose-500/15",
		text: "text-rose-300",
		border: "border-rose-500/30",
		dot: "bg-rose-400",
	},
	archived: {
		label: "Archived",
		bg: "bg-zinc-600/15",
		text: "text-zinc-400",
		border: "border-zinc-600/30",
		dot: "bg-zinc-500",
	},
};

const allStates = [
	"idea",
	"draft",
	"open",
	"in_progress",
	"completed",
	"blocked",
	"cancelled",
] as const;

const priorityConfig: Record<number, { label: string; short: string; color: string; bg: string }> =
	{
		1: { label: "Critical", short: "P1", color: "text-red-400", bg: "bg-red-500/15" },
		2: { label: "High", short: "P2", color: "text-amber-400", bg: "bg-amber-500/15" },
		3: { label: "Medium", short: "P3", color: "text-sky-400", bg: "bg-sky-500/15" },
		4: { label: "Low", short: "P4", color: "text-zinc-400", bg: "bg-zinc-500/15" },
	};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function TaskDetailModal({
	workspaceId,
	workspaceName,
	containerId,
	containerTitle,
	task,
	loading,
	onClose,
	onTaskUpdate,
	onTaskComplete,
}: TaskDetailModalProps) {
	const { goToPromptShaping } = useAppNavigation();
	const terminalButtonsRef = useRef<TerminalButtonsHandle>(null);
	const [comments, setComments] = useState<TaskComment[]>([]);
	const [commentsLoading, setCommentsLoading] = useState(false);
	const [newComment, setNewComment] = useState("");
	const [submittingComment, setSubmittingComment] = useState(false);
	const [editingTitle, setEditingTitle] = useState(false);
	const [editingDescription, setEditingDescription] = useState(false);
	const [titleValue, setTitleValue] = useState("");
	const [descriptionValue, setDescriptionValue] = useState("");
	const [showStateMenu, setShowStateMenu] = useState(false);
	const [updatingState, setUpdatingState] = useState(false);
	const [showPriorityMenu, setShowPriorityMenu] = useState(false);
	const [updatingPriority, setUpdatingPriority] = useState(false);
	const [showLabelInput, setShowLabelInput] = useState(false);
	const [newLabelValue, setNewLabelValue] = useState("");
	const [updatingLabels, setUpdatingLabels] = useState(false);
	const [showSubtaskInput, setShowSubtaskInput] = useState(false);
	const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
	const [creatingSubtask, setCreatingSubtask] = useState(false);
	const [toastError, setToastError] = useState<string | null>(null);
	const [toastNotice, setToastNotice] = useState<string | null>(null);
	const [showSessionStream, setShowSessionStream] = useState(false);

	// ─────────────────────────────────────────────────────────────────────────
	// DATA FETCHING & SYNC
	// ─────────────────────────────────────────────────────────────────────────

	const refreshComments = useCallback(async () => {
		if (!task) return;
		setCommentsLoading(true);
		try {
			const resp = await fetchTaskComments(workspaceId, task.id);
			setComments(resp.comments);
		} catch (err) {
			if ((err as Error).name === "AbortError") return;
		} finally {
			setCommentsLoading(false);
		}
	}, [task, workspaceId]);

	useEffect(() => {
		if (!task) return;
		const controller = new AbortController();
		setCommentsLoading(true);
		fetchTaskComments(workspaceId, task.id, controller.signal)
			.then((resp) => {
				setComments(resp.comments);
				setCommentsLoading(false);
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setCommentsLoading(false);
			});
		return () => controller.abort();
	}, [workspaceId, task]);

	useEffect(() => {
		if (task) {
			setTitleValue(task.title);
			setDescriptionValue(task.description || "");
		}
	}, [task]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: task?.id triggers session stream reset
	useEffect(() => {
		setShowSessionStream(false);
	}, [task?.id]);

	// ─────────────────────────────────────────────────────────────────────────
	// HANDLERS
	// ─────────────────────────────────────────────────────────────────────────

	const handleTitleSave = useCallback(async () => {
		if (!task || titleValue === task.title) {
			setEditingTitle(false);
			return;
		}
		try {
			await onTaskUpdate(workspaceId, task.id, { title: titleValue }, task.etag);
			setEditingTitle(false);
		} catch {
			setTitleValue(task.title);
			setEditingTitle(false);
		}
	}, [task, titleValue, workspaceId, onTaskUpdate]);

	const handleDescriptionSave = useCallback(async () => {
		if (!task || descriptionValue === (task.description || "")) {
			setEditingDescription(false);
			return;
		}
		try {
			await onTaskUpdate(workspaceId, task.id, { description: descriptionValue }, task.etag);
			setEditingDescription(false);
		} catch {
			setDescriptionValue(task.description || "");
			setEditingDescription(false);
		}
	}, [task, descriptionValue, workspaceId, onTaskUpdate]);

	const handleSaveAndClose = useCallback(async () => {
		if (editingTitle && task && titleValue !== task.title) {
			try {
				await onTaskUpdate(workspaceId, task.id, { title: titleValue }, task.etag);
			} catch {
				/* ignore */
			}
		}
		if (editingDescription && task && descriptionValue !== (task.description || "")) {
			try {
				await onTaskUpdate(workspaceId, task.id, { description: descriptionValue }, task.etag);
			} catch {
				/* ignore */
			}
		}
		onClose();
	}, [
		task,
		editingTitle,
		editingDescription,
		titleValue,
		descriptionValue,
		workspaceId,
		onTaskUpdate,
		onClose,
	]);

	const handleStateChange = useCallback(
		async (newState: string) => {
			if (!task || task.state === newState) {
				setShowStateMenu(false);
				return;
			}
			setUpdatingState(true);
			setShowStateMenu(false);
			try {
				await onTaskUpdate(
					workspaceId,
					task.id,
					{ state: newState as UpdateTaskRequest["state"] },
					task.etag,
				);
			} catch (err) {
				console.error("Failed to update state:", err);
			}
			setUpdatingState(false);
		},
		[task, workspaceId, onTaskUpdate],
	);

	const handlePriorityChange = useCallback(
		async (newPriority: number) => {
			if (!task || task.priority === newPriority) {
				setShowPriorityMenu(false);
				return;
			}
			setUpdatingPriority(true);
			setShowPriorityMenu(false);
			try {
				await onTaskUpdate(
					workspaceId,
					task.id,
					{ priority: newPriority as 1 | 2 | 3 | 4 },
					task.etag,
				);
			} catch (err) {
				console.error("Failed to update priority:", err);
			}
			setUpdatingPriority(false);
		},
		[task, workspaceId, onTaskUpdate],
	);

	const handleAddLabel = useCallback(async () => {
		if (!task || !newLabelValue.trim()) {
			setShowLabelInput(false);
			setNewLabelValue("");
			return;
		}
		const labelToAdd = newLabelValue.trim();
		const currentLabels = task.labels || [];
		if (currentLabels.includes(labelToAdd)) {
			setShowLabelInput(false);
			setNewLabelValue("");
			return;
		}
		setUpdatingLabels(true);
		try {
			await onTaskUpdate(
				workspaceId,
				task.id,
				{ labels: [...currentLabels, labelToAdd] },
				task.etag,
			);
			setNewLabelValue("");
			setShowLabelInput(false);
		} catch (err) {
			console.error("Failed to add label:", err);
		}
		setUpdatingLabels(false);
	}, [task, newLabelValue, workspaceId, onTaskUpdate]);

	const handleRemoveLabel = useCallback(
		async (labelToRemove: string) => {
			if (!task) return;
			const currentLabels = task.labels || [];
			const newLabels = currentLabels.filter((l) => l !== labelToRemove);
			setUpdatingLabels(true);
			try {
				await onTaskUpdate(workspaceId, task.id, { labels: newLabels }, task.etag);
			} catch (err) {
				console.error("Failed to remove label:", err);
			}
			setUpdatingLabels(false);
		},
		[task, workspaceId, onTaskUpdate],
	);

	const handleCommentSubmit = useCallback(async () => {
		if (!task || !newComment.trim()) return;
		setSubmittingComment(true);
		try {
			const comment = await createComment(workspaceId, task.id, { body: newComment.trim() });
			setComments((prev) => [...prev, comment]);
			setNewComment("");
		} catch (err) {
			console.error("Failed to add comment:", err);
		}
		setSubmittingComment(false);
	}, [task, newComment, workspaceId]);

	const handleCreateSubtask = useCallback(async () => {
		if (!task || !newSubtaskTitle.trim()) {
			setShowSubtaskInput(false);
			setNewSubtaskTitle("");
			return;
		}
		setCreatingSubtask(true);
		try {
			await createTask(workspaceId, containerId, {
				title: newSubtaskTitle.trim(),
				parent_task_uuid: task.uuid,
			});
			setNewSubtaskTitle("");
			setShowSubtaskInput(false);
			await onTaskUpdate(workspaceId, task.id, {}, task.etag);
		} catch (err) {
			console.error("Failed to create subtask:", err);
		}
		setCreatingSubtask(false);
	}, [task, newSubtaskTitle, workspaceId, containerId, onTaskUpdate]);

	// ─────────────────────────────────────────────────────────────────────────
	// KEYBOARD SHORTCUTS
	// ─────────────────────────────────────────────────────────────────────────

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const implementShortcut = getShortcutForScope(
				getSessionLaunch("implement-clod"),
				"task-detail",
			);
			if (implementShortcut && matchesShortcut(e, implementShortcut)) {
				e.preventDefault();
				terminalButtonsRef.current?.openImplementTerminal();
				return;
			}
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				handleSaveAndClose();
				return;
			}
			if (e.key === "Escape") {
				if (
					editingTitle ||
					editingDescription ||
					showStateMenu ||
					showPriorityMenu ||
					showLabelInput ||
					showSubtaskInput
				) {
					setEditingTitle(false);
					setEditingDescription(false);
					setShowStateMenu(false);
					setShowPriorityMenu(false);
					setShowLabelInput(false);
					setShowSubtaskInput(false);
				} else {
					onClose();
				}
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [
		onClose,
		handleSaveAndClose,
		editingTitle,
		editingDescription,
		showStateMenu,
		showPriorityMenu,
		showLabelInput,
		showSubtaskInput,
	]);

	// ─────────────────────────────────────────────────────────────────────────
	// DERIVED STATE
	// ─────────────────────────────────────────────────────────────────────────

	const currentState = task ? stateConfig[task.state] || stateConfig.open : stateConfig.open;
	const currentPriority = task
		? priorityConfig[task.priority] || priorityConfig[3]
		: priorityConfig[3];
	const triagedAt =
		task && typeof task.meta === "object" && task.meta
			? (task.meta as Record<string, unknown>).triaged_at
			: null;
	const isTriaged = typeof triagedAt === "string" && triagedAt.length > 0;

	// ═══════════════════════════════════════════════════════════════════════════
	// RENDER
	// ═══════════════════════════════════════════════════════════════════════════

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4">
			{/* Backdrop */}
			<div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

			{/* Modal Container */}
			<div
				className={cn(
					"relative w-full h-full md:max-w-[72rem] md:max-h-[88vh]",
					"bg-[#0d0f12] border-0 md:border border-zinc-800/80 md:rounded-lg",
					"shadow-2xl shadow-black/50 overflow-hidden",
					"flex flex-col",
					"animate-fade-in",
				)}
			>
				{/* ═══════════════════════════════════════════════════════════════════
				    HEADER
				    ═══════════════════════════════════════════════════════════════════ */}
				<header className="flex-shrink-0 border-b border-zinc-800/60 bg-zinc-900/40">
					<div className="flex items-center justify-between px-4 py-3">
						{/* Left: Task ID + Breadcrumb */}
						<div className="flex items-center gap-4">
							{task && <TaskIdBadge taskId={task.id} />}
							<div className="hidden sm:flex items-center gap-1.5 text-[11px]">
								<span className="text-zinc-400">{workspaceName}</span>
								<span className="text-zinc-600">/</span>
								<span className="text-zinc-500">{containerTitle}</span>
							</div>
						</div>

						{/* Right: Toasts + Close */}
						<div className="flex items-center gap-3">
							{toastError && (
								<span className="text-[10px] text-rose-400 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">
									{toastError}
								</span>
							)}
							{toastNotice && (
								<span className="text-[10px] text-teal-400 bg-teal-500/10 px-2 py-1 rounded border border-teal-500/20">
									{toastNotice}
								</span>
							)}
							<button
								onClick={onClose}
								className="p-1.5 text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50 rounded transition-colors"
							>
								<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
									<path
										d="M3 3l8 8M11 3l-8 8"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
									/>
								</svg>
							</button>
						</div>
					</div>
				</header>

				{/* ═══════════════════════════════════════════════════════════════════
				    CONTENT AREA - THREE COLUMNS
				    ═══════════════════════════════════════════════════════════════════ */}
				{loading ? (
					<div className="flex-1 flex items-center justify-center">
						<div className="text-center">
							<div className="w-5 h-5 border-2 border-zinc-700 border-t-amber-500 rounded-full animate-spin mx-auto mb-3" />
							<p className="text-[11px] text-zinc-600">Loading task...</p>
						</div>
					</div>
				) : task ? (
					<div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
						{/* ═════════════════════════════════════════════════════════════
						    LEFT COLUMN: STATUS & METADATA
						    ═════════════════════════════════════════════════════════════ */}
						<aside className="hidden md:flex flex-col w-[200px] border-r border-zinc-800/50 bg-zinc-900/30 flex-shrink-0">
							<div className="flex-1 overflow-y-auto p-4 space-y-5">
								{/* State */}
								<div>
									<h4 className="text-[9px] uppercase tracking-[0.15em] text-zinc-500 mb-2 font-medium">
										State
									</h4>
									<div className="relative">
										<button
											onClick={() => setShowStateMenu(!showStateMenu)}
											disabled={updatingState}
											className={cn(
												"w-full flex items-center gap-2 px-2.5 py-1.5 rounded border text-[11px] font-medium transition-all",
												currentState.bg,
												currentState.text,
												currentState.border,
												"hover:brightness-110",
												updatingState && "opacity-50",
											)}
										>
											<span className={cn("w-1.5 h-1.5 rounded-full", currentState.dot)} />
											{updatingState ? (
												<div className="w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin" />
											) : (
												<span className="flex-1 text-left">{currentState.label}</span>
											)}
											<svg
												width="10"
												height="10"
												viewBox="0 0 10 10"
												fill="none"
												className="opacity-50"
											>
												<path
													d="M2.5 4l2.5 2.5L7.5 4"
													stroke="currentColor"
													strokeWidth="1.2"
													strokeLinecap="round"
												/>
											</svg>
										</button>
										{showStateMenu && (
											<>
												<div
													className="fixed inset-0 z-10"
													onClick={() => setShowStateMenu(false)}
												/>
												<div className="absolute left-0 top-full mt-1 z-20 w-full bg-zinc-900 border border-zinc-700/50 rounded shadow-xl py-1">
													{allStates.map((state) => {
														const config = stateConfig[state];
														return (
															<button
																key={state}
																onClick={() => handleStateChange(state)}
																className={cn(
																	"w-full text-left px-2.5 py-1.5 text-[11px] flex items-center gap-2",
																	"hover:bg-zinc-800/60 transition-colors",
																	task.state === state && "bg-zinc-800/40",
																)}
															>
																<span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
																<span className={config.text}>{config.label}</span>
															</button>
														);
													})}
												</div>
											</>
										)}
									</div>
								</div>

								{/* Priority */}
								<div>
									<h4 className="text-[9px] uppercase tracking-[0.15em] text-zinc-500 mb-2 font-medium">
										Priority
									</h4>
									<div className="relative">
										<button
											onClick={() => setShowPriorityMenu(!showPriorityMenu)}
											disabled={updatingPriority}
											className={cn(
												"w-full flex items-center gap-2 px-2.5 py-1.5 rounded border text-[11px] font-medium transition-all",
												currentPriority.bg,
												currentPriority.color,
												"border-zinc-700/50",
												"hover:brightness-110",
												updatingPriority && "opacity-50",
											)}
										>
											<span className="font-mono text-[10px] opacity-70">
												{currentPriority.short}
											</span>
											{updatingPriority ? (
												<div className="w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin" />
											) : (
												<span className="flex-1 text-left">{currentPriority.label}</span>
											)}
											<svg
												width="10"
												height="10"
												viewBox="0 0 10 10"
												fill="none"
												className="opacity-50"
											>
												<path
													d="M2.5 4l2.5 2.5L7.5 4"
													stroke="currentColor"
													strokeWidth="1.2"
													strokeLinecap="round"
												/>
											</svg>
										</button>
										{showPriorityMenu && (
											<>
												<div
													className="fixed inset-0 z-10"
													onClick={() => setShowPriorityMenu(false)}
												/>
												<div className="absolute left-0 top-full mt-1 z-20 w-full bg-zinc-900 border border-zinc-700/50 rounded shadow-xl py-1">
													{([1, 2, 3, 4] as const).map((priority) => {
														const config = priorityConfig[priority];
														return (
															<button
																key={priority}
																onClick={() => handlePriorityChange(priority)}
																className={cn(
																	"w-full text-left px-2.5 py-1.5 text-[11px] flex items-center gap-2",
																	"hover:bg-zinc-800/60 transition-colors",
																	task.priority === priority && "bg-zinc-800/40",
																	config.color,
																)}
															>
																<span className="font-mono text-[10px] opacity-70">
																	{config.short}
																</span>
																<span>{config.label}</span>
															</button>
														);
													})}
												</div>
											</>
										)}
									</div>
								</div>

								{/* Labels */}
								<div>
									<div className="flex items-center justify-between mb-2">
										<h4 className="text-[9px] uppercase tracking-[0.15em] text-zinc-500 font-medium">
											Labels
										</h4>
										<button
											onClick={() => setShowLabelInput(!showLabelInput)}
											disabled={updatingLabels}
											className="text-zinc-600 hover:text-zinc-400 transition-colors"
										>
											<svg width="10" height="10" viewBox="0 0 12 12" fill="none">
												<path
													d="M6 2v8M2 6h8"
													stroke="currentColor"
													strokeWidth="1.5"
													strokeLinecap="round"
												/>
											</svg>
										</button>
									</div>
									{showLabelInput && (
										<div className="flex items-center gap-1 mb-2">
											<input
												type="text"
												value={newLabelValue}
												onChange={(e) => setNewLabelValue(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === "Enter") handleAddLabel();
													if (e.key === "Escape") {
														setNewLabelValue("");
														setShowLabelInput(false);
													}
												}}
												autoFocus
												disabled={updatingLabels}
												placeholder="Label..."
												className="flex-1 px-2 py-1 text-[10px] bg-zinc-800/50 border border-zinc-700/50 rounded text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-zinc-600"
											/>
											<button
												onClick={handleAddLabel}
												disabled={updatingLabels || !newLabelValue.trim()}
												className="px-1.5 py-1 text-[9px] bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded transition-colors disabled:opacity-40"
											>
												Add
											</button>
										</div>
									)}
									{task.labels && task.labels.length > 0 ? (
										<div className="flex flex-wrap gap-1">
											{task.labels.map((label) => (
												<span
													key={label}
													className="group text-[9px] px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-300 border border-zinc-700/40 flex items-center gap-1"
												>
													{label}
													<button
														onClick={() => handleRemoveLabel(label)}
														disabled={updatingLabels}
														className="opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-opacity"
													>
														<svg width="7" height="7" viewBox="0 0 8 8" fill="none">
															<path
																d="M1.5 1.5l5 5M6.5 1.5l-5 5"
																stroke="currentColor"
																strokeWidth="1.2"
																strokeLinecap="round"
															/>
														</svg>
													</button>
												</span>
											))}
										</div>
									) : (
										!showLabelInput && <p className="text-[10px] text-zinc-500">None</p>
									)}
								</div>

								{/* Divider */}
								<div className="border-t border-zinc-800/50" />

								{/* Project */}
								<div>
									<h4 className="text-[9px] uppercase tracking-[0.15em] text-zinc-500 mb-1.5 font-medium">
										Project
									</h4>
									<p className="text-[10px] text-zinc-300 font-mono">
										{workspaceName}/{containerTitle}
									</p>
								</div>

								{/* Slug */}
								<div>
									<h4 className="text-[9px] uppercase tracking-[0.15em] text-zinc-500 mb-1.5 font-medium">
										Slug
									</h4>
									<p className="text-[10px] text-zinc-400 font-mono break-all">{task.slug}</p>
								</div>

								{/* Timestamps */}
								<div>
									<h4 className="text-[9px] uppercase tracking-[0.15em] text-zinc-500 mb-1.5 font-medium">
										Created
									</h4>
									<p className="text-[10px] text-zinc-400">{formatDateTimeFull(task.created_at)}</p>
									<p className="text-[9px] text-zinc-500">by {task.created_by.slug}</p>
								</div>

								<div>
									<h4 className="text-[9px] uppercase tracking-[0.15em] text-zinc-500 mb-1.5 font-medium">
										Updated
									</h4>
									<p className="text-[10px] text-zinc-400">{formatDateTimeFull(task.updated_at)}</p>
									<p className="text-[9px] text-zinc-500">by {task.updated_by.slug}</p>
								</div>

								{task.completed_at && (
									<div>
										<h4 className="text-[9px] uppercase tracking-[0.15em] text-zinc-500 mb-1.5 font-medium">
											Completed
										</h4>
										<p className="text-[10px] text-emerald-400">
											{formatDateTimeFull(task.completed_at)}
										</p>
									</div>
								)}
							</div>
						</aside>

						{/* ═════════════════════════════════════════════════════════════
						    CENTER COLUMN: MAIN CONTENT
						    ═════════════════════════════════════════════════════════════ */}
						<main className="flex-1 flex flex-col overflow-hidden min-w-0">
							<div className="flex-1 overflow-y-auto p-5">
								{/* Title Row */}
								<div className="group flex items-start gap-3 mb-4">
									{/* Complete checkbox */}
									<button
										onClick={onTaskComplete}
										disabled={task.state === "completed"}
										className={cn(
											"flex-shrink-0 w-5 h-5 mt-0.5 rounded-full border-2 transition-all flex items-center justify-center",
											task.state === "completed"
												? "bg-emerald-500/30 border-emerald-500/50 text-emerald-300"
												: cn(
														currentPriority.color.replace("text-", "border-"),
														"hover:bg-zinc-800/50 active:scale-90",
													),
										)}
									>
										{task.state === "completed" && (
											<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
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

									{/* Title */}
									<div className="flex-1 min-w-0">
										{editingTitle ? (
											<input
												type="text"
												value={titleValue}
												onChange={(e) => setTitleValue(e.target.value)}
												onBlur={handleTitleSave}
												onKeyDown={(e) => {
													if (e.key === "Enter") handleTitleSave();
													if (e.key === "Escape") {
														setTitleValue(task.title);
														setEditingTitle(false);
													}
												}}
												autoFocus
												className="w-full text-[16px] font-medium text-zinc-100 bg-transparent border-b border-zinc-600 outline-none pb-1"
											/>
										) : (
											<h1
												onClick={() => setEditingTitle(true)}
												className={cn(
													"text-[16px] font-medium cursor-text leading-snug",
													task.state === "cancelled"
														? "text-zinc-500 line-through"
														: "text-zinc-100 hover:text-white",
												)}
											>
												{task.title}
											</h1>
										)}

										{/* Triaged badge */}
										{isTriaged && (
											<span className="inline-block mt-2 text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
												triaged
											</span>
										)}
									</div>
								</div>

								{/* Description */}
								<div className="mb-6 pl-8">
									{editingDescription ? (
										<textarea
											value={descriptionValue}
											onChange={(e) => setDescriptionValue(e.target.value)}
											onBlur={handleDescriptionSave}
											onKeyDown={(e) => {
												if (e.key === "Escape") {
													setDescriptionValue(task.description || "");
													setEditingDescription(false);
												}
											}}
											autoFocus
											rows={4}
											className="w-full text-[13px] text-zinc-300 leading-relaxed bg-zinc-800/30 border border-zinc-700/50 rounded p-3 outline-none focus:border-zinc-600 resize-y"
											placeholder="Add description..."
										/>
									) : (
										<div
											onClick={() => setEditingDescription(true)}
											className="text-[13px] text-zinc-400 leading-relaxed cursor-text min-h-[40px]"
										>
											{task.description ? (
												<MarkdownContent content={task.description} />
											) : (
												<span className="text-zinc-600">Add description...</span>
											)}
										</div>
									)}
								</div>

								{/* Subtasks */}
								{task.subtasks && task.subtasks.length > 0 && (
									<div className="mb-5 pl-8">
										<h3 className="text-[9px] uppercase tracking-[0.15em] text-zinc-500 font-medium mb-2">
											Subtasks
										</h3>
										<div className="space-y-1.5">
											{task.subtasks.map((subtask) => (
												<div key={subtask.id} className="flex items-center gap-2 text-[12px]">
													<div
														className={cn(
															"w-3.5 h-3.5 rounded-full border flex items-center justify-center",
															subtask.state === "completed"
																? "bg-emerald-500/30 border-emerald-500/50"
																: "border-zinc-600",
														)}
													>
														{subtask.state === "completed" && (
															<svg
																width="8"
																height="8"
																viewBox="0 0 10 10"
																fill="none"
																className="text-emerald-400"
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
													</div>
													<span
														className={
															subtask.state === "completed"
																? "text-zinc-500 line-through"
																: "text-zinc-200"
														}
													>
														{subtask.title}
													</span>
												</div>
											))}
										</div>
									</div>
								)}

								{/* Add subtask */}
								<div className="mb-6 pl-8">
									{showSubtaskInput ? (
										<div className="flex items-center gap-2">
											<input
												type="text"
												value={newSubtaskTitle}
												onChange={(e) => setNewSubtaskTitle(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === "Enter") handleCreateSubtask();
													if (e.key === "Escape") {
														setNewSubtaskTitle("");
														setShowSubtaskInput(false);
													}
												}}
												autoFocus
												disabled={creatingSubtask}
												placeholder="Subtask title..."
												className="flex-1 px-2.5 py-1.5 text-[12px] bg-zinc-800/40 border border-zinc-700/50 rounded text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-zinc-600"
											/>
											<button
												onClick={handleCreateSubtask}
												disabled={creatingSubtask || !newSubtaskTitle.trim()}
												className="px-2 py-1.5 text-[11px] bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded transition-colors disabled:opacity-40"
											>
												{creatingSubtask ? "..." : "Add"}
											</button>
											<button
												onClick={() => {
													setNewSubtaskTitle("");
													setShowSubtaskInput(false);
												}}
												className="p-1.5 text-zinc-600 hover:text-zinc-400"
											>
												<svg width="10" height="10" viewBox="0 0 12 12" fill="none">
													<path
														d="M3 3l6 6M9 3l-6 6"
														stroke="currentColor"
														strokeWidth="1.2"
														strokeLinecap="round"
													/>
												</svg>
											</button>
										</div>
									) : (
										<button
											onClick={() => setShowSubtaskInput(true)}
											className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
										>
											<svg width="10" height="10" viewBox="0 0 12 12" fill="none">
												<path
													d="M6 2v8M2 6h8"
													stroke="currentColor"
													strokeWidth="1.5"
													strokeLinecap="round"
												/>
											</svg>
											Add subtask
										</button>
									)}
								</div>

								{/* Divider */}
								<div className="border-t border-zinc-800/50 mb-5" />

								{/* Comments */}
								<div className="pl-8">
									<h3 className="text-[9px] uppercase tracking-[0.15em] text-zinc-500 font-medium mb-3">
										Comments
									</h3>

									{/* Comment input */}
									<div className="flex items-start gap-2.5 mb-4">
										<div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
											<span className="text-[10px] text-amber-400 font-medium">U</span>
										</div>
										<div className="flex-1 relative">
											<input
												type="text"
												value={newComment}
												onChange={(e) => setNewComment(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === "Enter" && !e.shiftKey) {
														e.preventDefault();
														handleCommentSubmit();
													}
												}}
												placeholder="Add a comment..."
												disabled={submittingComment}
												className="w-full px-3 py-2 rounded-full bg-zinc-800/40 border border-zinc-700/40 text-[12px] text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-zinc-600"
											/>
											<button
												onClick={handleCommentSubmit}
												disabled={submittingComment || !newComment.trim()}
												className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-600 hover:text-zinc-400"
											>
												<svg width="12" height="12" viewBox="0 0 14 14" fill="none">
													<path
														d="M12 7H2M12 7l-4-4M12 7l-4 4"
														stroke="currentColor"
														strokeWidth="1.5"
														strokeLinecap="round"
														strokeLinejoin="round"
													/>
												</svg>
											</button>
										</div>
									</div>

									{/* Comments list */}
									{commentsLoading ? (
										<p className="text-[11px] text-zinc-500 py-3">Loading comments...</p>
									) : comments.length === 0 ? (
										<p className="text-[11px] text-zinc-600 py-3">No comments yet</p>
									) : (
										<div className="space-y-3">
											{comments.map((comment) => (
												<div key={comment.id} className="flex items-start gap-2.5">
													<div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
														<span className="text-[9px] text-zinc-400 font-medium">
															{comment.actor_slug?.[0]?.toUpperCase() || "?"}
														</span>
													</div>
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-2 mb-0.5">
															<span className="text-[11px] text-zinc-200 font-medium">
																{comment.actor_slug || "Unknown"}
															</span>
															<span className="text-[9px] text-zinc-500">
																{formatDateTime(comment.created_at)}
															</span>
														</div>
														<div className="text-[12px] text-zinc-400 leading-relaxed">
															<MarkdownContent content={comment.body} />
														</div>
													</div>
												</div>
											))}
										</div>
									)}
								</div>
							</div>

							{/* Session Stream Panel (when open) */}
							{showSessionStream && task.cp_session_id && (
								<div className="flex-shrink-0 h-[300px] border-t border-zinc-800/50 p-3">
									<SessionStreamPanel
										className="h-full"
										sessionId={task.cp_session_id}
										runId={task.cp_run_id}
										isOpen={showSessionStream}
										onToggle={setShowSessionStream}
										showToggle={false}
										fill
									/>
								</div>
							)}
						</main>

						{/* ═════════════════════════════════════════════════════════════
						    RIGHT COLUMN: AGENT ACTIONS
						    ═════════════════════════════════════════════════════════════ */}
						<aside className="hidden md:flex flex-col w-[220px] border-l border-zinc-800/50 bg-gradient-to-b from-cyan-950/10 to-transparent flex-shrink-0">
							<div className="flex-1 overflow-y-auto p-4">
								{/* Section Header */}
								<div className="flex items-center gap-2 mb-4 pb-3 border-b border-cyan-800/20">
									<svg
										width="14"
										height="14"
										viewBox="0 0 16 16"
										fill="none"
										className="text-cyan-500/70"
									>
										<circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
										<path
											d="M8 5v3l2 2"
											stroke="currentColor"
											strokeWidth="1.5"
											strokeLinecap="round"
										/>
									</svg>
									<h3 className="text-[10px] uppercase tracking-[0.15em] text-cyan-400/70 font-semibold">
										Agent Actions
									</h3>
								</div>

								{/* Terminal Buttons - Vertical Layout */}
								<TerminalButtons
									ref={terminalButtonsRef}
									workspaceId={workspaceId}
									workspaceName={workspaceName}
									task={task}
									compact
									vertical
									onAsyncTriageComplete={refreshComments}
									onError={setToastError}
									onNotice={setToastNotice}
								/>

								{/* Divider */}
								<div className="border-t border-cyan-800/20 my-4" />

								{/* Prompt Shaping */}
								<div className="mb-4">
									<h4 className="text-[9px] uppercase tracking-[0.15em] text-zinc-500 mb-2 font-medium">
										Shape
									</h4>
									<button
										onClick={() =>
											goToPromptShaping(workspaceId, task.id, { workspaceName, containerTitle })
										}
										className={cn(
											"w-full flex items-center gap-2 px-3 py-2 rounded border text-[11px] font-medium transition-all",
											"bg-violet-500/10 border-violet-500/25 text-violet-300",
											"hover:bg-violet-500/15 hover:border-violet-500/40",
										)}
									>
										<svg
											width="12"
											height="12"
											viewBox="0 0 12 12"
											fill="none"
											className="opacity-70"
										>
											<path
												d="M2 3h8M2 6h5M2 9h7"
												stroke="currentColor"
												strokeWidth="1.2"
												strokeLinecap="round"
											/>
										</svg>
										<span>Prompt Shaping</span>
									</button>
								</div>

								{/* Live Session */}
								<div className="mb-4">
									<h4 className="text-[9px] uppercase tracking-[0.15em] text-zinc-500 mb-2 font-medium">
										Stream
									</h4>
									<button
										onClick={() => setShowSessionStream((prev) => !prev)}
										disabled={!task.cp_session_id}
										className={cn(
											"w-full flex items-center gap-2 px-3 py-2 rounded border text-[11px] font-medium transition-all",
											task.cp_session_id
												? cn(
														"bg-emerald-500/10 border-emerald-500/25 text-emerald-300",
														"hover:bg-emerald-500/15 hover:border-emerald-500/40",
														showSessionStream && "bg-emerald-500/20 border-emerald-400/40",
													)
												: "bg-zinc-800/30 border-zinc-700/30 text-zinc-600 cursor-not-allowed",
										)}
									>
										<span
											className={cn(
												"w-1.5 h-1.5 rounded-full",
												task.cp_session_id
													? showSessionStream
														? "bg-emerald-400 animate-pulse"
														: "bg-emerald-500/60"
													: "bg-zinc-600",
											)}
										/>
										<span>Live Session</span>
									</button>
								</div>

								{/* Divider */}
								<div className="border-t border-cyan-800/20 my-4" />

								{/* Async Status */}
								<div>
									<h4 className="text-[9px] uppercase tracking-[0.15em] text-zinc-500 mb-2 font-medium">
										Run Status
									</h4>
									<div className="space-y-2 text-[10px]">
										<div className="flex items-center justify-between">
											<span className="text-zinc-400">Status</span>
											<RunStatusBadge status={task.run_status} variant="compact" />
										</div>
										<div className="flex items-center justify-between">
											<span className="text-zinc-400">CP Run</span>
											<CopyableIdField value={task.cp_run_id} label="CP Run ID" />
										</div>
										<div className="flex items-center justify-between">
											<span className="text-zinc-400">CP Session</span>
											<CopyableIdField value={task.cp_session_id} label="CP Session ID" />
										</div>
										<div className="flex items-center justify-between">
											<span className="text-zinc-400">SDK Session</span>
											<CopyableIdField value={task.sdk_session_id} label="SDK Session ID" />
										</div>
										<div className="flex items-center justify-between">
											<span className="text-zinc-400">CP Project</span>
											<CopyableIdField value={task.cp_project_id} label="CP Project ID" />
										</div>
									</div>
								</div>

								{/* Meta */}
								{task.meta && Object.keys(task.meta).length > 0 && (
									<>
										<div className="border-t border-cyan-800/20 my-4" />
										<div>
											<h4 className="text-[9px] uppercase tracking-[0.15em] text-zinc-500 mb-2 font-medium">
												Meta
											</h4>
											<div className="space-y-1.5 text-[10px]">
												{Object.entries(task.meta as Record<string, unknown>).map(
													([key, value]) => {
														const formattedKey = key
															.replace(/_/g, " ")
															.replace(/\b\w/g, (c) => c.toUpperCase());
														let formattedValue: string;
														if (value === null || value === undefined) {
															formattedValue = "—";
														} else if (
															typeof value === "string" &&
															/^\d{4}-\d{2}-\d{2}T/.test(value)
														) {
															formattedValue = formatDateTimeFull(value);
														} else if (typeof value === "boolean") {
															formattedValue = value ? "Yes" : "No";
														} else if (typeof value === "object") {
															formattedValue = JSON.stringify(value);
														} else {
															formattedValue = String(value);
														}
														return (
															<div key={key} className="flex items-start justify-between gap-2">
																<span className="text-zinc-400 shrink-0">{formattedKey}</span>
																<span className="font-mono text-zinc-300 text-right break-all text-[9px]">
																	{formattedValue}
																</span>
															</div>
														);
													},
												)}
											</div>
										</div>
									</>
								)}
							</div>
						</aside>
					</div>
				) : (
					<div className="flex-1 flex items-center justify-center">
						<p className="text-[12px] text-zinc-600">Task not found</p>
					</div>
				)}
			</div>
		</div>
	);
}
