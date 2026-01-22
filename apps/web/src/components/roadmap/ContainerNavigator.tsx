import {
	type ApiClientError,
	fetchTaskDetail,
	fetchWorkspaceContainersTree,
	fetchWorkspaceTasks,
	updateTask,
} from "@/api/client";
import { TaskDetailModal } from "@/components/inbox-hub/TaskDetailModal";
import { useAppNavigation } from "@/hooks/useNavigation";
import { type WebhookTaskPayload, isActionState, useTaskWebhook } from "@/hooks/useTaskWebhook";
import { cn } from "@/lib/utils";
import type {
	ContainerNode,
	CrossProjectContainersTreeResponse,
	TaskDetail,
	TaskListItem,
	TaskState,
	UpdateTaskRequest,
} from "@webwrkq/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ProjectTree = CrossProjectContainersTreeResponse["projects"][number];

type ContainerNavigatorProps = {
	workspaceId: string;
	containerId: string; // This is the container slug/path (e.g., "roadmap")
};

// State styling configuration
const stateConfig: Record<string, { label: string; bg: string; text: string; glow: string }> = {
	idea: {
		label: "IDEA",
		bg: "bg-cyan-500/15",
		text: "text-cyan-400",
		glow: "shadow-[0_0_12px_rgba(34,211,238,0.15)]",
	},
	draft: {
		label: "DRAFT",
		bg: "bg-fuchsia-500/15",
		text: "text-fuchsia-400",
		glow: "shadow-[0_0_12px_rgba(232,121,249,0.15)]",
	},
	open: {
		label: "OPEN",
		bg: "bg-emerald-500/15",
		text: "text-emerald-400",
		glow: "shadow-[0_0_12px_rgba(52,211,153,0.15)]",
	},
	in_progress: {
		label: "ACTIVE",
		bg: "bg-amber-500/15",
		text: "text-amber-400",
		glow: "shadow-[0_0_12px_rgba(251,191,36,0.15)]",
	},
	completed: { label: "DONE", bg: "bg-zinc-600/20", text: "text-zinc-500", glow: "" },
	blocked: {
		label: "BLOCKED",
		bg: "bg-rose-500/15",
		text: "text-rose-400",
		glow: "shadow-[0_0_12px_rgba(244,63,94,0.15)]",
	},
	cancelled: { label: "CANCELLED", bg: "bg-zinc-700/20", text: "text-zinc-600", glow: "" },
	archived: { label: "ARCHIVED", bg: "bg-zinc-800/20", text: "text-zinc-600", glow: "" },
};

// Priority indicators with terminal-style markers
const priorityConfig: Record<number, { marker: string; color: string; label: string }> = {
	1: { marker: "▓▓▓", color: "text-red-400", label: "CRITICAL" },
	2: { marker: "▓▓░", color: "text-amber-400", label: "HIGH" },
	3: { marker: "▓░░", color: "text-sky-400", label: "NORMAL" },
	4: { marker: "░░░", color: "text-zinc-500", label: "LOW" },
};

// State sort order
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

function findContainerByPath(containers: ContainerNode[], path: string): ContainerNode | null {
	for (const container of containers) {
		if (container.slug === path || container.path === path) {
			return container;
		}
		if (container.children && container.children.length > 0) {
			const found = findContainerByPath(container.children, path);
			if (found) return found;
		}
	}
	return null;
}

// Get sibling containers (containers at the same level in the tree)
function getSiblingContainers(containers: ContainerNode[], targetPath: string): ContainerNode[] {
	// Find parent path
	const pathParts = targetPath.split("/");
	if (pathParts.length <= 1) {
		// Top-level containers are siblings of each other
		return containers;
	}

	// Find parent container
	const parentPath = pathParts.slice(0, -1).join("/");
	const parent = findContainerByPath(containers, parentPath);
	return parent?.children || [];
}

