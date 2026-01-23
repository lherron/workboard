import {
	createComment,
	createTask,
	fetchTaskComments,
	fetchTaskDetail,
	updateTask,
} from "@/api/client";
import { MarkdownContent } from "@/components/MarkdownContent";
import { RunStatusBadge } from "@/components/RunStatusBadge";
import { SessionStreamPanel } from "@/components/SessionStreamPanel";
import { TerminalButtons } from "@/components/TerminalButtons";
import { useAppNavigation } from "@/hooks/useNavigation";
import { formatDateTime, formatDateTimeFull } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { TaskComment, TaskDetail, UpdateTaskRequest } from "@workboard/shared";
import { useCallback, useEffect, useState } from "react";
import { useParams, useSearch } from "wouter";

// State styling configuration
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
		bg: "bg-emerald-500/20",
		text: "text-emerald-300",
		border: "border-emerald-500/40",
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

const allStates = [
	"idea",
	"draft",
	"open",
	"in_progress",
	"completed",
	"blocked",
	"cancelled",
] as const;

/**
 * Route wrapper for PromptShapingPage.
 * Extracts workspaceId and taskId from route params.
 */
export function PromptShapingRoute() {
	const { workspaceId, taskId } = useParams<{ workspaceId: string; taskId: string }>();
	const searchString = useSearch();
	const { goToGlobalDashboard, goToProjects } = useAppNavigation();

	// Extract display names from query params (for backwards compatibility during transition)
	const searchParams = new URLSearchParams(searchString);
	const workspaceName = searchParams.get("wn") || workspaceId || "Workspace";
	const containerTitle = searchParams.get("ct") || "Container";

	const [task, setTask] = useState<TaskDetail | null>(null);
	const [loading, setLoading] = useState(true);
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
	const [showSessionStream, setShowSessionStream] = useState(false);
	const [terminalError, setTerminalError] = useState<string | null>(null);
	const [terminalNotice, setTerminalNotice] = useState<string | null>(null);

	// Load task detail
	useEffect(() => {
		if (!workspaceId || !taskId) {
			setLoading(false);
			return;
		}

		const controller = new AbortController();
		setLoading(true);

		fetchTaskDetail(workspaceId, taskId, controller.signal)
			.then((taskData) => {
				setTask(taskData);
				setTitleValue(taskData.title);
				setDescriptionValue(taskData.description || "");
				setLoading(false);
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setLoading(false);
			});

		return () => controller.abort();
	}, [workspaceId, taskId]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: task?.id triggers session stream reset
	useEffect(() => {
		setShowSessionStream(false);
	}, [task?.id]);

	// Load comments
	useEffect(() => {
		if (!workspaceId || !taskId) return;

		const controller = new AbortController();
		setCommentsLoading(true);

		fetchTaskComments(workspaceId, taskId, controller.signal)
			.then((resp) => {
				setComments(resp.comments);
				setCommentsLoading(false);
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setCommentsLoading(false);
			});

		return () => controller.abort();
	}, [workspaceId, taskId]);

	const handleBack = () => {
		goToProjects();
	};

	const handleTaskUpdate = useCallback(
		async (updates: UpdateTaskRequest) => {
			if (!workspaceId || !task) return;

			try {
				const updated = await updateTask(workspaceId, task.id, updates, task.etag);
				setTask(updated);
				return updated;
			} catch (err) {
				console.error("Failed to update task:", err);
				throw err;
			}
		},
		[workspaceId, task],
	);

	const handleTitleSave = useCallback(async () => {
		if (!task || titleValue === task.title) {
			setEditingTitle(false);
			return;
		}

		try {
			await handleTaskUpdate({ title: titleValue });
			setEditingTitle(false);
		} catch {
			setTitleValue(task.title);
			setEditingTitle(false);
		}
	}, [task, titleValue, handleTaskUpdate]);

	const handleDescriptionSave = useCallback(async () => {
		if (!task || descriptionValue === (task.description || "")) {
			setEditingDescription(false);
			return;
		}

		try {
			await handleTaskUpdate({ description: descriptionValue });
			setEditingDescription(false);
		} catch {
			setDescriptionValue(task.description || "");
			setEditingDescription(false);
		}
	}, [task, descriptionValue, handleTaskUpdate]);

	const handleStateChange = useCallback(
		async (newState: string) => {
			if (!task || task.state === newState) {
				setShowStateMenu(false);
				return;
			}

			setUpdatingState(true);
			setShowStateMenu(false);
			try {
				await handleTaskUpdate({ state: newState as UpdateTaskRequest["state"] });
			} catch (err) {
				console.error("Failed to update state:", err);
			}
			setUpdatingState(false);
		},
		[task, handleTaskUpdate],
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
				await handleTaskUpdate({ priority: newPriority });
			} catch (err) {
				console.error("Failed to update priority:", err);
			}
			setUpdatingPriority(false);
		},
		[task, handleTaskUpdate],
	);

	const handleAddLabel = useCallback(async () => {
		if (!task || !newLabelValue.trim()) {
			setShowLabelInput(false);
			setNewLabelValue("");
			return;
		}

		const normalizedLabel = newLabelValue.trim().toLowerCase().replace(/\s+/g, "-");
		const currentLabels = task.labels || [];
		if (currentLabels.includes(normalizedLabel)) {
			setShowLabelInput(false);
			setNewLabelValue("");
			return;
		}

		setUpdatingLabels(true);
		try {
			await handleTaskUpdate({ labels: [...currentLabels, normalizedLabel] });
			setShowLabelInput(false);
			setNewLabelValue("");
		} catch (err) {
			console.error("Failed to add label:", err);
		}
		setUpdatingLabels(false);
	}, [task, newLabelValue, handleTaskUpdate]);

	const handleRemoveLabel = useCallback(
		async (labelToRemove: string) => {
			if (!task) return;

			const currentLabels = task.labels || [];
			const newLabels = currentLabels.filter((l) => l !== labelToRemove);

			setUpdatingLabels(true);
			try {
				await handleTaskUpdate({ labels: newLabels });
			} catch (err) {
				console.error("Failed to remove label:", err);
			}
			setUpdatingLabels(false);
		},
		[task, handleTaskUpdate],
	);

	const handleCreateSubtask = useCallback(async () => {
		if (!workspaceId || !task || !newSubtaskTitle.trim()) {
			setShowSubtaskInput(false);
			setNewSubtaskTitle("");
			return;
		}

		setCreatingSubtask(true);
		try {
			const subtask = await createTask(workspaceId, task.project.id, {
				title: newSubtaskTitle.trim(),
				kind: "subtask",
				parent_task_uuid: task.uuid,
				state: "open",
				priority: task.priority,
			});
			// Add to local subtasks list
			setTask((prev) =>
				prev
					? {
							...prev,
							subtasks: [
								...prev.subtasks,
								{
									uuid: subtask.uuid,
									id: subtask.id,
									slug: subtask.slug,
									title: subtask.title,
									state: subtask.state,
									priority: subtask.priority,
								},
							],
						}
					: prev,
			);
			setShowSubtaskInput(false);
			setNewSubtaskTitle("");
		} catch (err) {
			console.error("Failed to create subtask:", err);
		}
		setCreatingSubtask(false);
	}, [workspaceId, task, newSubtaskTitle]);

	const handleCommentSubmit = useCallback(async () => {
		if (!workspaceId || !task || !newComment.trim()) return;

		setSubmittingComment(true);
		try {
			const comment = await createComment(workspaceId, task.id, { body: newComment.trim() });
			setComments((prev) => [...prev, comment]);
			setNewComment("");
		} catch (err) {
			console.error("Failed to add comment:", err);
		}
		setSubmittingComment(false);
	}, [workspaceId, task, newComment]);

	const priorityLabels: Record<number, { label: string; color: string }> = {
		1: { label: "P1 - Critical", color: "text-red-400" },
		2: { label: "P2 - High", color: "text-amber-400" },
		3: { label: "P3 - Medium", color: "text-sky-400" },
		4: { label: "P4 - Low", color: "text-zinc-400" },
	};

	const currentState = task ? stateConfig[task.state] || stateConfig.open : stateConfig.open;

	return (
		<div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
			{/* Header */}
			<header className="flex-shrink-0 border-b border-border/40 bg-secondary/50 backdrop-blur-sm">
				<div className="px-6 py-4 flex items-center justify-between">
					<div className="flex items-center gap-4">
						<button
							onClick={handleBack}
							className="p-2 -ml-2 text-muted-foreground/60 hover:text-foreground/90 hover:bg-secondary/60 rounded transition-colors"
						>
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
								<path
									d="M10 12L6 8l4-4"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						</button>
						<button
							onClick={goToGlobalDashboard}
							className="w-8 h-8 border border-primary/50 flex items-center justify-center bg-primary/10 rounded hover:bg-primary/20 transition-colors"
						>
							<span className="text-primary text-[11px] font-semibold tracking-tight">wq</span>
						</button>
						<div>
							<h1 className="text-[15px] font-medium text-foreground tracking-tight">
								Prompt Shaping
							</h1>
							<div className="flex items-center gap-2 text-[11px] text-muted-foreground/70 mt-0.5">
								<span className="text-primary/80">#</span>
								<span>{workspaceName}</span>
								<span className="text-muted-foreground/40">/</span>
								<span>{containerTitle}</span>
							</div>
						</div>
					</div>

					{/* Right side: Terminal buttons */}
					{task && workspaceId && (
						<div className="flex items-center gap-3">
							<TerminalButtons
								workspaceId={workspaceId}
								workspaceName={workspaceName}
								task={task}
								onError={setTerminalError}
								onNotice={setTerminalNotice}
							/>
							<div className="flex flex-col gap-1">
								<span className="text-[8px] uppercase tracking-[0.12em] text-muted-foreground/40 font-medium pl-0.5">
									stream
								</span>
								<button
									onClick={() => setShowSessionStream((prev) => !prev)}
									disabled={!task.cp_session_id}
									className={cn(
										"flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-semibold transition-all duration-200",
										"bg-emerald-500/15 border-emerald-500/40 text-emerald-200",
										"hover:bg-emerald-500/25 hover:border-emerald-400/60",
										showSessionStream && "shadow-[0_0_16px_-6px_rgba(52,211,153,0.8)]",
										!task.cp_session_id && "opacity-40 cursor-not-allowed",
									)}
								>
									<span
										className={cn(
											"h-1.5 w-1.5 rounded-full",
											showSessionStream ? "bg-emerald-300" : "bg-emerald-300/60",
										)}
									/>
									<span>Live Session</span>
								</button>
							</div>
						</div>
					)}
				</div>
			</header>

			{/* Terminal notifications */}
			{terminalError && (
				<div className="mx-4 mt-2 flex items-center gap-2 px-3 py-2 rounded bg-red-500/15 border border-red-500/30 text-red-400 text-[11px]">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
					>
						<circle cx="12" cy="12" r="10" />
						<line x1="12" y1="8" x2="12" y2="12" />
						<line x1="12" y1="16" x2="12.01" y2="16" />
					</svg>
					<span>{terminalError}</span>
					<button
						onClick={() => setTerminalError(null)}
						className="ml-auto text-red-300 hover:text-red-200"
					>
						×
					</button>
				</div>
			)}
			{terminalNotice && (
				<div className="mx-4 mt-2 flex items-center gap-2 px-3 py-2 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px]">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
					>
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
						<polyline points="22 4 12 14.01 9 11.01" />
					</svg>
					<span>{terminalNotice}</span>
					<button
						onClick={() => setTerminalNotice(null)}
						className="ml-auto text-emerald-300 hover:text-emerald-200"
					>
						×
					</button>
				</div>
			)}

			{/* Content */}
			{loading ? (
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center">
						<div className="w-6 h-6 border-2 border-primary/40 border-t-primary rounded-full animate-spin mx-auto mb-3" />
						<p className="text-[12px] text-muted-foreground/70">Loading task...</p>
					</div>
				</div>
			) : !taskId ? (
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center">
						<p className="text-[13px] text-muted-foreground/60">No task ID provided</p>
						<p className="text-[11px] text-muted-foreground/40 mt-1">
							URL requires /prompt-shaping/:workspaceId/:taskId
						</p>
						<button
							onClick={handleBack}
							className="mt-4 text-[12px] text-primary/80 hover:text-primary"
						>
							Go back
						</button>
					</div>
				</div>
			) : !task ? (
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center">
						<p className="text-[13px] text-muted-foreground/60">Task not found: {taskId}</p>
						<button
							onClick={handleBack}
							className="mt-4 text-[12px] text-primary/80 hover:text-primary"
						>
							Go back
						</button>
					</div>
				</div>
			) : (
				<div className="flex-1 overflow-hidden flex flex-col min-h-0">
					<div className={cn("flex flex-col md:flex-row overflow-hidden min-h-0 flex-1")}>
						{/* Main Content */}
						<div className="flex-1 overflow-y-auto p-6 md:p-8">
							{/* Title with checkbox */}
							<div className="flex items-start gap-4 mb-4">
								<button
									disabled={task.state === "completed"}
									className={cn(
										"flex-shrink-0 w-6 h-6 mt-1 rounded-full border-2 transition-all",
										task.state === "completed"
											? "bg-emerald-500/30 border-emerald-500/50"
											: priorityLabels[task.priority]?.color.replace("text-", "border-") ||
													"border-zinc-500/40",
										"hover:bg-secondary/60 active:scale-90",
										"flex items-center justify-center",
									)}
								>
									{task.state === "completed" && (
										<svg
											width="12"
											height="12"
											viewBox="0 0 10 10"
											fill="none"
											className="opacity-80"
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
										className="flex-1 text-[20px] font-medium text-foreground bg-transparent border-b border-foreground/30 outline-none pb-1"
									/>
								) : (
									<h1
										onClick={() => setEditingTitle(true)}
										className={cn(
											"flex-1 text-[20px] font-medium cursor-text hover:text-foreground",
											task.state === "cancelled"
												? "text-foreground/50 line-through"
												: "text-foreground",
										)}
									>
										{task.title}
									</h1>
								)}
							</div>

							{/* Description */}
							<div className="mb-6 pl-10">
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
										rows={6}
										className="w-full text-[14px] text-foreground/90 leading-relaxed bg-secondary/30 border border-border/50 rounded p-3 outline-none focus:border-foreground/30 resize-y"
										placeholder="Add description..."
									/>
								) : (
									<div
										onClick={() => setEditingDescription(true)}
										className="text-[14px] text-foreground/80 leading-relaxed cursor-text min-h-[60px]"
									>
										{task.description ? (
											<MarkdownContent content={task.description} />
										) : (
											<span className="text-muted-foreground/50">Add description...</span>
										)}
									</div>
								)}
							</div>

							{/* Subtasks section */}
							{task.subtasks && task.subtasks.length > 0 && (
								<div className="mb-6 pl-10">
									<h3 className="text-[12px] text-muted-foreground/60 uppercase tracking-wider mb-3">
										Subtasks
									</h3>
									<div className="space-y-2">
										{task.subtasks.map((subtask) => (
											<div key={subtask.id} className="flex items-center gap-2 text-[13px]">
												<div
													className={cn(
														"w-4 h-4 rounded-full border",
														subtask.state === "completed"
															? "bg-emerald-500/30 border-emerald-500/50"
															: "border-zinc-500/40",
													)}
												>
													{subtask.state === "completed" && (
														<svg
															width="16"
															height="16"
															viewBox="0 0 16 16"
															fill="none"
															className="opacity-70"
														>
															<path
																d="M4 8l3 3 5-5"
																stroke="currentColor"
																strokeWidth="1.5"
																strokeLinecap="round"
																strokeLinejoin="round"
															/>
														</svg>
													)}
												</div>
												<span
													className={cn(
														subtask.state === "completed"
															? "text-foreground/50 line-through"
															: "text-foreground/90",
													)}
												>
													{subtask.title}
												</span>
											</div>
										))}
									</div>
								</div>
							)}

							<div className="mb-6 pl-10">
								{showSubtaskInput ? (
									<div className="flex items-center gap-2">
										<div
											className={cn("w-4 h-4 rounded-full border border-zinc-500/40 flex-shrink-0")}
										/>
										<input
											type="text"
											value={newSubtaskTitle}
											onChange={(e) => setNewSubtaskTitle(e.target.value)}
											onBlur={handleCreateSubtask}
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
											className={cn(
												"flex-1 text-[13px] bg-secondary/30 border border-border/50 rounded px-2 py-1",
												"text-foreground/90 placeholder:text-muted-foreground/40",
												"outline-none focus:border-foreground/30",
												creatingSubtask && "opacity-50",
											)}
										/>
										{creatingSubtask && (
											<div className="w-3 h-3 border border-primary/30 border-t-primary rounded-full animate-spin" />
										)}
									</div>
								) : (
									<button
										onClick={() => setShowSubtaskInput(true)}
										className="flex items-center gap-2 text-[13px] text-muted-foreground/60 hover:text-muted-foreground/90 transition-colors"
									>
										<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
											<path
												d="M6 2v8M2 6h8"
												stroke="currentColor"
												strokeWidth="1.5"
												strokeLinecap="round"
											/>
										</svg>
										Add sub-task
									</button>
								)}
							</div>

							{/* Divider */}
							<div className="border-t border-border/30 mb-6" />

							{/* Comments Section */}
							<div className="pl-10">
								<h3 className="text-[12px] text-muted-foreground/60 uppercase tracking-wider mb-4">
									Comments
								</h3>

								{/* Comment Input */}
								<div className="flex items-start gap-3 mb-4">
									<div className="w-8 h-8 rounded-full bg-primary/25 flex items-center justify-center flex-shrink-0">
										<span className="text-[11px] text-primary font-medium">U</span>
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
											className={cn(
												"w-full px-4 py-2.5 rounded-full",
												"bg-secondary/50 border border-border/50",
												"text-[13px] text-foreground/90 placeholder:text-muted-foreground/50",
												"outline-none focus:border-foreground/30",
												submittingComment && "opacity-50",
											)}
										/>
										<button
											onClick={handleCommentSubmit}
											disabled={submittingComment || !newComment.trim()}
											className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground/50 hover:text-muted-foreground/90"
										>
											<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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

								{/* Comments List */}
								{commentsLoading ? (
									<div className="text-[12px] text-muted-foreground/50 py-4">
										Loading comments...
									</div>
								) : comments.length === 0 ? (
									<div className="text-[12px] text-muted-foreground/40 py-4">No comments yet</div>
								) : (
									<div className="space-y-4">
										{comments.map((comment) => (
											<div key={comment.id} className="flex items-start gap-3">
												<div className="w-8 h-8 rounded-full bg-secondary/70 flex items-center justify-center flex-shrink-0">
													<span className="text-[10px] text-muted-foreground/80 font-medium">
														{comment.actor_slug?.[0]?.toUpperCase() || "?"}
													</span>
												</div>
												<div className="flex-1">
													<div className="flex items-center gap-2 mb-1">
														<span className="text-[12px] text-foreground/90 font-medium">
															{comment.actor_slug || "Unknown"}
														</span>
														<span className="text-[10px] text-muted-foreground/50">
															{formatDateTime(comment.created_at)}
														</span>
													</div>
													<p className="text-[13px] text-foreground/80 leading-relaxed">
														{comment.body}
													</p>
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						</div>

						{/* Sidebar */}
						<div className="w-full md:w-[280px] border-t md:border-t-0 md:border-l border-border/30 bg-secondary/20 p-6 flex-shrink-0 overflow-hidden flex flex-col min-h-0">
							<div className="flex-1 min-h-0 overflow-y-auto">
								{/* Mobile grid layout for metadata */}
								<div className="grid grid-cols-2 gap-4 md:grid-cols-1 md:gap-0">
									{/* State */}
									<div className="mb-0 md:mb-5">
										<h4 className="text-[11px] text-muted-foreground/60 uppercase tracking-wider mb-2">
											State
										</h4>
										<div className="relative">
											<button
												onClick={() => setShowStateMenu(!showStateMenu)}
												disabled={updatingState}
												className={cn(
													"flex items-center gap-2 px-2.5 py-1.5 rounded border text-[12px] font-medium transition-all",
													currentState.bg,
													currentState.text,
													currentState.border,
													"hover:opacity-90",
													updatingState && "opacity-50",
												)}
											>
												{updatingState ? (
													<div className="w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin" />
												) : (
													<span>{currentState.label}</span>
												)}
												<svg
													width="10"
													height="10"
													viewBox="0 0 10 10"
													fill="none"
													className="opacity-60"
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
													<div className="absolute left-0 top-full mt-1 z-20 min-w-[140px] bg-popover border border-border/50 rounded-lg shadow-xl py-1 overflow-hidden">
														{allStates.map((state) => {
															const config = stateConfig[state];
															return (
																<button
																	key={state}
																	onClick={() => handleStateChange(state)}
																	className={cn(
																		"w-full text-left px-3 py-1.5 text-[12px] flex items-center gap-2",
																		"hover:bg-secondary/60 transition-colors",
																		task.state === state ? "bg-secondary/40" : "",
																	)}
																>
																	<span
																		className={cn(
																			"w-2 h-2 rounded-full",
																			config.bg.replace("/20", "/60"),
																		)}
																	/>
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
									<div className="mb-0 md:mb-5">
										<h4 className="text-[11px] text-muted-foreground/60 uppercase tracking-wider mb-2">
											Priority
										</h4>
										<div className="relative">
											<button
												onClick={() => setShowPriorityMenu(!showPriorityMenu)}
												disabled={updatingPriority}
												className={cn(
													"flex items-center gap-2 px-2.5 py-1.5 rounded border text-[12px] font-medium transition-all",
													"bg-secondary/30 border-border/50",
													priorityLabels[task.priority]?.color,
													"hover:bg-secondary/50",
													updatingPriority && "opacity-50",
												)}
											>
												{updatingPriority ? (
													<div className="w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin" />
												) : (
													<>
														<svg width="12" height="12" viewBox="0 0 16 16" fill="none">
															<path
																d="M3 2v12M3 2l10 4-10 4"
																stroke="currentColor"
																strokeWidth="1.5"
																strokeLinecap="round"
																strokeLinejoin="round"
															/>
														</svg>
														<span>{priorityLabels[task.priority]?.label}</span>
													</>
												)}
												<svg
													width="10"
													height="10"
													viewBox="0 0 10 10"
													fill="none"
													className="opacity-60"
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
													<div className="absolute left-0 top-full mt-1 z-20 min-w-[140px] bg-popover border border-border/50 rounded-lg shadow-xl py-1 overflow-hidden">
														{([1, 2, 3, 4] as const).map((priority) => {
															const config = priorityLabels[priority];
															return (
																<button
																	key={priority}
																	onClick={() => handlePriorityChange(priority)}
																	className={cn(
																		"w-full text-left px-3 py-1.5 text-[12px] flex items-center gap-2",
																		"hover:bg-secondary/60 transition-colors",
																		task.priority === priority ? "bg-secondary/40" : "",
																	)}
																>
																	<svg
																		width="10"
																		height="10"
																		viewBox="0 0 16 16"
																		fill="none"
																		className={config.color}
																	>
																		<path
																			d="M3 2v12M3 2l10 4-10 4"
																			stroke="currentColor"
																			strokeWidth="1.5"
																			strokeLinecap="round"
																			strokeLinejoin="round"
																		/>
																	</svg>
																	<span className={config.color}>{config.label}</span>
																</button>
															);
														})}
													</div>
												</>
											)}
										</div>
									</div>

									{/* Project */}
									<div className="mb-0 md:mb-5 col-span-2 md:col-span-1">
										<h4 className="text-[11px] text-muted-foreground/60 uppercase tracking-wider mb-2">
											Project
										</h4>
										<div className="flex items-center gap-2 text-[12px] text-foreground/80">
											<span className="text-primary/80">#</span>
											<span>
												{workspaceName} / {containerTitle}
											</span>
										</div>
									</div>

									{/* Labels - spans full width on mobile */}
									<div className="mb-0 md:mb-5 col-span-2 md:col-span-1">
										<div className="flex items-center justify-between mb-2">
											<h4 className="text-[11px] text-muted-foreground/60 uppercase tracking-wider">
												Labels
											</h4>
											<button
												onClick={() => setShowLabelInput(true)}
												disabled={updatingLabels}
												className={cn(
													"text-muted-foreground/50 hover:text-muted-foreground/80",
													updatingLabels && "opacity-50",
												)}
											>
												<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
													<path
														d="M6 2v8M2 6h8"
														stroke="currentColor"
														strokeWidth="1.5"
														strokeLinecap="round"
													/>
												</svg>
											</button>
										</div>
										<div className="flex flex-wrap gap-1">
											{task.labels?.map((label) => (
												<span
													key={label}
													className="group text-[10px] px-2 py-0.5 rounded bg-primary/15 text-primary/90 flex items-center gap-1"
												>
													{label}
													<button
														onClick={() => handleRemoveLabel(label)}
														disabled={updatingLabels}
														className="opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
													>
														<svg width="8" height="8" viewBox="0 0 8 8" fill="none">
															<path
																d="M1 1l6 6M7 1l-6 6"
																stroke="currentColor"
																strokeWidth="1.2"
																strokeLinecap="round"
															/>
														</svg>
													</button>
												</span>
											))}
											{showLabelInput ? (
												<input
													type="text"
													value={newLabelValue}
													onChange={(e) => setNewLabelValue(e.target.value)}
													onBlur={handleAddLabel}
													onKeyDown={(e) => {
														if (e.key === "Enter") handleAddLabel();
														if (e.key === "Escape") {
															setNewLabelValue("");
															setShowLabelInput(false);
														}
													}}
													autoFocus
													placeholder="label"
													className="text-[10px] px-2 py-0.5 rounded bg-secondary/50 border border-border/50 text-foreground/90 placeholder:text-muted-foreground/40 outline-none focus:border-foreground/30 w-20"
												/>
											) : (
												task.labels?.length === 0 && (
													<button
														onClick={() => setShowLabelInput(true)}
														className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground/80"
													>
														Add label...
													</button>
												)
											)}
										</div>
									</div>
								</div>

								{/* Metadata section */}
								<div className="mt-6 pt-4 border-t border-border/30 space-y-3">
									{/* Slug */}
									<div>
										<h4 className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">
											Slug
										</h4>
										<p className="text-[11px] text-foreground/70 font-mono">{task.slug}</p>
									</div>

									{/* Task ID */}
									<div>
										<h4 className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">
											ID
										</h4>
										<p className="text-[11px] text-foreground/70 font-mono">{task.id}</p>
									</div>

									{/* Created */}
									<div>
										<h4 className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">
											Created
										</h4>
										<p className="text-[11px] text-foreground/60">
											{formatDateTimeFull(task.created_at)}
										</p>
										<p className="text-[10px] text-muted-foreground/50">
											by {task.created_by.slug}
										</p>
									</div>

									{/* Updated */}
									<div>
										<h4 className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">
											Updated
										</h4>
										<p className="text-[11px] text-foreground/60">
											{formatDateTimeFull(task.updated_at)}
										</p>
										<p className="text-[10px] text-muted-foreground/50">
											by {task.updated_by.slug}
										</p>
									</div>

									<div className="pt-3 border-t border-border/30 space-y-2">
										<h4 className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
											Async
										</h4>
										<div className="space-y-2 text-[11px] text-foreground/80">
											<div className="flex items-start justify-between gap-2">
												<span className="text-muted-foreground/60">Status</span>
												<RunStatusBadge status={task.run_status} variant="compact" />
											</div>
											<div className="flex items-start justify-between gap-2">
												<span className="text-muted-foreground/60">CP Run</span>
												<span className="font-mono text-right break-all text-[10px]">
													{task.cp_run_id ?? "—"}
												</span>
											</div>
											<div className="flex items-start justify-between gap-2">
												<span className="text-muted-foreground/60">CP Session</span>
												<span className="font-mono text-right break-all text-[10px]">
													{task.cp_session_id ?? "—"}
												</span>
											</div>
											<div className="flex items-start justify-between gap-2">
												<span className="text-muted-foreground/60">SDK Session</span>
												<span className="font-mono text-right break-all text-[10px]">
													{task.sdk_session_id ?? "—"}
												</span>
											</div>
											<div className="flex items-start justify-between gap-2">
												<span className="text-muted-foreground/60">CP Project</span>
												<span className="font-mono text-right break-all text-[10px]">
													{task.cp_project_id ?? "—"}
												</span>
											</div>
										</div>
									</div>

									{/* Meta */}
									<div className="pt-3 border-t border-border/30 space-y-2">
										<h4 className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
											Meta
										</h4>
										{task.meta && Object.keys(task.meta).length > 0 ? (
											<div className="space-y-2 text-[11px] text-foreground/80">
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
																<span className="text-muted-foreground/60 shrink-0">
																	{formattedKey}
																</span>
																<span className="font-mono text-right break-all text-[10px]">
																	{formattedValue}
																</span>
															</div>
														);
													},
												)}
											</div>
										) : (
											<p className="text-[11px] text-muted-foreground/50">None</p>
										)}
									</div>

									{/* Completed at (if completed) */}
									{task.completed_at && (
										<div>
											<h4 className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">
												Completed
											</h4>
											<p className="text-[11px] text-emerald-400/80">
												{formatDateTimeFull(task.completed_at)}
											</p>
										</div>
									)}
								</div>
							</div>
						</div>
					</div>

					{showSessionStream && task.cp_session_id && (
						<div className="flex-1 min-h-0 border-t border-border/30 p-6">
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
				</div>
			)}
		</div>
	);
}
