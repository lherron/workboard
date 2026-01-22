import { type ApiClientError, createComment, restoreTask, updateTask } from "@/api/client";
import { ClaudeActions } from "@/components/ClaudeActions";
import { CommentsTimeline } from "@/components/CommentsTimeline";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { MarkdownContent } from "@/components/MarkdownContent";
import { MoveTaskModal } from "@/components/MoveTaskModal";
import { Skeleton } from "@/components/Skeleton";
import { PriorityBadge, StatePill, TriagedBadge } from "@/components/TaskBadges";
import { TerminalButtons } from "@/components/TerminalButtons";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { formatProjectPath } from "@/lib/taskPaths";
import { cn } from "@/lib/utils";
import type { CrossProjectContainersTreeResponse, TaskComment, TaskDetail } from "@webwrkq/shared";
import { useMemo, useState } from "react";

type WorkspaceTree = CrossProjectContainersTreeResponse["projects"][number];

type TaskDetailPanelProps = {
	selectedTaskId: string | null;
	workspaceId: string | null;
	task?: TaskDetail;
	taskLoading: boolean;
	taskError: ApiClientError | null;
	comments: TaskComment[];
	commentsLoading: boolean;
	commentsError: ApiClientError | null;
	workspaces?: WorkspaceTree[];
	onRetryTask?: () => void;
	onRetryComments?: () => void;
	onTaskUpdated?: (options?: { skipWorkspaceRefresh?: boolean }) => void;
	onCommentAdded?: () => void;
};

type MetaItemProps = {
	label: string;
	value: string | React.ReactNode;
	hint?: string;
};

function MetaItem({ label, value, hint }: MetaItemProps) {
	return (
		<div className="space-y-1 border-l border-border/40 pl-3 py-0.5">
			<div className="text-[10px] uppercase tracking-widest text-muted-foreground/50">{label}</div>
			<div className="text-[12px] tracking-wide text-foreground font-mono">{value}</div>
			{hint && (
				<div className="text-[10px] text-muted-foreground/40 tracking-wide font-mono">{hint}</div>
			)}
		</div>
	);
}

function Labels({ labels }: { labels: string[] }) {
	if (!labels?.length) {
		return <span className="text-[11px] text-muted-foreground/30">─</span>;
	}
	return (
		<div className="flex flex-wrap gap-2">
			{labels.map((label) => (
				<span key={label} className="text-[11px] text-muted-foreground tracking-wide font-mono">
					#{label}
				</span>
			))}
		</div>
	);
}

function CopyButton({ value, label }: { value: string; label: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			setCopied(false);
		}
	};

	return (
		<button
			className={cn(
				"inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest transition-all font-mono",
				copied ? "text-primary" : "text-muted-foreground/50 hover:text-foreground",
			)}
			onClick={handleCopy}
			aria-label={`Copy ${label}`}
		>
			<span>{value}</span>
			{copied && <span className="text-primary">copied</span>}
		</button>
	);
}

function TaskDetailSkeleton() {
	return (
		<div className="space-y-6">
			<Skeleton className="h-8 w-2/3 bg-muted/20" />
			<div className="flex flex-wrap items-center gap-4">
				<Skeleton className="h-5 w-20 bg-muted/20" />
				<Skeleton className="h-5 w-14 bg-muted/20" />
				<Skeleton className="h-5 w-28 bg-muted/20" />
			</div>
			<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
				{[...Array(4)].map((_, idx) => (
					<Skeleton key={idx} className="h-12 w-full bg-muted/20" />
				))}
			</div>
			<div className="space-y-3">
				<Skeleton className="h-4 w-32 bg-muted/20" />
				<Skeleton className="h-32 w-full bg-muted/20" />
			</div>
		</div>
	);
}

