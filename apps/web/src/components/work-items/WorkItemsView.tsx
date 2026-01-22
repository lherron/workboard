import { type WorkItem, type WorkItemRun, fetchWorkItemRuns, fetchWorkItems } from "@/api/client";
import { useAppNavigation } from "@/hooks/useNavigation";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
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
			setLocation(`/work-items/${workItem.workItemId}/roster`);
		},
		[setLocation],
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
			<div className="flex items-center justify-center h-full">
				<div className="flex flex-col items-center gap-4">
					<div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
					<p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider">
						Loading work items...
					</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-full">
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
					<p className="text-[13px] text-foreground/80">{error}</p>
					<button
						onClick={() => {
							setLoading(true);
							setError(null);
							fetchData();
						}}
						className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider border border-border/50 hover:bg-secondary/50 transition-colors"
					>
						Retry
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full">
			{/* Header - Industrial ops dashboard style */}
			<header className="relative border-b border-border/40 bg-secondary/30">
				{/* Top accent line */}
				<div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

				<div className="px-6 py-4">
					<div className="flex items-center justify-between">
						{/* Title block */}
						<div className="flex items-center gap-4">
							<div className="flex items-center gap-3">
								{/* Industrial logo/icon */}
								<div className="w-8 h-8 border border-primary/40 flex items-center justify-center bg-primary/5">
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										className="text-primary"
									>
										<circle cx="12" cy="12" r="10" />
										<polyline points="12 6 12 12 16 14" />
									</svg>
								</div>
								<div>
									<h1 className="text-[14px] font-bold tracking-wide uppercase text-foreground">
										Work Items
									</h1>
									<p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
										Run Execution Dashboard
									</p>
								</div>
							</div>
						</div>

						{/* Status indicators */}
						<div className="flex items-center gap-6">
							{/* Not Started indicator */}
							{notStartedCount > 0 && (
								<div className="flex items-center gap-2">
									<span className="w-2 h-2 rounded-full bg-zinc-500" />
									<span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
										{notStartedCount} Pending
									</span>
								</div>
							)}

							{/* Running indicator - pulsing */}
							<div className="flex items-center gap-2">
								<span className="relative flex h-2 w-2">
									{runningCount > 0 && (
										<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
									)}
									<span
										className={cn(
											"relative inline-flex rounded-full h-2 w-2",
											runningCount > 0 ? "bg-emerald-400" : "bg-zinc-600",
										)}
									/>
								</span>
								<span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
									{runningCount} Running
								</span>
							</div>

							{/* Queued indicator */}
							<div className="flex items-center gap-2">
								<span className="w-2 h-2 rounded-full bg-cyan-400" />
								<span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
									{queuedCount} Queued
								</span>
							</div>

							{/* Stopped indicator */}
							{stoppedCount > 0 && (
								<div className="flex items-center gap-2">
									<span className="w-2 h-2 rounded-full bg-red-400" />
									<span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
										{stoppedCount} Stopped
									</span>
								</div>
							)}

							{/* Total */}
							<div className="pl-4 border-l border-border/30">
								<span className="text-[10px] font-mono text-muted-foreground/60">
									{totalWorkItems} total
								</span>
							</div>
						</div>
					</div>

					{/* Keyboard hints */}
					<div className="mt-3 flex items-center gap-4 text-[9px] text-muted-foreground/40">
						<span>
							<kbd className="px-1 py-0.5 bg-secondary/60 border border-border/30 rounded text-[8px]">
								h/l
							</kbd>{" "}
							or{" "}
							<kbd className="px-1 py-0.5 bg-secondary/60 border border-border/30 rounded text-[8px]">
								←/→
							</kbd>{" "}
							columns
						</span>
						<span>
							<kbd className="px-1 py-0.5 bg-secondary/60 border border-border/30 rounded text-[8px]">
								j/k
							</kbd>{" "}
							or{" "}
							<kbd className="px-1 py-0.5 bg-secondary/60 border border-border/30 rounded text-[8px]">
								↑/↓
							</kbd>{" "}
							items
						</span>
						<span>
							<kbd className="px-1 py-0.5 bg-secondary/60 border border-border/30 rounded text-[8px]">
								1-5
							</kbd>{" "}
							jump to column
						</span>
						<span>
							<kbd className="px-1 py-0.5 bg-secondary/60 border border-border/30 rounded text-[8px]">
								Enter
							</kbd>{" "}
							open task
						</span>
						<span>
							<kbd className="px-1 py-0.5 bg-secondary/60 border border-border/30 rounded text-[8px]">
								r
							</kbd>{" "}
							refresh
						</span>
					</div>
				</div>

				{/* Scan line effect */}
				<div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.015]">
					{[...Array(12)].map((_, i) => (
						<div
							key={i}
							className="absolute left-0 right-0 h-px bg-white"
							style={{ top: `${(i + 1) * 8}%` }}
						/>
					))}
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

			{/* Footer - grid pattern and timestamp */}
			<footer className="relative border-t border-border/30 bg-secondary/20 px-6 py-2">
				<div className="flex items-center justify-between text-[9px] text-muted-foreground/40">
					<span className="font-mono">WORK ITEMS v1.0</span>
					<span className="font-mono">
						Last updated:{" "}
						{new Date().toLocaleTimeString("en-US", {
							hour: "numeric",
							minute: "2-digit",
							second: "2-digit",
						})}
					</span>
				</div>

				{/* Grid pattern overlay */}
				<div className="absolute inset-0 pointer-events-none opacity-[0.02]">
					<svg width="100%" height="100%">
						<pattern id="footer-grid" width="16" height="16" patternUnits="userSpaceOnUse">
							<path d="M 16 0 L 0 0 0 16" fill="none" stroke="white" strokeWidth="0.5" />
						</pattern>
						<rect width="100%" height="100%" fill="url(#footer-grid)" />
					</svg>
				</div>
			</footer>

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
