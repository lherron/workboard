import { type ApiClientError, moveTask } from "@/api/client";
import { ErrorBanner } from "@/components/ErrorBanner";
import { formatProjectPath } from "@/lib/taskPaths";
import type { CrossProjectContainersTreeResponse, TaskDetail } from "@webwrkq/shared";
import { useEffect, useMemo, useState } from "react";

type ProjectTree = CrossProjectContainersTreeResponse["projects"][number];

type MoveTaskModalProps = {
	isOpen: boolean;
	onClose: () => void;
	task: TaskDetail;
	workspaces: ProjectTree[];
	onSuccess: () => void;
};

type MoveResult = {
	sourceId: string;
	destinationId: string;
	destinationProject: string;
};

function TerminalToggle({
	checked,
	onChange,
	disabled,
	label,
	hint,
}: {
	checked: boolean;
	onChange: (v: boolean) => void;
	disabled?: boolean;
	label: string;
	hint?: string;
}) {
	return (
		<button
			type="button"
			onClick={() => !disabled && onChange(!checked)}
			disabled={disabled}
			className={`group flex items-start gap-3 text-left w-full py-1.5 transition-colors ${
				disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
			}`}
		>
			<span
				className={`font-mono text-[13px] shrink-0 transition-colors ${
					disabled
						? "text-muted-foreground/30"
						: checked
							? "text-primary"
							: "text-muted-foreground/60 group-hover:text-foreground"
				}`}
			>
				[{checked ? "x" : " "}]
			</span>
			<div className="flex-1 min-w-0">
				<span
					className={`text-[12px] font-mono transition-colors ${
						disabled ? "text-muted-foreground/30" : "text-foreground/80 group-hover:text-foreground"
					}`}
				>
					{label}
				</span>
				{hint && (
					<span className="block text-[10px] text-muted-foreground/40 mt-0.5 font-mono">
						{hint}
					</span>
				)}
			</div>
		</button>
	);
}

function TransferAnimation({ active }: { active: boolean }) {
	if (!active) return null;

	return (
		<div className="flex items-center gap-2 text-[11px] font-mono text-primary/70">
			<span className="inline-flex gap-0.5">
				{[0, 1, 2, 3, 4].map((i) => (
					<span
						key={i}
						className="inline-block w-1.5 h-3 bg-primary/60 animate-pulse"
						style={{ animationDelay: `${i * 100}ms` }}
					/>
				))}
			</span>
			<span className="animate-pulse">transferring...</span>
		</div>
	);
}

function SuccessResult({ result, onClose }: { result: MoveResult; onClose: () => void }) {
	return (
		<div className="space-y-4 py-2">
			<div className="text-center space-y-3">
				<div className="text-[32px] text-primary animate-in zoom-in-50 duration-200">✓</div>
				<div className="text-[13px] font-mono text-foreground">task moved successfully</div>
			</div>

			<div className="bg-secondary/30 border border-border/50 p-4 font-mono text-[11px] space-y-2">
				<div className="flex justify-between">
					<span className="text-muted-foreground/60">source:</span>
					<span className="text-muted-foreground/40 line-through">{result.sourceId}</span>
				</div>
				<div className="flex items-center justify-center gap-2 text-muted-foreground/40 py-1">
					<span>─────</span>
					<span className="text-primary">→</span>
					<span>─────</span>
				</div>
				<div className="flex justify-between">
					<span className="text-muted-foreground/60">destination:</span>
					<span className="text-primary">{result.destinationId}</span>
				</div>
				<div className="flex justify-between pt-1 border-t border-border/30 mt-2">
					<span className="text-muted-foreground/60">project:</span>
					<span className="text-foreground/80">{result.destinationProject}</span>
				</div>
			</div>

			<div className="flex justify-end pt-2">
				<button onClick={onClose} className="text-[11px] font-mono text-primary hover:underline">
					close
				</button>
			</div>
		</div>
	);
}

