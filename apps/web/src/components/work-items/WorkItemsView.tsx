import { type WorkItem, type WorkItemRun, fetchWorkItemRuns, fetchWorkItems } from "@/api/client";
import { useAppNavigation } from "@/hooks/useNavigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { type ColumnId, RunColumn } from "./RunColumn";
import { RunDetailModal } from "./RunDetailModal";

// Extended work item with latest run info
type WorkItemWithRun = WorkItem & {
	latestRun: WorkItemRun | null;
	latestRunStatus: string | null;
};

// Column definitions
const COLUMNS: { id: ColumnId; title: string; statuses: (string | null)[] }[] = [
	{ id: "not_started", title: "Not Started", statuses: [null] },
	{ id: "queued", title: "Queued", statuses: ["queued"] },
	{ id: "running", title: "Running", statuses: ["running", "launched"] },
	{ id: "completed", title: "Completed", statuses: ["completed"] },
	{ id: "stopped", title: "Stopped", statuses: ["failed", "timed_out", "cancelled", "error"] },
];

// Webhook refresh guard
const WEBHOOK_REFRESH_GUARD_MS = 1000;

type WebhookPayload = {
	type: string;
	taskId?: string;
	projectId?: string;
	workItemId?: string;
};

export function WorkItemsView() {
	const { goToInboxHubTask } = useAppNavigation();
	const [, setLocation] = useLocation();
	const params = useParams<{ projectId: string }>();
	const { projectId } = params;

	// Data state
	const [workItems, setWorkItems] = useState<WorkItemWithRun[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Keyboard navigation state
	const [focusedColumnIndex, setFocusedColumnIndex] = useState(0);
	const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);
	const [keyboardModeActive, setKeyboardModeActive] = useState(false);
	const selectionScrollBehaviorRef = useRef<ScrollBehavior>("smooth");

	// Modal state
	const [modalWorkItem, setModalWorkItem] = useState<WorkItemWithRun | null>(null);

	// Webhook refresh guard
	const webhookRefreshRef = useRef(0);

	// Group work items by latest run status into columns
	const columnData = useMemo(() => {
		return COLUMNS.map((col) => ({
			...col,
			workItems: workItems.filter((wi) => {
				return col.statuses.includes(wi.latestRunStatus);
			}),
		}));
	}, [workItems]);

	// Fetch all work items and their runs
	const fetchData = useCallback(async (signal?: AbortSignal) => {
		try {
			// Fetch work items
			const response = await fetchWorkItems(signal);

			// Fetch runs for each work item in parallel
			const workItemsWithRuns = await Promise.all(
				response.workItems.map(async (wi) => {
					try {
						const runsResponse = await fetchWorkItemRuns(wi.workItemId, signal);
						// Sort runs by createdAt descending to get latest
						const sortedRuns = runsResponse.runs.sort((a, b) => b.createdAt - a.createdAt);
						const latestRun = sortedRuns[0] || null;
						return {
							...wi,
							latestRun,
							latestRunStatus: latestRun?.status || null,
						};
					} catch {
						// If fetching runs fails, treat as no runs
						return {
							...wi,
							latestRun: null,
							latestRunStatus: null,
						};
					}
				}),
			);

			setWorkItems(workItemsWithRuns);
			setError(null);
		} catch (err) {
			if ((err as Error).name === "AbortError") return;
			console.error("Failed to fetch work items:", err);
			setError((err as Error).message || "Failed to load work items");
		} finally {
			setLoading(false);
		}
	}, []);

	// Initial load
	useEffect(() => {
		const controller = new AbortController();
		fetchData(controller.signal);
		return () => controller.abort();
	}, [fetchData]);

	// Webhook stream for real-time updates
	useEffect(() => {
		const eventSource = new EventSource("/admin/webhooks/stream");

		eventSource.onmessage = (event) => {
			try {
				const payload: WebhookPayload = JSON.parse(event.data);

				// Guard against rapid refreshes
				const now = Date.now();
				if (now - webhookRefreshRef.current < WEBHOOK_REFRESH_GUARD_MS) {
					return;
				}
				webhookRefreshRef.current = now;

				// Refresh on relevant events
				if (
					payload.type === "task.updated" ||
					payload.type === "task.created" ||
					payload.type === "run.started" ||
					payload.type === "run.completed" ||
					payload.type === "run.failed" ||
					payload.type === "workItem.created" ||
					payload.type === "workItem.updated"
				) {
					fetchData();
				}
			} catch (err) {
				console.error("Failed to parse webhook:", err);
			}
		};

		eventSource.onerror = () => {
			// EventSource will auto-reconnect
		};

		return () => eventSource.close();
	}, [fetchData]);

	// Handle work item selection
	const handleSelectWorkItem = useCallback(
		(workItemId: string) => {
			setSelectedWorkItemId(workItemId);
			setKeyboardModeActive(true);
			// Find which column contains this work item and focus it
			const columnIndex = columnData.findIndex((col) =>
				col.workItems.some((wi) => wi.workItemId === workItemId),
			);
			if (columnIndex >= 0) {
				setFocusedColumnIndex(columnIndex);
			}
		},
		[columnData],
	);

	// Navigate to roster view on double-click or Enter
	const handleOpenRoster = useCallback(
		(workItem: WorkItemWithRun) => {
			setLocation(`/projects/${projectId}/work-items/${workItem.workItemId}/roster`);
		},
		[setLocation, projectId],
	);

	// Open modal (kept for legacy/fallback)
	const _handleOpenModal = useCallback((workItem: WorkItemWithRun) => {
		setModalWorkItem(workItem);
	}, []);

	// Close modal
	const handleCloseModal = useCallback(() => {
		setModalWorkItem(null);
	}, []);

	// Navigate to task in InboxHub
	const handleNavigateToTask = useCallback(
		(workItem: WorkItemWithRun) => {
			// Use sourceRef.taskUuid to find the task
			goToInboxHubTask(workItem.projectId, workItem.sourceRef.taskUuid);
		},
		[goToInboxHubTask],
	);

	// Keyboard navigation
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Don't intercept if in input field
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return;
			}

			const currentColumn = columnData[focusedColumnIndex];
			const currentWorkItems = currentColumn?.workItems || [];
			const currentIndex = selectedWorkItemId
				? currentWorkItems.findIndex((wi) => wi.workItemId === selectedWorkItemId)
				: -1;

			switch (e.key) {
				case "ArrowLeft":
				case "h": {
					e.preventDefault();
					setKeyboardModeActive(true);
					selectionScrollBehaviorRef.current = "smooth";
					const newIndex = Math.max(0, focusedColumnIndex - 1);
					setFocusedColumnIndex(newIndex);
					const newColumn = columnData[newIndex];
					if (newColumn?.workItems.length > 0) {
						setSelectedWorkItemId(newColumn.workItems[0].workItemId);
					} else {
						setSelectedWorkItemId(null);
					}
					break;
				}

				case "ArrowRight":
				case "l": {
					e.preventDefault();
					setKeyboardModeActive(true);
					selectionScrollBehaviorRef.current = "smooth";
					const newIndex = Math.min(COLUMNS.length - 1, focusedColumnIndex + 1);
					setFocusedColumnIndex(newIndex);
					const newColumn = columnData[newIndex];
					if (newColumn?.workItems.length > 0) {
						setSelectedWorkItemId(newColumn.workItems[0].workItemId);
					} else {
						setSelectedWorkItemId(null);
					}
					break;
				}

				case "ArrowUp":
				case "k": {
					e.preventDefault();
					setKeyboardModeActive(true);
					selectionScrollBehaviorRef.current = "smooth";
					if (currentWorkItems.length > 0) {
						const newIdx = currentIndex > 0 ? currentIndex - 1 : currentWorkItems.length - 1;
						setSelectedWorkItemId(currentWorkItems[newIdx].workItemId);
					}
					break;
				}

				case "ArrowDown":
				case "j": {
					e.preventDefault();
					setKeyboardModeActive(true);
					selectionScrollBehaviorRef.current = "smooth";
					if (currentWorkItems.length > 0) {
						const newIdx = currentIndex < currentWorkItems.length - 1 ? currentIndex + 1 : 0;
						setSelectedWorkItemId(currentWorkItems[newIdx].workItemId);
					}
					break;
				}

				case "Enter": {
					e.preventDefault();
					if (selectedWorkItemId && !modalWorkItem) {
						const wi = currentWorkItems.find((w) => w.workItemId === selectedWorkItemId);
						if (wi) {
							handleOpenRoster(wi);
						}
					}
					break;
				}

				case "Escape": {
					e.preventDefault();
					setKeyboardModeActive(false);
					setSelectedWorkItemId(null);
					break;
				}

				// Quick navigation: 1-5 jumps to column
				case "1":
				case "2":
				case "3":
				case "4":
				case "5": {
					const colIndex = Number.parseInt(e.key) - 1;
					if (colIndex >= 0 && colIndex < COLUMNS.length) {
						e.preventDefault();
						setKeyboardModeActive(true);
						setFocusedColumnIndex(colIndex);
						const col = columnData[colIndex];
						if (col?.workItems.length > 0) {
							setSelectedWorkItemId(col.workItems[0].workItemId);
						} else {
							setSelectedWorkItemId(null);
						}
					}
					break;
				}

				// Refresh
				case "r": {
					if (!e.metaKey && !e.ctrlKey) {
						e.preventDefault();
						setLoading(true);
						fetchData();
					}
					break;
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		columnData,
		focusedColumnIndex,
		selectedWorkItemId,
		modalWorkItem,
		handleOpenRoster,
		fetchData,
	]);

	// Counts for header
	const totalWorkItems = workItems.length;
	const runningCount = columnData.find((c) => c.id === "running")?.workItems.length || 0;
	const queuedCount = columnData.find((c) => c.id === "queued")?.workItems.length || 0;
	const stoppedCount = columnData.find((c) => c.id === "stopped")?.workItems.length || 0;
	const notStartedCount = columnData.find((c) => c.id === "not_started")?.workItems.length || 0;

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full bg-[#0a0e27]">
				<div className="flex flex-col items-center gap-4">
					<div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
					<p className="text-[11px] text-cyan-300/60 uppercase tracking-wider">
						Loading work items...
					</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-full bg-[#0a0e27]">
				<div className="flex flex-col items-center gap-4 max-w-md text-center">
					<div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
						<svg
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							className="text-red-400"
						>
							<circle cx="12" cy="12" r="10" />
							<path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
						</svg>
					</div>
					<p className="text-[13px] text-cyan-100">{error}</p>
					<button
						onClick={() => {
							setLoading(true);
							setError(null);
							fetchData();
						}}
						className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider border border-indigo-700/50 hover:bg-indigo-900/30 transition-colors text-cyan-200"
					>
						Retry
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-screen overflow-hidden bg-[#0a0e27] relative">
			{/* Cyberpunk gradient background */}
			<div
				className="absolute inset-0 opacity-40 pointer-events-none"
				style={{
					backgroundImage: `radial-gradient(circle at 20% 30%, rgba(0, 217, 255, 0.08) 0%, transparent 50%),
                                      radial-gradient(circle at 80% 70%, rgba(167, 139, 250, 0.06) 0%, transparent 40%),
                                      radial-gradient(circle at 50% 50%, rgba(255, 107, 157, 0.04) 0%, transparent 60%)`,
				}}
			/>
			{/* Noise texture overlay */}
			<div
				className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
				style={{
					backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
				}}
			/>

			{/* Header */}
			<header className="relative shrink-0 border-b border-indigo-900/30 bg-[#0d1133]/60 backdrop-blur-sm">
				{/* Top accent line */}
				<div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

				<div className="px-8 py-4">
					<div className="flex items-center justify-between">
						{/* Left: Back + Title */}
						<div className="flex items-center gap-4">
							<Link
								href={`/projects/${projectId}`}
								className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border border-indigo-700/50 hover:bg-indigo-900/30 transition-colors text-cyan-200 rounded"
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									className="text-cyan-400/70"
								>
									<path d="M19 12H5M12 19l-7-7 7-7" />
								</svg>
								Back
							</Link>

							<div className="h-8 w-px bg-indigo-700/50" />

							{/* Project icon */}
							<div className="w-12 h-12 rounded-xl border border-cyan-400/30 flex items-center justify-center bg-gradient-to-br from-cyan-400/10 to-indigo-900/50">
								<svg
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.5"
									className="text-cyan-400"
								>
									<circle cx="12" cy="12" r="10" />
									<polyline points="12 6 12 12 16 14" />
								</svg>
							</div>
							<div>
								<h1 className="text-[18px] font-bold tracking-wide uppercase text-cyan-100">
									Work Items
								</h1>
								<p className="text-[11px] text-cyan-400/70 font-mono tracking-wider">
									{projectId} • Run Execution
								</p>
							</div>
						</div>

						{/* Right: Status indicators */}
						<div className="flex items-center gap-6">
							{/* Not Started indicator */}
							{notStartedCount > 0 && (
								<div className="flex flex-col items-end">
									<div className="flex items-center gap-2">
										<span className="text-[20px] font-bold font-mono tabular-nums text-indigo-400">
											{notStartedCount}
										</span>
									</div>
									<span className="text-[9px] uppercase tracking-widest text-indigo-400/60">
										Pending
									</span>
								</div>
							)}

							{notStartedCount > 0 && <div className="h-8 w-px bg-indigo-700/50" />}

							{/* Running indicator - pulsing */}
							<div className="flex flex-col items-end">
								<div className="flex items-center gap-2">
									{runningCount > 0 && (
										<span className="relative flex h-2 w-2">
											<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
											<span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
										</span>
									)}
									<span className="text-[20px] font-bold font-mono tabular-nums text-cyan-400">
										{runningCount}
									</span>
								</div>
								<span className="text-[9px] uppercase tracking-widest text-indigo-400/60">
									Running
								</span>
							</div>

							<div className="h-8 w-px bg-indigo-700/50" />

							{/* Queued indicator */}
							<div className="flex flex-col items-end">
								<span className="text-[20px] font-bold font-mono tabular-nums text-violet-400">
									{queuedCount}
								</span>
								<span className="text-[9px] uppercase tracking-widest text-indigo-400/60">
									Queued
								</span>
							</div>

							{/* Stopped indicator */}
							{stoppedCount > 0 && (
								<>
									<div className="h-8 w-px bg-indigo-700/50" />
									<div className="flex flex-col items-end">
										<span className="text-[20px] font-bold font-mono tabular-nums text-pink-400">
											{stoppedCount}
										</span>
										<span className="text-[9px] uppercase tracking-widest text-indigo-400/60">
											Stopped
										</span>
									</div>
								</>
							)}

							<div className="h-8 w-px bg-indigo-700/50" />

							{/* Total */}
							<div className="flex flex-col items-end">
								<span className="text-[20px] font-bold font-mono tabular-nums text-indigo-300">
									{totalWorkItems}
								</span>
								<span className="text-[9px] uppercase tracking-widest text-indigo-400/60">
									Total
								</span>
							</div>
						</div>
					</div>
				</div>
			</header>

			{/* Columns container */}
			<div className="flex-1 overflow-x-auto overflow-y-hidden">
				<div className="flex h-full gap-0 p-4">
					{columnData.map((column, index) => (
						<RunColumn
							key={column.id}
							id={column.id}
							title={column.title}
							workItems={column.workItems}
							selectedWorkItemId={focusedColumnIndex === index ? selectedWorkItemId : null}
							isFocused={keyboardModeActive && focusedColumnIndex === index}
							onSelectWorkItem={handleSelectWorkItem}
							onOpenModal={handleOpenRoster}
							selectionScrollBehavior={selectionScrollBehaviorRef.current}
						/>
					))}
				</div>
			</div>

			{/* Footer */}
			<div className="shrink-0 px-8 py-3 border-t border-indigo-900/30 bg-[#0d1133]/60 backdrop-blur-sm relative">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-6 text-[9px] text-indigo-400/60">
						<span>
							<kbd className="px-1.5 py-0.5 bg-indigo-950/50 border border-indigo-800/40 rounded text-[8px] text-cyan-300/70">
								h/l
							</kbd>{" "}
							or{" "}
							<kbd className="px-1.5 py-0.5 bg-indigo-950/50 border border-indigo-800/40 rounded text-[8px] text-cyan-300/70">
								←/→
							</kbd>{" "}
							columns
						</span>
						<span>
							<kbd className="px-1.5 py-0.5 bg-indigo-950/50 border border-indigo-800/40 rounded text-[8px] text-cyan-300/70">
								j/k
							</kbd>{" "}
							or{" "}
							<kbd className="px-1.5 py-0.5 bg-indigo-950/50 border border-indigo-800/40 rounded text-[8px] text-cyan-300/70">
								↑/↓
							</kbd>{" "}
							items
						</span>
						<span>
							<kbd className="px-1.5 py-0.5 bg-indigo-950/50 border border-indigo-800/40 rounded text-[8px] text-cyan-300/70">
								1-5
							</kbd>{" "}
							jump
						</span>
						<span>
							<kbd className="px-1.5 py-0.5 bg-indigo-950/50 border border-indigo-800/40 rounded text-[8px] text-cyan-300/70">
								⏎
							</kbd>{" "}
							open
						</span>
						<span>
							<kbd className="px-1.5 py-0.5 bg-indigo-950/50 border border-indigo-800/40 rounded text-[8px] text-cyan-300/70">
								r
							</kbd>{" "}
							refresh
						</span>
						<span>
							<kbd className="px-1.5 py-0.5 bg-indigo-950/50 border border-indigo-800/40 rounded text-[8px] text-cyan-300/70">
								esc
							</kbd>{" "}
							back to project
						</span>
					</div>
					<div className="text-[9px] text-indigo-400/50 font-mono">
						{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} UTC
					</div>
				</div>
			</div>

			{/* Run Detail Modal */}
			{modalWorkItem && (
				<RunDetailModal
					workItem={modalWorkItem}
					onClose={handleCloseModal}
					onNavigateToInboxHub={() => {
						handleNavigateToTask(modalWorkItem);
						handleCloseModal();
					}}
				/>
			)}
		</div>
	);
}