function CommentComposer({
	taskId,
	workspaceId,
	onCommentAdded,
}: { taskId: string; workspaceId: string | null; onCommentAdded?: () => void }) {
	const [body, setBody] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<ApiClientError | null>(null);

	const submitComment = async () => {
		if (!body.trim() || loading) return;

		setLoading(true);
		setError(null);

		try {
			if (!workspaceId) {
				throw { message: "Workspace not selected" } as ApiClientError;
			}
			await createComment(workspaceId, taskId, { body });
			setBody("");
			onCommentAdded?.();
		} catch (err) {
			setError(err as ApiClientError);
		} finally {
			setLoading(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		await submitComment();
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			submitComment();
		}
		// Shift+Enter allows default behavior (newline)
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-2">
			{error && (
				<ErrorBanner
					title="Failed to post comment"
					message={error.message}
					detail={typeof error.details === "string" ? error.details : undefined}
				/>
			)}
			<div className="relative group">
				<div className="absolute left-0 top-2.5 text-muted-foreground/50 font-mono text-[12px]">
					›
				</div>
				<textarea
					value={body}
					onChange={(e) => setBody(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="add comment..."
					rows={2}
					className="w-full resize-y bg-transparent border-b border-border/30 pl-4 py-2 text-[12px] font-mono placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50 tracking-wide min-h-[40px]"
					disabled={loading}
				/>
				<div className="flex justify-end pt-1">
					<button
						type="submit"
						disabled={loading || !body.trim()}
						className={cn(
							"text-[10px] uppercase tracking-widest font-mono transition-colors",
							loading || !body.trim()
								? "text-muted-foreground/20 cursor-not-allowed"
								: "text-primary hover:text-primary/80",
						)}
					>
						{loading ? "sending..." : "enter to send · shift+enter for newline"}
					</button>
				</div>
			</div>
		</form>
	);
}

export function TaskDetailPanel({
	workspaceId,
	selectedTaskId,
	task,
	taskLoading,
	taskError,
	comments,
	commentsLoading,
	commentsError,
	workspaces,
	onRetryTask,
	onRetryComments,
	onTaskUpdated,
	onCommentAdded,
}: TaskDetailPanelProps) {
	const [isEditingBody, setIsEditingBody] = useState(false);
	const [bodyDraft, setBodyDraft] = useState("");
	const [updating, setUpdating] = useState(false);
	const [updateError, setUpdateError] = useState<ApiClientError | null>(null);
	const [moveModalOpen, setMoveModalOpen] = useState(false);
	const asyncMetaAvailable = Boolean(
		task?.cp_project_id ||
			task?.cp_run_id ||
			task?.cp_session_id ||
			task?.sdk_session_id ||
			task?.run_status,
	);

	const bodyIsEmpty = useMemo(() => !task?.description?.trim(), [task?.description]);

	const handleUpdate = async (updates: Partial<TaskDetail>) => {
		if (!task) return;
		setUpdating(true);
		setUpdateError(null);
		try {
			if (!workspaceId) {
				throw { message: "Workspace not selected" } as ApiClientError;
			}
			await updateTask(workspaceId, task.id, updates, task.etag);
			onTaskUpdated?.();
			setIsEditingBody(false);
		} catch (err) {
			const apiError = err as ApiClientError;
			setUpdateError(apiError);
			if (apiError.status === 409) {
				// Conflict
			}
		} finally {
			setUpdating(false);
		}
	};

	const handleRestore = async () => {
		if (!task) return;
		setUpdating(true);
		setUpdateError(null);
		try {
			if (!workspaceId) {
				throw { message: "Workspace not selected" } as ApiClientError;
			}
			await restoreTask(workspaceId, task.id, task.etag);
			onTaskUpdated?.();
		} catch (err) {
			const apiError = err as ApiClientError;
			setUpdateError(apiError);
		} finally {
			setUpdating(false);
		}
	};

	const startEditingBody = () => {
		setBodyDraft(task?.description || "");
		setIsEditingBody(true);
	};

	if (!selectedTaskId) {
		return (
			<div className="flex h-full items-center justify-center text-muted-foreground/30 font-mono text-[12px]">
				<span>← select a task</span>
			</div>
		);
	}

	if (taskError) {
		return (
			<ErrorBanner
				title="Could not load task detail"
				message={taskError.message}
				detail={typeof taskError.details === "string" ? taskError.details : undefined}
				onRetry={onRetryTask}
			/>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto pr-4 md:pr-6">
			<div className="space-y-6">
				{taskLoading && !task ? (
					<TaskDetailSkeleton />
				) : !task ? (
					<EmptyState title="Task not found" description="The selected task could not be loaded.">
						{onRetryTask ? (
							<button
								className="text-primary hover:underline text-xs font-mono"
								onClick={onRetryTask}
							>
								retry
							</button>
						) : null}
					</EmptyState>
				) : (
					<div className="space-y-6">
						{updateError && (
							<ErrorBanner
								title={updateError.status === 409 ? "Update conflict" : "Failed to update task"}
								message={
									updateError.status === 409
										? "This task has been modified by someone else. Please refresh."
										: updateError.message
								}
								detail={typeof updateError.details === "string" ? updateError.details : undefined}
								onRetry={updateError.status === 409 ? onRetryTask : () => setUpdateError(null)}
							/>
						)}

						{/* Header */}
						<div className="space-y-3">
							<div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground/50 tracking-wider font-mono">
								<CopyButton value={task.id} label="id" />
								<span>│</span>
								<span>{task.slug}</span>
								<span>│</span>
								<span className="truncate">{formatProjectPath(task.project.path)}</span>
								{(task.global_task_id || workspaceId) && (
									<>
										<span>│</span>
										<CopyButton
											value={task.global_task_id || `${workspaceId}:${task.id}`}
											label="global id"
										/>
									</>
								)}
							</div>

							<h2 className="text-[18px] font-medium leading-relaxed tracking-tight text-foreground font-mono">
								{task.title}
							</h2>

							<div className="flex flex-wrap items-center gap-4 pt-1">
								<StatePill state={task.state} />
								<PriorityBadge priority={task.priority} />
								<TriagedBadge
									triagedAt={
										(task.meta as { triaged_at?: string | null } | undefined)?.triaged_at ?? null
									}
								/>

								<div className="flex-1" />

								{/* Actions */}
								<div className="flex items-center gap-3 text-[11px] font-mono">
									{(task.state === "open" || task.state === "in_progress") && (
										<button
											className="text-primary hover:underline disabled:opacity-50"
											onClick={() =>
												handleUpdate({ state: task.state === "open" ? "completed" : "open" })
											}
											disabled={updating}
										>
											{task.state === "open" ? "complete" : "reopen"}
										</button>
									)}

									{(task.state === "deleted" || task.state === "archived") && (
										<button
											className="text-primary hover:underline disabled:opacity-50"
											onClick={handleRestore}
											disabled={updating}
										>
											restore
										</button>
									)}

									{workspaces && workspaces.length > 1 && (
										<>
											<span className="text-muted-foreground/30">│</span>
											<button
												className="text-muted-foreground hover:text-foreground disabled:opacity-50"
												onClick={() => setMoveModalOpen(true)}
												disabled={updating}
											>
												move →
											</button>
										</>
									)}

									<span className="text-muted-foreground/30">│</span>

									<div className="flex items-center gap-1.5">
										<span className="text-muted-foreground">pri:</span>
										<select
											className="bg-transparent text-foreground outline-none cursor-pointer hover:text-primary"
											value={task.priority}
											onChange={(e) =>
												handleUpdate({ priority: Number.parseInt(e.target.value, 10) })
											}
											disabled={updating}
										>
											<option value="1">1</option>
											<option value="2">2</option>
											<option value="3">3</option>
											<option value="4">4</option>
										</select>
									</div>
								</div>
							</div>

							{/* Claude Code Actions */}
							<div className="pt-3 border-t border-border/20 mt-3">
								<ClaudeActions task={task} />
							</div>

							{/* Terminal Buttons */}
							{workspaceId && (
								<div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/20 mt-3">
									<TerminalButtons
										workspaceId={workspaceId}
										task={task}
										compact
										onAsyncTriageComplete={onCommentAdded}
									/>
								</div>
							)}
						</div>

						<div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3 border-t border-border/30 pt-4">
							<MetaItem
								label="Project"
								value={task.project.title}
								hint={formatProjectPath(task.project.path)}
							/>
							<MetaItem
								label="Due date"
								value={
									<div className="flex items-center gap-2 group">
										<span>{task.due_at ? formatDate(task.due_at) : "none"}</span>
										<input
											type="date"
											className="w-4 h-4 opacity-0 group-hover:opacity-50 cursor-pointer"
											value={task.due_at ? task.due_at.split("T")[0] : ""}
											onChange={(e) => handleUpdate({ due_at: e.target.value || null })}
											disabled={updating}
										/>
									</div>
								}
								hint={task.start_at ? `Starts ${formatDate(task.start_at)}` : undefined}
							/>
							<MetaItem
								label="Updated"
								value={task.updated_by.slug}
								hint={formatDateTime(task.updated_at)}
							/>
							<MetaItem
								label="Created"
								value={task.created_by.slug}
								hint={formatDateTime(task.created_at)}
							/>
							<MetaItem
								label="Status"
								value={
									<div className="flex items-center gap-2">
										<span>{task.state.replace("_", " ")}</span>
										<span className="text-muted-foreground/40">v{task.etag}</span>
									</div>
								}
							/>
							<MetaItem label="Labels" value={<Labels labels={task.labels} />} />
						</div>

						{asyncMetaAvailable && (
							<div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3 border-t border-border/30 pt-4">
								<MetaItem label="Async status" value={task.run_status ?? "—"} />
								<MetaItem
									label="CP Run"
									value={
										task.cp_run_id ? <CopyButton value={task.cp_run_id} label="cp run id" /> : "—"
									}
								/>
								<MetaItem
									label="CP Session"
									value={
										task.cp_session_id ? (
											<CopyButton value={task.cp_session_id} label="cp session id" />
										) : (
											"—"
										)
									}
								/>
								<MetaItem
									label="SDK Session"
									value={
										task.sdk_session_id ? (
											<CopyButton value={task.sdk_session_id} label="sdk session id" />
										) : (
											"—"
										)
									}
								/>
								<MetaItem label="CP Project" value={task.cp_project_id ?? "—"} />
							</div>
						)}

						{/* Body section */}
						<div className="space-y-2 pt-2">
							<div className="flex items-center justify-between border-b border-border/30 pb-1">
								<span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-mono">
									description
								</span>
								{!isEditingBody && (
									<button
										className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors font-mono"
										onClick={startEditingBody}
									>
										edit
									</button>
								)}
							</div>

							{isEditingBody ? (
								<div className="space-y-2">
									<textarea
										className="w-full resize-y bg-transparent border border-border/50 p-3 text-base leading-[1.7] font-mono placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50"
										rows={12}
										value={bodyDraft}
										onChange={(e) => setBodyDraft(e.target.value)}
										disabled={updating}
										placeholder="# task description (markdown supported)"
									/>
									<div className="flex justify-end gap-3 font-mono text-[11px]">
										<button
											className="text-muted-foreground hover:text-foreground"
											onClick={() => setIsEditingBody(false)}
											disabled={updating}
										>
											cancel
										</button>
										<button
											className="text-primary hover:underline"
											onClick={() => handleUpdate({ description: bodyDraft })}
											disabled={updating}
										>
											save
										</button>
									</div>
								</div>
							) : bodyIsEmpty ? (
								<div
									className="cursor-pointer border border-dashed border-border/30 px-4 py-6 text-center text-[11px] text-muted-foreground/40 hover:border-primary/30 hover:text-muted-foreground transition-all font-mono"
									onClick={startEditingBody}
								>
									› click to add description
								</div>
							) : (
								<div className="pl-1">
									<MarkdownContent content={task.description} />
								</div>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Comments section */}
			<div className="pt-4 border-t border-border/30">
				<div className="mb-4 flex items-center justify-between">
					<span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-mono">
						comments
					</span>
				</div>

				<div className="space-y-6">
					<CommentsTimeline
						comments={comments}
						loading={commentsLoading}
						error={commentsError}
						onRetry={onRetryComments}
					/>
					{task && (
						<div className="pt-2">
							<CommentComposer
								taskId={task.id}
								workspaceId={workspaceId}
								onCommentAdded={onCommentAdded}
							/>
						</div>
					)}
				</div>
			</div>

			{/* Move Task Modal */}
			{task && workspaces && (
				<MoveTaskModal
					isOpen={moveModalOpen}
					onClose={() => setMoveModalOpen(false)}
					task={task}
					workspaces={workspaces}
					onSuccess={() => {
						setMoveModalOpen(false);
						onTaskUpdated?.({ skipWorkspaceRefresh: true });
					}}
				/>
			)}
		</div>
	);
}