export function MoveTaskModal({
	isOpen,
	onClose,
	task,
	workspaces,
	onSuccess,
}: MoveTaskModalProps) {
	const [targetProjectId, setTargetProjectId] = useState("");
	const [containerPath, setContainerPath] = useState("inbox");
	const [preserveAssignee, setPreserveAssignee] = useState(true);
	const [preserveState, setPreserveState] = useState(true);
	const [linkRelation, setLinkRelation] = useState(true);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<ApiClientError | null>(null);
	const [result, setResult] = useState<MoveResult | null>(null);

	// Filter out current project from available targets
	const availableProjects = useMemo(() => {
		return workspaces.filter((ws) => ws.projectId !== task.project.slug);
	}, [workspaces, task.project.slug]);

	// Set default target project when modal opens
	useEffect(() => {
		if (isOpen && availableProjects.length > 0 && !targetProjectId) {
			setTargetProjectId(availableProjects[0].projectId);
		}
	}, [isOpen, availableProjects, targetProjectId]);

	// Reset form when modal opens
	useEffect(() => {
		if (isOpen) {
			setContainerPath("inbox");
			setPreserveAssignee(true);
			setPreserveState(true);
			setLinkRelation(true);
			setError(null);
			setResult(null);
			setTargetProjectId("");
		}
	}, [isOpen]);

	// Handle escape key
	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !loading) {
				if (result) {
					onSuccess();
				}
				onClose();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, loading, onClose, onSuccess, result]);

	if (!isOpen) return null;

	// Construct global task ID
	const globalTaskId = task.global_task_id || `${task.project.slug}:${task.id}`;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!targetProjectId) return;

		setLoading(true);
		setError(null);

		try {
			const response = await moveTask(globalTaskId, {
				toProjectId: targetProjectId,
				toContainerPath: containerPath || "inbox",
				preserveAssignee,
				preserveState,
				linkRelation,
			});

			const targetWorkspace = availableProjects.find((ws) => ws.projectId === targetProjectId);

			setResult({
				sourceId: task.id,
				destinationId: response.destination.id,
				destinationProject: targetWorkspace?.projectName || targetProjectId,
			});
		} catch (err) {
			setError(err as ApiClientError);
		} finally {
			setLoading(false);
		}
	};

	const handleClose = () => {
		if (result) {
			onSuccess();
		}
		onClose();
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[3px]">
			<div
				className="w-full max-w-lg border border-border bg-background font-mono animate-in fade-in zoom-in-95 duration-150"
				role="dialog"
				aria-labelledby="move-task-title"
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b border-border px-4 py-3 bg-secondary/50">
					<div className="flex items-center gap-3 min-w-0">
						<h2
							id="move-task-title"
							className="text-[13px] font-medium tracking-wide text-foreground shrink-0"
						>
							<span className="text-primary/70">›</span> move task
						</h2>
						<span className="text-[10px] text-muted-foreground/40 truncate">{task.id}</span>
					</div>
					<button
						onClick={handleClose}
						disabled={loading}
						className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors shrink-0"
					>
						esc
					</button>
				</div>

				{/* Content */}
				<div className="p-5">
					{result ? (
						<SuccessResult result={result} onClose={handleClose} />
					) : (
						<form onSubmit={handleSubmit} className="space-y-5">
							{error && (
								<ErrorBanner
									title="Failed to move task"
									message={error.message}
									detail={typeof error.details === "string" ? error.details : undefined}
								/>
							)}

							{/* Task info */}
							<div className="bg-secondary/20 border border-border/30 px-3 py-2">
								<div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">
									moving
								</div>
								<div className="text-[13px] text-foreground truncate">{task.title}</div>
								<div className="text-[10px] text-muted-foreground/40 mt-1">
									from: {formatProjectPath(task.project.path)}
								</div>
							</div>

							{/* Destination selector */}
							<div className="space-y-4">
								<div className="text-[10px] uppercase tracking-widest text-muted-foreground/50 border-b border-border/30 pb-1">
									destination
								</div>

								{/* Project dropdown */}
								<div className="space-y-1.5">
									<label className="text-[10px] uppercase tracking-widest text-muted-foreground/40">
										project
									</label>
									{availableProjects.length === 0 ? (
										<div className="text-[12px] text-muted-foreground/50 italic py-2">
											no other projects available
										</div>
									) : (
										<div className="relative">
											<select
												value={targetProjectId}
												onChange={(e) => setTargetProjectId(e.target.value)}
												disabled={loading}
												className="w-full appearance-none border border-border/50 bg-secondary/30 px-3 py-2 pr-8 text-[12px] text-foreground focus:outline-none focus:border-primary/50 disabled:opacity-50 cursor-pointer"
											>
												{availableProjects.map((ws) => (
													<option key={ws.projectId} value={ws.projectId}>
														{ws.projectName}
													</option>
												))}
											</select>
											<span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none">
												▾
											</span>
										</div>
									)}
								</div>

								{/* Container path */}
								<div className="space-y-1.5">
									<label className="text-[10px] uppercase tracking-widest text-muted-foreground/40">
										container path
									</label>
									<div className="relative">
										<span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground/40">
											/
										</span>
										<input
											type="text"
											value={containerPath}
											onChange={(e) => setContainerPath(e.target.value)}
											disabled={loading}
											className="w-full border border-border/50 bg-secondary/30 pl-6 pr-3 py-2 text-[12px] placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 disabled:opacity-50"
											placeholder="inbox"
										/>
									</div>
									<p className="text-[9px] text-muted-foreground/40">
										e.g., inbox, features/auth, backlog
									</p>
								</div>
							</div>

							{/* Options */}
							<div className="space-y-2">
								<div className="text-[10px] uppercase tracking-widest text-muted-foreground/50 border-b border-border/30 pb-1">
									options
								</div>

								<div className="space-y-1 pt-1">
									<TerminalToggle
										checked={preserveAssignee}
										onChange={setPreserveAssignee}
										disabled={loading}
										label="preserve assignee"
										hint="keep task assigned to same actor"
									/>
									<TerminalToggle
										checked={preserveState}
										onChange={setPreserveState}
										disabled={loading}
										label="preserve state"
										hint="keep task state (e.g., in_progress)"
									/>
									<TerminalToggle
										checked={linkRelation}
										onChange={setLinkRelation}
										disabled={loading}
										label="create link to original"
										hint="add relates_to relation between tasks"
									/>
									<TerminalToggle
										checked={false}
										onChange={() => {}}
										disabled={true}
										label="copy attachments"
										hint="not supported via API"
									/>
								</div>
							</div>

							{/* Actions */}
							<div className="flex items-center justify-between pt-4 border-t border-border/30">
								<TransferAnimation active={loading} />
								<div className="flex gap-4">
									<button
										type="button"
										onClick={handleClose}
										disabled={loading}
										className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
									>
										cancel
									</button>
									<button
										type="submit"
										disabled={loading || !targetProjectId || availableProjects.length === 0}
										className="text-[11px] text-primary hover:underline disabled:opacity-50 disabled:no-underline font-medium transition-colors"
									>
										{loading ? "moving..." : "move task →"}
									</button>
								</div>
							</div>
						</form>
					)}
				</div>
			</div>
		</div>
	);
}