export function ContainerNavigator({ workspaceId, containerId }: ContainerNavigatorProps) {
	const { goToGlobalDashboard, goToContainerViewTask, goToContainerView, goToWorkspace } =
		useAppNavigation();

	// Data state
	const [workspace, setWorkspace] = useState<ProjectTree | null>(null);
	const [container, setContainer] = useState<ContainerNode | null>(null);
	const [siblingContainers, setSiblingContainers] = useState<ContainerNode[]>([]);
	const [tasks, setTasks] = useState<TaskListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<ApiClientError | null>(null);
	const [refreshId, setRefreshId] = useState(0);
	const tasksRef = useRef<TaskListItem[]>([]);

	// Navigation state
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [keyboardActive, setKeyboardActive] = useState(false);
	const taskRefs = useRef<(HTMLDivElement | null)[]>([]);
	const scrollContainerRef = useRef<HTMLDivElement>(null);

	// Modal state
	const [modalTask, setModalTask] = useState<TaskDetail | null>(null);
	const [modalTaskLoading, setModalTaskLoading] = useState(false);
	const [modalOpen, setModalOpen] = useState(false);

	// Keep tasksRef in sync for webhook handler
	useEffect(() => {
		tasksRef.current = tasks;
	}, [tasks]);

	// Webhook handler for real-time updates
	const handleWebhookUpdate = useCallback(
		(payload: WebhookTaskPayload) => {
			// Only handle updates for this workspace
			if (payload.project_id !== workspaceId) {
				return;
			}

			// Find matching task in current list
			const taskIndex = tasksRef.current.findIndex(
				(t) => t.id === payload.ticket_id || t.uuid === payload.ticket_uuid,
			);

			if (taskIndex === -1) {
				// Task not in current list - might be new, trigger refresh
				console.info("[ContainerNavigator] webhook: task not found, scheduling refresh", {
					ticketId: payload.ticket_id,
				});
				setRefreshId((prev) => prev + 1);
				return;
			}

			// Task found - check if it should still be visible
			if (!isActionState(payload.state)) {
				// Task moved to non-action state (completed/archived/cancelled) - remove it
				console.info("[ContainerNavigator] webhook: removing task from list", {
					ticketId: payload.ticket_id,
					newState: payload.state,
				});
				setTasks((prev) =>
					prev.filter((t) => t.id !== payload.ticket_id && t.uuid !== payload.ticket_uuid),
				);
				return;
			}

			// Update task in-place
			console.info("[ContainerNavigator] webhook: updating task in-place", {
				ticketId: payload.ticket_id,
				state: payload.state,
			});
			setTasks((prev) =>
				prev.map((t) => {
					if (t.id !== payload.ticket_id && t.uuid !== payload.ticket_uuid) {
						return t;
					}
					return {
						...t,
						state: payload.state ?? t.state,
						priority: payload.priority ?? t.priority,
						kind: payload.kind ?? t.kind,
						run_status: payload.run_status !== undefined ? payload.run_status : t.run_status,
						resolution: payload.resolution !== undefined ? payload.resolution : t.resolution,
						meta: payload.meta !== undefined ? payload.meta : t.meta,
						cp_project_id:
							payload.cp_project_id !== undefined ? payload.cp_project_id : t.cp_project_id,
						cp_run_id: payload.cp_run_id !== undefined ? payload.cp_run_id : t.cp_run_id,
						cp_session_id:
							payload.cp_session_id !== undefined ? payload.cp_session_id : t.cp_session_id,
						sdk_session_id:
							payload.sdk_session_id !== undefined ? payload.sdk_session_id : t.sdk_session_id,
						etag: payload.etag ?? t.etag,
					};
				}),
			);

			// Also update modal task if open and matches
			if (
				modalTask &&
				(modalTask.id === payload.ticket_id || modalTask.uuid === payload.ticket_uuid)
			) {
				setModalTask((prev) => {
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
			}
		},
		[workspaceId, modalTask],
	);

	// Subscribe to webhook updates
	useTaskWebhook({
		onTaskUpdate: handleWebhookUpdate,
		onRefresh: () => setRefreshId((prev) => prev + 1),
	});

	// Fetch workspace and container info
	useEffect(() => {
		const controller = new AbortController();
		setLoading(true);
		setError(null);

		fetchWorkspaceContainersTree(controller.signal)
			.then((resp) => {
				const ws = resp.projects.find((p) => p.projectId === workspaceId);
				if (ws) {
					setWorkspace(ws);
					const cont = findContainerByPath(ws.containers, containerId);
					setContainer(cont);
					// Get sibling containers for h/l navigation
					const siblings = getSiblingContainers(ws.containers, containerId);
					setSiblingContainers(siblings);
				}
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setError(err as ApiClientError);
			});

		return () => controller.abort();
	}, [workspaceId, containerId]);

	// Fetch tasks
	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshId is intentionally used to force re-fetch
	useEffect(() => {
		const controller = new AbortController();

		fetchWorkspaceTasks(
			workspaceId,
			{ filter: "idea,draft,open,in_progress,blocked", sort: "priority", limit: 200 },
			controller.signal,
		)
			.then((resp) => {
				// Filter to container path
				const containerPath = container?.path || containerId;
				const filteredTasks = resp.tasks.filter((task) => {
					const taskPath = task.project?.path || "";
					return taskPath === containerPath || taskPath.startsWith(`${containerPath}/`);
				});

				// Sort by state, then priority
				const sorted = [...filteredTasks].sort((a, b) => {
					const aOrder = STATE_SORT_ORDER[a.state] ?? 99;
					const bOrder = STATE_SORT_ORDER[b.state] ?? 99;
					if (aOrder !== bOrder) return aOrder - bOrder;
					return a.priority - b.priority;
				});

				setTasks(sorted);
				setLoading(false);
				// Auto-select first task when loaded
				if (sorted.length > 0) {
					setSelectedIndex(0);
					setKeyboardActive(true);
				}
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setError(err as ApiClientError);
				setLoading(false);
			});

		return () => controller.abort();
	}, [workspaceId, containerId, container, refreshId]);

	// Get current container index among siblings
	const currentContainerIndex = useMemo(() => {
		return siblingContainers.findIndex((c) => c.slug === containerId || c.path === containerId);
	}, [siblingContainers, containerId]);

	// Modal handlers
	const openTaskModal = useCallback(
		async (taskId: string) => {
			setModalOpen(true);
			setModalTaskLoading(true);
			setModalTask(null);
			try {
				const detail = await fetchTaskDetail(workspaceId, taskId);
				setModalTask(detail);
			} catch (err) {
				console.error("Failed to fetch task detail:", err);
			} finally {
				setModalTaskLoading(false);
			}
		},
		[workspaceId],
	);

	const handleModalClose = useCallback(() => {
		setModalOpen(false);
		setModalTask(null);
	}, []);

	const handleTaskUpdate = useCallback(
		async (
			wsId: string,
			taskId: string,
			updates: UpdateTaskRequest,
			etag: number,
		): Promise<TaskDetail> => {
			const updated = await updateTask(wsId, taskId, updates, etag);
			setModalTask(updated);
			// Also refresh the tasks list to reflect changes
			const controller = new AbortController();
			fetchWorkspaceTasks(
				workspaceId,
				{ filter: "idea,draft,open,in_progress,blocked", sort: "priority", limit: 200 },
				controller.signal,
			).then((resp) => {
				const containerPath = container?.path || containerId;
				const filteredTasks = resp.tasks.filter((task) => {
					const taskPath = task.project?.path || "";
					return taskPath === containerPath || taskPath.startsWith(`${containerPath}/`);
				});
				const sorted = [...filteredTasks].sort((a, b) => {
					const aOrder = STATE_SORT_ORDER[a.state] ?? 99;
					const bOrder = STATE_SORT_ORDER[b.state] ?? 99;
					if (aOrder !== bOrder) return aOrder - bOrder;
					return a.priority - b.priority;
				});
				setTasks(sorted);
			});
			return updated;
		},
		[workspaceId, containerId, container],
	);

	const handleTaskComplete = useCallback(() => {
		// Refresh tasks after completion
		handleModalClose();
		const controller = new AbortController();
		fetchWorkspaceTasks(
			workspaceId,
			{ filter: "idea,draft,open,in_progress,blocked", sort: "priority", limit: 200 },
			controller.signal,
		).then((resp) => {
			const containerPath = container?.path || containerId;
			const filteredTasks = resp.tasks.filter((task) => {
				const taskPath = task.project?.path || "";
				return taskPath === containerPath || taskPath.startsWith(`${containerPath}/`);
			});
			const sorted = [...filteredTasks].sort((a, b) => {
				const aOrder = STATE_SORT_ORDER[a.state] ?? 99;
				const bOrder = STATE_SORT_ORDER[b.state] ?? 99;
				if (aOrder !== bOrder) return aOrder - bOrder;
				return a.priority - b.priority;
			});
			setTasks(sorted);
		});
	}, [workspaceId, containerId, container, handleModalClose]);

	// Keyboard navigation
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

			// Handle Escape specially - close modal first if open
			if (e.key === "Escape") {
				e.preventDefault();
				if (modalOpen) {
					handleModalClose();
				} else {
					goToGlobalDashboard();
				}
				return;
			}

			// Skip other navigation keys if modal is open
			if (modalOpen) return;

			switch (e.key) {
				case "j":
				case "ArrowDown":
					e.preventDefault();
					setKeyboardActive(true);
					setSelectedIndex((prev) => Math.min(prev + 1, tasks.length - 1));
					break;
				case "k":
				case "ArrowUp":
					e.preventDefault();
					setKeyboardActive(true);
					setSelectedIndex((prev) => Math.max(prev - 1, 0));
					break;
				case "h":
				case "ArrowLeft":
					// Navigate to previous sibling container (wraps around)
					e.preventDefault();
					if (siblingContainers.length > 1) {
						const prevIndex =
							currentContainerIndex <= 0 ? siblingContainers.length - 1 : currentContainerIndex - 1;
						const prevContainer = siblingContainers[prevIndex];
						goToContainerView(workspaceId, prevContainer.slug);
					}
					break;
				case "l":
				case "ArrowRight":
					// Navigate to next sibling container (wraps around)
					e.preventDefault();
					if (siblingContainers.length > 1) {
						const nextIndex =
							currentContainerIndex >= siblingContainers.length - 1 ? 0 : currentContainerIndex + 1;
						const nextContainer = siblingContainers[nextIndex];
						goToContainerView(workspaceId, nextContainer.slug);
					}
					break;
				case "Enter":
					e.preventDefault();
					if (tasks[selectedIndex]) {
						// Prefer slug for cleaner URLs
						goToContainerViewTask(workspaceId, containerId, tasks[selectedIndex].slug);
					}
					break;
				case "o":
					// Open task detail modal
					e.preventDefault();
					if (tasks[selectedIndex]) {
						openTaskModal(tasks[selectedIndex].id);
					}
					break;
				case "g":
					// gg to go to top
					if (e.shiftKey === false) {
						setSelectedIndex(0);
						setKeyboardActive(true);
					}
					break;
				case "G":
					// G to go to bottom
					e.preventDefault();
					setSelectedIndex(tasks.length - 1);
					setKeyboardActive(true);
					break;
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [
		tasks,
		selectedIndex,
		workspaceId,
		containerId,
		siblingContainers,
		currentContainerIndex,
		goToContainerViewTask,
		goToContainerView,
		goToGlobalDashboard,
		modalOpen,
		handleModalClose,
		openTaskModal,
	]);

	// Scroll selected task into view
	useEffect(() => {
		if (keyboardActive && taskRefs.current[selectedIndex]) {
			taskRefs.current[selectedIndex]?.scrollIntoView({
				behavior: "smooth",
				block: "nearest",
			});
		}
	}, [selectedIndex, keyboardActive]);

	// Task statistics
	const stats = useMemo(() => {
		const byState: Record<string, number> = {};
		tasks.forEach((t) => {
			byState[t.state] = (byState[t.state] || 0) + 1;
		});
		return byState;
	}, [tasks]);

	const containerTitle = container?.title || containerId;
	const workspaceName = workspace?.projectName || workspaceId;
	const hasSiblings = siblingContainers.length > 1;
	const canGoPrev = currentContainerIndex > 0;
	const canGoNext = currentContainerIndex < siblingContainers.length - 1;

	return (
		<div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
			{/* Atmospheric background effect */}
			<div className="fixed inset-0 pointer-events-none">
				<div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-transparent" />
				<div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/[0.03] blur-[100px] rounded-full" />
			</div>

			{/* Header */}
			<header className="relative z-10 flex-shrink-0 border-b border-border/30">
				<div className="max-w-4xl mx-auto px-6 py-5">
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
							{workspaceName}
						</button>
						<span className="text-muted-foreground/30">/</span>
						<span className="text-foreground/70">{containerTitle}</span>
						{hasSiblings && (
							<span className="text-muted-foreground/40 ml-1">
								({currentContainerIndex + 1}/{siblingContainers.length})
							</span>
						)}
					</div>

					{/* Title row */}
					<div className="flex items-end justify-between gap-6">
						<div className="flex items-center gap-4">
							{/* Back button */}
							<button
								onClick={goToGlobalDashboard}
								className="group w-10 h-10 border border-border/50 flex items-center justify-center bg-secondary/30 hover:bg-secondary/60 hover:border-primary/40 transition-all"
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

							{/* Container title with h/l nav buttons */}
							<div className="flex items-center gap-3">
								{/* Previous sibling button */}
								{hasSiblings && (
									<button
										onClick={() =>
											canGoPrev &&
											goToContainerView(
												workspaceId,
												siblingContainers[currentContainerIndex - 1].slug,
											)
										}
										disabled={!canGoPrev}
										className={cn(
											"w-8 h-8 border flex items-center justify-center transition-all",
											canGoPrev
												? "border-border/50 bg-secondary/30 hover:bg-secondary/60 hover:border-primary/40 text-muted-foreground hover:text-primary"
												: "border-border/20 bg-secondary/10 text-muted-foreground/20 cursor-not-allowed",
										)}
										title={
											canGoPrev
												? `Previous: ${siblingContainers[currentContainerIndex - 1]?.title}`
												: "No previous container"
										}
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
								)}

								<div>
									<h1 className="text-xl font-mono font-medium tracking-tight text-foreground/90">
										{containerTitle}
									</h1>
									<p className="text-[11px] font-mono text-muted-foreground/60 mt-0.5">
										{tasks.length} item{tasks.length !== 1 ? "s" : ""} • {workspaceName}
									</p>
								</div>

								{/* Next sibling button */}
								{hasSiblings && (
									<button
										onClick={() =>
											canGoNext &&
											goToContainerView(
												workspaceId,
												siblingContainers[currentContainerIndex + 1].slug,
											)
										}
										disabled={!canGoNext}
										className={cn(
											"w-8 h-8 border flex items-center justify-center transition-all",
											canGoNext
												? "border-border/50 bg-secondary/30 hover:bg-secondary/60 hover:border-primary/40 text-muted-foreground hover:text-primary"
												: "border-border/20 bg-secondary/10 text-muted-foreground/20 cursor-not-allowed",
										)}
										title={
											canGoNext
												? `Next: ${siblingContainers[currentContainerIndex + 1]?.title}`
												: "No next container"
										}
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
								)}
							</div>
						</div>

						{/* Stats pills */}
						<div className="flex items-center gap-2">
							{Object.entries(stats).map(([state, count]) => {
								const config = stateConfig[state];
								if (!config || count === 0) return null;
								return (
									<div
										key={state}
										className={cn(
											"px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider",
											config.bg,
											config.text,
										)}
									>
										{config.label} {count}
									</div>
								);
							})}
						</div>
					</div>

					{/* Keyboard hints */}
					{keyboardActive && (
						<div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/20">
							<span className="text-[9px] font-mono uppercase tracking-[0.25em] text-amber-400/70">
								nav
							</span>
							<div className="flex items-center gap-2 text-[9px] font-mono text-muted-foreground/40">
								<kbd className="px-1.5 py-0.5 bg-secondary/60 border border-border/30">j/k</kbd>
								<span>tasks</span>
								{hasSiblings && (
									<>
										<kbd className="px-1.5 py-0.5 bg-secondary/60 border border-border/30 ml-2">
											h/l
										</kbd>
										<span>containers</span>
									</>
								)}
								<kbd className="px-1.5 py-0.5 bg-secondary/60 border border-border/30 ml-2">↵</kbd>
								<span>detail</span>
								<kbd className="px-1.5 py-0.5 bg-secondary/60 border border-border/30 ml-2">o</kbd>
								<span>modal</span>
								<kbd className="px-1.5 py-0.5 bg-secondary/60 border border-border/30 ml-2">
									esc
								</kbd>
								<span>back</span>
							</div>
						</div>
					)}
				</div>
			</header>

			{/* Content */}
			<main ref={scrollContainerRef} className="relative z-10 flex-1 overflow-y-auto">
				<div className="max-w-4xl mx-auto px-6 py-8">
					{loading ? (
						<div className="flex flex-col items-center justify-center py-20">
							<div className="relative">
								<div className="w-12 h-12 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
								<div className="absolute inset-0 w-12 h-12 border-2 border-primary/10 rounded-full animate-ping" />
							</div>
							<p className="mt-6 text-[11px] font-mono text-muted-foreground/60 uppercase tracking-[0.2em]">
								Loading...
							</p>
						</div>
					) : error ? (
						<div className="flex flex-col items-center justify-center py-20">
							<div className="w-16 h-16 border border-rose-500/30 bg-rose-500/10 flex items-center justify-center mb-4">
								<span className="text-2xl text-rose-400">!</span>
							</div>
							<p className="text-[12px] font-mono text-rose-400">Failed to load container</p>
							<p className="text-[11px] font-mono text-muted-foreground/50 mt-1">
								{error.message || "Unknown error"}
							</p>
						</div>
					) : tasks.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-20">
							<div className="w-20 h-20 border border-border/40 bg-secondary/30 flex items-center justify-center mb-6">
								<span className="text-3xl text-muted-foreground/30">⌸</span>
							</div>
							<p className="text-[13px] font-mono text-foreground/70 mb-2">No items in container</p>
							<p className="text-[11px] font-mono text-muted-foreground/50">
								Tasks in the <span className="text-primary/70">{containerTitle}</span> container
								will appear here
							</p>
						</div>
					) : (
						<div className="space-y-3">
							{tasks.map((task, index) => {
								const state = stateConfig[task.state] || stateConfig.open;
								const priority = priorityConfig[task.priority] || priorityConfig[3];
								const isSelected = keyboardActive && selectedIndex === index;
								const isActive = task.state === "in_progress";

								return (
									<div
										key={task.id}
										ref={(el) => {
											taskRefs.current[index] = el;
										}}
										onClick={() => {
											setSelectedIndex(index);
											setKeyboardActive(true);
										}}
										onDoubleClick={() => goToContainerViewTask(workspaceId, containerId, task.slug)}
										className={cn(
											"group relative cursor-pointer transition-all duration-200",
											"border bg-secondary/30 hover:bg-secondary/50",
											// Selected state
											isSelected
												? "border-amber-500/50 bg-amber-500/[0.06] ring-1 ring-amber-500/20 ring-offset-1 ring-offset-background"
												: isActive
													? "border-amber-500/30 hover:border-amber-500/40"
													: "border-border/40 hover:border-border/60",
											// Glow effect for active states
											isSelected && state.glow,
											// Completed tasks muted
											(task.state === "completed" ||
												task.state === "archived" ||
												task.state === "cancelled") &&
												"opacity-60",
										)}
										style={{
											animationDelay: `${index * 40}ms`,
										}}
									>
										{/* Left edge indicator */}
										<div
											className={cn(
												"absolute left-0 top-0 bottom-0 w-1 transition-all",
												isSelected
													? "bg-amber-400"
													: isActive
														? "bg-amber-500/60"
														: "bg-transparent group-hover:bg-primary/30",
											)}
										/>

										<div className="p-5 pl-6">
											{/* Top row: State + Priority + ID */}
											<div className="flex items-center justify-between gap-4 mb-3">
												<div className="flex items-center gap-3">
													{/* State badge */}
													<span
														className={cn(
															"text-[10px] font-mono font-medium uppercase tracking-[0.15em] px-2 py-0.5",
															state.bg,
															state.text,
														)}
													>
														{state.label}
													</span>

													{/* Priority indicator */}
													<span
														className={cn("font-mono text-[10px]", priority.color)}
														title={priority.label}
													>
														{priority.marker}
													</span>
												</div>

												{/* Task ID */}
												<span className="text-[10px] font-mono text-muted-foreground/50">
													{task.id}
												</span>
											</div>

											{/* Title */}
											<h3
												className={cn(
													"text-[15px] font-mono leading-relaxed mb-3",
													isSelected
														? "text-foreground"
														: "text-foreground/85 group-hover:text-foreground",
													task.state === "cancelled" && "line-through",
												)}
											>
												{task.title}
											</h3>

											{/* Bottom row: Labels + Due date */}
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													{task.labels &&
														task.labels.length > 0 &&
														task.labels.slice(0, 3).map((label) => (
															<span
																key={label}
																className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 bg-primary/10 text-primary/70 border border-primary/20"
															>
																{label}
															</span>
														))}
													{task.labels && task.labels.length > 3 && (
														<span className="text-[9px] font-mono text-muted-foreground/40">
															+{task.labels.length - 3}
														</span>
													)}
												</div>

												{task.due_at && (
													<span className="text-[10px] font-mono text-muted-foreground/50 flex items-center gap-1.5">
														<svg
															width="10"
															height="10"
															viewBox="0 0 10 10"
															fill="none"
															className="opacity-60"
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
											</div>
										</div>

										{/* Hover action hint */}
										<div
											className={cn(
												"absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity",
												isSelected && "opacity-100",
											)}
										>
											<div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/40">
												<span>double-click or</span>
												<kbd className="px-1.5 py-0.5 bg-secondary/80 border border-border/40 text-muted-foreground/60">
													↵
												</kbd>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>

				{/* Bottom padding for scroll */}
				<div className="h-20" />
			</main>

			{/* Footer status bar */}
			<footer className="relative z-10 flex-shrink-0 border-t border-border/20 bg-secondary/30 backdrop-blur-sm">
				<div className="max-w-4xl mx-auto px-6 py-2.5 flex items-center justify-between">
					<div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground/50">
						<span>{tasks.length} items</span>
						{keyboardActive && (
							<>
								<span className="text-muted-foreground/30">•</span>
								<span className="text-amber-400/70">
									{selectedIndex + 1}/{tasks.length}
								</span>
							</>
						)}
					</div>
					<div className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-[0.15em]">
						container navigator
					</div>
				</div>
			</footer>

			{/* Task Detail Modal */}
			{modalOpen && (
				<TaskDetailModal
					workspaceId={workspaceId}
					workspaceName={workspaceName}
					containerId={containerId}
					containerTitle={containerTitle}
					task={modalTask}
					loading={modalTaskLoading}
					onClose={handleModalClose}
					onTaskUpdate={handleTaskUpdate}
					onTaskComplete={handleTaskComplete}
				/>
			)}
		</div>
	);
}
