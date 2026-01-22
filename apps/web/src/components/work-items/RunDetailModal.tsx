import { type WorkItem, type WorkItemRun, fetchTaskDetail } from "@/api/client";
import { cn } from "@/lib/utils";
import type { TaskDetail } from "@webwrkq/shared";
import { useEffect, useState } from "react";

// Extended work item with latest run info
type WorkItemWithRun = WorkItem & {
	latestRun: WorkItemRun | null;
	latestRunStatus: string | null;
};

type RunDetailModalProps = {
	workItem: WorkItemWithRun;
	onClose: () => void;
	onNavigateToInboxHub: () => void;
};

// Run status styling
const statusStyles: Record<string, { bg: string; text: string; border: string }> = {
	queued: { bg: "bg-cyan-500/15", text: "text-cyan-300", border: "border-cyan-500/40" },
	launched: { bg: "bg-cyan-500/15", text: "text-cyan-300", border: "border-cyan-500/40" },
	running: { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/40" },
	completed: { bg: "bg-zinc-500/15", text: "text-zinc-400", border: "border-zinc-500/40" },
	failed: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/40" },
	error: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/40" },
	timed_out: { bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/40" },
	cancelled: { bg: "bg-zinc-600/15", text: "text-zinc-500", border: "border-zinc-600/40" },
};

const defaultStatusStyle = {
	bg: "bg-zinc-700/20",
	text: "text-zinc-400",
	border: "border-zinc-600/30",
};

function formatTimestamp(ts: number): string {
	return new Date(ts).toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		second: "2-digit",
	});
}

function formatDuration(startMs: number, endMs?: number): string {
	const end = endMs || Date.now();
	const seconds = Math.floor((end - startMs) / 1000);
	if (seconds < 60) return `${seconds}s`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
	const hours = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	return `${hours}h ${mins}m`;
}

function DetailRow({
	label,
	value,
	mono = false,
}: { label: string; value: React.ReactNode; mono?: boolean }) {
	return (
		<div className="flex items-start gap-3 py-2 border-b border-border/20 last:border-0">
			<span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 w-24 shrink-0 pt-0.5">
				{label}
			</span>
			<span
				className={cn("text-[12px] text-foreground/80 break-all", mono && "font-mono text-[11px]")}
			>
				{value}
			</span>
		</div>
	);
}

export function RunDetailModal({ workItem, onClose, onNavigateToInboxHub }: RunDetailModalProps) {
	const [task, setTask] = useState<TaskDetail | null>(null);
	const [taskLoading, setTaskLoading] = useState(true);
	const [taskError, setTaskError] = useState<string | null>(null);

	const run = workItem.latestRun;
	const statusStyle = run?.status
		? statusStyles[run.status] || defaultStatusStyle
		: defaultStatusStyle;

	// Fetch task details
	useEffect(() => {
		const controller = new AbortController();
		setTaskLoading(true);
		setTaskError(null);

		fetchTaskDetail(workItem.projectId, workItem.sourceRef.taskUuid, controller.signal)
			.then((t) => {
				setTask(t);
				setTaskLoading(false);
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				console.error("Failed to fetch task:", err);
				setTaskError((err as Error).message || "Failed to load task");
				setTaskLoading(false);
			});

		return () => controller.abort();
	}, [workItem.projectId, workItem.sourceRef.taskUuid]);

	// Handle escape key
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			{/* Backdrop */}
			<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

			{/* Modal */}
			<div className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden bg-background border border-border/50 shadow-2xl flex flex-col">
				{/* Top accent bar */}
				<div
					className={cn(
						"absolute top-0 left-0 right-0 h-1",
						run?.status === "running" &&
							"bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500",
						run?.status === "queued" && "bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500",
						run?.status === "completed" && "bg-zinc-500",
						run?.status === "failed" && "bg-gradient-to-r from-red-500 via-red-400 to-red-500",
						run?.status === "timed_out" &&
							"bg-gradient-to-r from-orange-500 via-orange-400 to-orange-500",
						!run?.status && "bg-zinc-600",
					)}
				/>

				{/* Header */}
				<div className="px-6 py-4 border-b border-border/30 bg-secondary/30">
					<div className="flex items-start justify-between gap-4">
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-3 mb-2">
								{/* Status badge */}
								<div
									className={cn(
										"flex items-center gap-1.5 px-2.5 py-1 border",
										"text-[10px] font-bold tracking-wider uppercase",
										statusStyle.bg,
										statusStyle.text,
										statusStyle.border,
									)}
								>
									<span
										className={cn(
											"w-2 h-2 rounded-full",
											run?.status === "running" && "bg-emerald-400 animate-pulse",
											run?.status === "queued" && "bg-cyan-400",
											run?.status === "completed" && "bg-zinc-500",
											run?.status === "failed" && "bg-red-400",
											!run?.status && "bg-zinc-500",
										)}
									/>
									{run?.status?.toUpperCase() || "PENDING"}
								</div>

								{/* Project badge */}
								<span className="text-[10px] font-mono text-muted-foreground/60 bg-secondary/60 px-2 py-1 border border-border/30">
									{workItem.projectId}
								</span>
							</div>

							{/* Task title */}
							<h2 className="text-[16px] font-medium text-foreground leading-tight">
								{taskLoading ? (
									<span className="text-muted-foreground/50">Loading task...</span>
								) : task?.title ? (
									task.title
								) : (
									<span className="text-muted-foreground/50">
										Task {workItem.sourceRef.taskUuid.slice(0, 8)}
									</span>
								)}
							</h2>
						</div>

						{/* Close button */}
						<button
							onClick={onClose}
							className="p-2 text-muted-foreground/50 hover:text-foreground hover:bg-secondary/60 transition-colors"
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
							</svg>
						</button>
					</div>
				</div>

				{/* Content - scrollable */}
				<div className="flex-1 overflow-y-auto">
					{/* Run Details Section */}
					<div className="px-6 py-4 border-b border-border/20">
						<h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">
							Run Details
						</h3>

						{run ? (
							<div className="space-y-0">
								<DetailRow label="Run ID" value={run.runId} mono />
								{run.sessionId && <DetailRow label="Session ID" value={run.sessionId} mono />}
								<DetailRow label="Status" value={run.status.toUpperCase()} />
								{run.roleName && <DetailRow label="Role" value={run.roleName} />}
								{run.kind && <DetailRow label="Kind" value={run.kind} />}
								<DetailRow label="Started" value={formatTimestamp(run.createdAt)} />
								{run.completedAt && (
									<DetailRow label="Completed" value={formatTimestamp(run.completedAt)} />
								)}
								<DetailRow
									label="Duration"
									value={formatDuration(run.createdAt, run.completedAt)}
								/>
							</div>
						) : (
							<p className="text-[12px] text-muted-foreground/50 italic">
								No runs yet for this work item
							</p>
						)}
					</div>

					{/* Work Item Details Section */}
					<div className="px-6 py-4 border-b border-border/20">
						<h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">
							Work Item
						</h3>
						<div className="space-y-0">
							<DetailRow label="Work Item ID" value={workItem.workItemId} mono />
							<DetailRow label="Project" value={workItem.projectId} />
							<DetailRow label="Source" value={workItem.sourceKind} />
							<DetailRow label="Created" value={formatTimestamp(workItem.createdAt)} />
							<DetailRow label="Last Activity" value={formatTimestamp(workItem.lastActivityAt)} />
						</div>
					</div>

					{/* Task Details Section */}
					<div className="px-6 py-4">
						<h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">
							Task Details
						</h3>

						{taskLoading ? (
							<div className="flex items-center gap-2 py-4">
								<div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
								<span className="text-[11px] text-muted-foreground/50">
									Loading task details...
								</span>
							</div>
						) : taskError ? (
							<p className="text-[12px] text-red-400/70">{taskError}</p>
						) : task ? (
							<div className="space-y-0">
								<DetailRow label="Task ID" value={task.id} mono />
								<DetailRow label="Title" value={task.title} />
								<DetailRow label="State" value={task.state} />
								<DetailRow label="Priority" value={`P${task.priority}`} />
								{task.kind && <DetailRow label="Kind" value={task.kind} />}
								{task.assignee && <DetailRow label="Assignee" value={task.assignee.slug} />}
								{task.labels && task.labels.length > 0 && (
									<DetailRow
										label="Labels"
										value={
											<div className="flex flex-wrap gap-1">
												{task.labels.map((label) => (
													<span
														key={label}
														className="text-[10px] px-1.5 py-0.5 bg-primary/15 text-primary/80 border border-primary/20"
													>
														{label}
													</span>
												))}
											</div>
										}
									/>
								)}
								{task.description && (
									<div className="pt-3 mt-3 border-t border-border/20">
										<span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 block mb-2">
											Description
										</span>
										<pre className="text-[11px] text-foreground/70 whitespace-pre-wrap font-mono leading-relaxed max-h-[200px] overflow-y-auto">
											{task.description}
										</pre>
									</div>
								)}
							</div>
						) : (
							<p className="text-[12px] text-muted-foreground/50 italic">Task not found</p>
						)}
					</div>
				</div>

				{/* Footer */}
				<div className="px-6 py-3 border-t border-border/30 bg-secondary/20 flex items-center justify-between">
					<div className="text-[9px] font-mono text-muted-foreground/40">
						<kbd className="px-1.5 py-0.5 bg-secondary/60 border border-border/30 rounded">Esc</kbd>{" "}
						to close
					</div>

					<button
						onClick={onNavigateToInboxHub}
						className={cn(
							"flex items-center gap-2 px-4 py-2",
							"text-[11px] font-medium uppercase tracking-wider",
							"border border-primary/40 text-primary hover:bg-primary/10",
							"transition-colors",
						)}
					>
						<span>Open in Inbox Hub</span>
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
						>
							<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
							<polyline points="15 3 21 3 21 9" />
							<line x1="10" y1="14" x2="21" y2="3" />
						</svg>
					</button>
				</div>

				{/* Scan line effect */}
				<div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.01]">
					{[...Array(20)].map((_, i) => (
						<div
							key={i}
							className="absolute left-0 right-0 h-px bg-white"
							style={{ top: `${(i + 1) * 5}%` }}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
