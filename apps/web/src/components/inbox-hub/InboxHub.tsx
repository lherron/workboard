import {
	type ApiClientError,
	ackTasks,
	archiveTask,
	createTask,
	deleteContainer,
	deleteTask,
	fetchAllWorkspacesTasks,
	fetchTaskDetail,
	fetchWorkspaceContainersTree,
	launchTerminal,
	moveTask,
	updateTask,
} from "@/api/client";
import { useAppNavigation } from "@/hooks/useNavigation";
import { buildTerminalLaunchRequest, getSessionLaunch } from "@/lib/sessionLaunches";
import type {
	ContainerNode,
	CrossProjectContainersTreeResponse,
	ProjectTaskListItem,
	TaskDetail,
	TaskListItem,
} from "@webwrkq/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiltersetManagementModal } from "./FiltersetManagementModal";
import { InboxColumn, type TaskCreateResult, groupTasksByContainer } from "./InboxColumn";
import { type FilterState, InboxProjectFilterModal } from "./InboxProjectFilterModal";
import { SaveFiltersetModal } from "./SaveFiltersetModal";
import { SettingsPanel } from "./SettingsPanel";
import { TaskDetailModal } from "./TaskDetailModal";
import {
	type FilterSet,
	type FilterSetStorage,
	createFilterset,
	deleteFilterset,
	findMatchingFilterset,
	loadFiltersets,
	saveFiltersets,
	setActiveFilterset,
	setCurrentFilter,
	setDefaultFilterset,
	updateFilterset,
} from "./filtersets";

import { LoadingState, NoInboxesFoundState, NoProjectsSelectedState } from "./EmptyStates";
import { InboxHubHeader } from "./InboxHubHeader";
import { UndoToast } from "./UndoToast";
import { loadCardSize, loadSort, saveSort, sortTasksByState } from "./preferences";
// Extracted modules
import {
	ACTION_STATES,
	type CardSize,
	type InboxData,
	type InboxHubProps,
	type InboxSort,
	WEBHOOK_REFRESH_GUARD_MS,
	type WebhookTaskPayload,
} from "./types";
import { useKeyboardNavigation } from "./useKeyboardNavigation";
import { useUndo } from "./useUndo";

type ProjectTree = CrossProjectContainersTreeResponse["projects"][number];

export function InboxHub({ initialWorkspaceId, initialTaskId }: InboxHubProps) {
	const { goToGlobalDashboard, goToInboxHub, goToInboxHubTask, goToContainerView } =
		useAppNavigation();
	const [workspaceTrees, setWorkspaceTrees] = useState<ProjectTree[]>([]);
	const [workspacesLoading, setWorkspacesLoading] = useState(true);
	const [inboxes, setInboxes] = useState<InboxData[]>([]);
	const inboxesRef = useRef<InboxData[]>([]);
	const [refreshId, setRefreshId] = useState(0);
	const [viewMode, setViewMode] = useState<"action" | "awaiting_ack" | "completed">("action");
	const [filterReady, setFilterReady] = useState(false);
	const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
	const [projectOrder, setProjectOrder] = useState<string[]>([]);
	const [filterModalOpen, setFilterModalOpen] = useState(false);
	const [saveFiltersetModalOpen, setSaveFiltersetModalOpen] = useState(false);
	const [manageFiltersetsModalOpen, setManageFiltersetsModalOpen] = useState(false);
	const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
	const [filtersetStorage, setFiltersetStorage] = useState<FilterSetStorage>(() =>
		loadFiltersets(),
	);
	const webhookRefreshRef = useRef(0);
	const webhookDidUpdateRef = useRef(false);

	// Keyboard navigation state
	const [keyboardModeActive, setKeyboardModeActive] = useState(false);
	const [focusedColumnIndex, setFocusedColumnIndex] = useState(0);
	const [selectedTaskByColumn, setSelectedTaskByColumn] = useState<Record<string, string | null>>(
		{},
	);
	const [suppressSelectionScrollTaskByWorkspace, setSuppressSelectionScrollTaskByWorkspace] =
		useState<Record<string, string | null>>({});
	const [quickAddColumnIndex, setQuickAddColumnIndex] = useState<number | null>(null);
	const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());
	// Use ref for scroll behavior to avoid React state timing issues during wrap-around
	const selectionScrollBehaviorRef = useRef<ScrollBehavior>("smooth");

	// Card size/density state
	const [cardSize, setCardSize] = useState<CardSize>(() => loadCardSize());
	const [cardSizeChanged, setCardSizeChanged] = useState(false);

	// Sort state
	const [sort, setSort] = useState<InboxSort>(() => loadSort());
	const [sortChanged, setSortChanged] = useState(false);

	// Search state
	const [searchQuery, setSearchQuery] = useState("");
	const [searchFocused, setSearchFocused] = useState(false);
	const searchInputRef = useRef<HTMLInputElement>(null);

	// Scroll container ref for instant wrap-around scrolling
	const scrollContainerRef = useRef<HTMLDivElement>(null);

	// Modal state - only stores essential data, display names derived at render
	const [selectedTask, setSelectedTask] = useState<{
		workspaceId: string;
		task: TaskDetail | null;
		loading: boolean;
	} | null>(null);

	// Use the extracted undo hook
	const { undoEntry, undoInProgress, recordUndo, clearUndo, performUndo } = useUndo({ setInboxes });

	// Load task from URL params when they change (NOT when workspaceTrees changes)
	useEffect(() => {
		if (!initialWorkspaceId || !initialTaskId) {
			// No task in URL - ensure modal is closed
			setSelectedTask(null);
			return;
		}

		// Set loading state
		setSelectedTask({
			workspaceId: initialWorkspaceId,
			task: null,
			loading: true,
		});

		// Fetch task details
		const controller = new AbortController();
		fetchTaskDetail(initialWorkspaceId, initialTaskId, controller.signal)
			.then((task) => {
				setSelectedTask((prev) =>
					prev && prev.workspaceId === initialWorkspaceId
						? { ...prev, task, loading: false }
						: prev,
				);
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				console.error("Failed to load task from URL:", err);
				// Clear modal on error (don't navigate - causes infinite loop)
				setSelectedTask(null);
			});

		return () => controller.abort();
	}, [initialWorkspaceId, initialTaskId]);

	// Derive display names from workspaceTrees (recomputed when either changes)
	const selectedTaskDisplay = useMemo(() => {
		if (!selectedTask) return null;

		const workspace = workspaceTrees.find((w) => w.projectId === selectedTask.workspaceId);
		const workspaceName = workspace?.projectName || selectedTask.workspaceId;

		let containerId = "";
		let containerTitle = "Inbox";
		if (workspace && workspace.containers.length > 0) {
			const inboxContainer = workspace.containers.find(
				(c) => c.slug.toLowerCase() === "inbox" || c.title.toLowerCase() === "inbox",
			);
			const container = inboxContainer || workspace.containers[0];
			containerId = container.id;
			containerTitle = container.title;
		}

		return {
			...selectedTask,
			workspaceName,
			containerId,
			containerTitle,
		};
	}, [selectedTask, workspaceTrees]);

	// Load workspace trees
	useEffect(() => {
		inboxesRef.current = inboxes;
	}, [inboxes]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshId is intentionally used to force re-fetch
	useEffect(() => {
		const controller = new AbortController();
		setWorkspacesLoading(true);

		fetchWorkspaceContainersTree(controller.signal)
			.then((resp) => {
				setWorkspaceTrees(resp.projects);
				setWorkspacesLoading(false);
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setWorkspacesLoading(false);
			});

		return () => controller.abort();
	}, [refreshId]);

	const webhookFallbackTimeoutRef = useRef<number | null>(null);

	// Webhook/SSE handler for real-time updates
	useEffect(() => {
		if (import.meta.env.VITE_DISABLE_WEBHOOKS === "1") {
			return;
		}
		const source = new EventSource("/api/webhooks/stream");

		source.onmessage = (event) => {
			if (!event.data) return;
			let payload: WebhookTaskPayload;
			try {
				payload = JSON.parse(event.data) as WebhookTaskPayload;
			} catch {
				return;
			}

			const now = Date.now();
			const scheduleRefresh = () => {
				if (now - webhookRefreshRef.current < WEBHOOK_REFRESH_GUARD_MS) return;
				webhookRefreshRef.current = now;
				console.info("[webhook] scheduling refresh", {
					ticketId: payload.ticket_id,
					projectId: payload.project_id,
					state: payload.state,
					viewMode,
				});
				setRefreshId((prev) => prev + 1);
			};

			if (!payload.ticket_id || !payload.project_id) {
				scheduleRefresh();
				return;
			}

			if (viewMode !== "action") {
				console.info("[webhook] refresh: non-action view", {
					ticketId: payload.ticket_id,
					projectId: payload.project_id,
					viewMode,
				});
				scheduleRefresh();
				return;
			}

			const compositeId = payload.project_id
				? `${payload.project_id}:${payload.ticket_id}`
				: undefined;
			const matchesWebhookTask = (task: ProjectTaskListItem) => {
				const globalTaskId = (task as { global_task_id?: string }).global_task_id;
				return (
					task.id === payload.ticket_id ||
					(compositeId && task.id === compositeId) ||
					(payload.ticket_uuid && task.uuid === payload.ticket_uuid) ||
					globalTaskId === payload.ticket_id ||
					(compositeId && globalTaskId === compositeId)
				);
			};

			webhookDidUpdateRef.current = false;
			const hasInboxMatch = () =>
				inboxesRef.current.some((inbox) => inbox.tasks.some(matchesWebhookTask));
			setInboxes((prev) => {
				const next = prev.map((inbox) => {
					const taskIndex = inbox.tasks.findIndex(matchesWebhookTask);
					if (taskIndex === -1) return inbox;

					const existing = inbox.tasks[taskIndex];
					const nextTask = {
						...existing,
						state: payload.state ?? existing.state,
						priority: payload.priority ?? existing.priority,
						kind: payload.kind ?? existing.kind,
						run_status: payload.run_status !== undefined ? payload.run_status : existing.run_status,
						resolution: payload.resolution !== undefined ? payload.resolution : existing.resolution,
						meta: payload.meta !== undefined ? payload.meta : existing.meta,
						cp_project_id:
							payload.cp_project_id !== undefined ? payload.cp_project_id : existing.cp_project_id,
						cp_run_id: payload.cp_run_id !== undefined ? payload.cp_run_id : existing.cp_run_id,
						cp_session_id:
							payload.cp_session_id !== undefined ? payload.cp_session_id : existing.cp_session_id,
						sdk_session_id:
							payload.sdk_session_id !== undefined
								? payload.sdk_session_id
								: existing.sdk_session_id,
						blocked_by: payload.blocked_by ?? [],
						etag: payload.etag ?? existing.etag,
					} as ProjectTaskListItem;

					webhookDidUpdateRef.current = true;

					if (!ACTION_STATES.has(nextTask.state)) {
						console.info("[webhook] removing task from action list", {
							ticketId: payload.ticket_id,
							state: nextTask.state,
							workspaceId: inbox.workspaceId,
						});
						return { ...inbox, tasks: inbox.tasks.filter((task) => !matchesWebhookTask(task)) };
					}

					const nextTasks = [...inbox.tasks];
					nextTasks[taskIndex] = nextTask;
					return { ...inbox, tasks: nextTasks };
				});

				return next;
			});

			setSelectedTask((prev) => {
				if (!prev?.task) return prev;
				const prevGlobalTaskId = (prev.task as { global_task_id?: string }).global_task_id;
				const matchesSelected =
					prev.task.id === payload.ticket_id ||
					(compositeId && prev.task.id === compositeId) ||
					(payload.ticket_uuid && prev.task.uuid === payload.ticket_uuid) ||
					prevGlobalTaskId === payload.ticket_id ||
					(compositeId && prevGlobalTaskId === compositeId);
				if (!matchesSelected) return prev;
				return {
					...prev,
					task: {
						...prev.task,
						state: payload.state ?? prev.task.state,
						priority: payload.priority ?? prev.task.priority,
						kind: payload.kind ?? prev.task.kind,
						run_status:
							payload.run_status !== undefined ? payload.run_status : prev.task.run_status,
						resolution:
							payload.resolution !== undefined ? payload.resolution : prev.task.resolution,
						meta: payload.meta !== undefined ? payload.meta : prev.task.meta,
						cp_project_id:
							payload.cp_project_id !== undefined ? payload.cp_project_id : prev.task.cp_project_id,
						cp_run_id: payload.cp_run_id !== undefined ? payload.cp_run_id : prev.task.cp_run_id,
						cp_session_id:
							payload.cp_session_id !== undefined ? payload.cp_session_id : prev.task.cp_session_id,
						sdk_session_id:
							payload.sdk_session_id !== undefined
								? payload.sdk_session_id
								: prev.task.sdk_session_id,
						etag: payload.etag ?? prev.task.etag,
					},
				};
			});

			if (webhookFallbackTimeoutRef.current) {
				clearTimeout(webhookFallbackTimeoutRef.current);
			}
			webhookFallbackTimeoutRef.current = window.setTimeout(() => {
				if (webhookDidUpdateRef.current) return;
				const refMatch = hasInboxMatch();
				if (refMatch) {
					console.info("[webhook] visible inbox match found via ref after delay; skip refresh", {
						ticketId: payload.ticket_id,
						projectId: payload.project_id,
						state: payload.state,
					});
					return;
				}
				console.info("[webhook] refresh: task not found in visible inboxes", {
					ticketId: payload.ticket_id,
					projectId: payload.project_id,
					state: payload.state,
				});
				console.info("[webhook] visible inbox snapshot (ref)", {
					refMatch,
					inboxes: inboxesRef.current.map((inbox) => ({
						workspaceId: inbox.workspaceId,
						taskCount: inbox.tasks.length,
						taskIds: inbox.tasks.map((task) => ({
							id: task.id,
							uuid: task.uuid,
							global_task_id: (task as { global_task_id?: string }).global_task_id ?? null,
						})),
					})),
				});
				// NOTE: Disabled hard refresh for off-screen tasks - re-enable if needed
				// scheduleRefresh();
			}, 150);
		};

		source.onerror = (err) => {
			console.warn("Webhook stream error:", err);
		};

		return () => {
			source.close();
			if (webhookFallbackTimeoutRef.current) {
				clearTimeout(webhookFallbackTimeoutRef.current);
				webhookFallbackTimeoutRef.current = null;
			}
		};
	}, [viewMode]);

	// Initialize project filter from current state, default filterset, or default to all
	useEffect(() => {
		if (workspacesLoading) return;

		let storedSelection: Set<string> | null = null;
		let storedOrder: string[] | null = null;
		const allProjectIds = workspaceTrees.map((w) => w.projectId);
		const allProjectIdSet = new Set(allProjectIds);

		const storage = loadFiltersets();

		// First priority: current working filter state
		if (storage.current) {
			const validSelected = storage.current.selected.filter((id) => allProjectIdSet.has(id));
			const validOrder = storage.current.order.filter((id) => allProjectIdSet.has(id));
			const missingFromOrder = allProjectIds.filter((id) => !validOrder.includes(id));
			storedSelection = new Set(validSelected);
			storedOrder = [...validOrder, ...missingFromOrder];
			setFiltersetStorage(storage);
		}

		// Second priority: default filterset
		if (storedSelection === null && storage.defaultId) {
			const defaultFilterset = storage.filtersets.find((fs) => fs.id === storage.defaultId);
			if (defaultFilterset) {
				storedSelection = new Set(
					defaultFilterset.selected.filter((id) => allProjectIdSet.has(id)),
				);
				const validOrder = defaultFilterset.order.filter((id) => allProjectIdSet.has(id));
				const missingFromOrder = allProjectIds.filter((id) => !validOrder.includes(id));
				storedOrder = [...validOrder, ...missingFromOrder];
				// Update activeId to match default
				setFiltersetStorage({ ...storage, activeId: storage.defaultId });
			}
		}

		// Fallback: all projects
		if (storedSelection === null) {
			storedSelection = allProjectIdSet;
		}
		if (storedOrder === null) {
			storedOrder = allProjectIds;
		}

		setSelectedProjects(storedSelection);
		setProjectOrder(storedOrder);
		setFilterReady(true);
	}, [workspacesLoading, workspaceTrees]);

	const visibleWorkspaceTrees = useMemo(() => {
		if (!filterReady) return workspaceTrees;
		if (selectedProjects.size === 0) return [];
		const wsMap = new Map(workspaceTrees.map((w) => [w.projectId, w]));
		// Use projectOrder for sorting, filter by selected
		return projectOrder
			.filter((id) => selectedProjects.has(id))
			.map((id) => wsMap.get(id))
			.filter((w): w is ProjectTree => w !== undefined);
	}, [filterReady, selectedProjects, projectOrder, workspaceTrees]);

	const totalWorkspaceCount = workspaceTrees.length;
	const visibleWorkspaceCount = visibleWorkspaceTrees.length;
	const isFilterActive =
		filterReady && totalWorkspaceCount > 0 && selectedProjects.size !== totalWorkspaceCount;

	// Compute active filterset and whether current filter is custom
	const matchingFilterset = useMemo(() => {
		if (!filterReady) return null;
		return findMatchingFilterset(filtersetStorage, selectedProjects, projectOrder);
	}, [filterReady, filtersetStorage, selectedProjects, projectOrder]);

	const activeFilterset = useMemo(() => {
		if (matchingFilterset) return matchingFilterset;
		if (filtersetStorage.activeId) {
			return filtersetStorage.filtersets.find((fs) => fs.id === filtersetStorage.activeId) || null;
		}
		return null;
	}, [matchingFilterset, filtersetStorage]);

	const isFilterCustom =
		filterReady && !matchingFilterset && (isFilterActive || filtersetStorage.activeId !== null);

	const searchQueryNormalized = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);
	const isSearchActive = searchQueryNormalized.length > 0;
	const searchMatchesByWorkspace = useMemo(() => {
		if (!isSearchActive) return new Map<string, Set<string>>();
		const matches = new Map<string, Set<string>>();
		inboxes.forEach((inbox) => {
			const taskMatches = new Set<string>();
			inbox.tasks.forEach((task) => {
				const haystack = `${task.title} ${task.id}`.toLowerCase();
				if (haystack.includes(searchQueryNormalized)) {
					taskMatches.add(task.id);
				}
			});
			matches.set(inbox.workspaceId, taskMatches);
		});
		return matches;
	}, [inboxes, isSearchActive, searchQueryNormalized]);
	const singleSearchMatch = useMemo(() => {
		if (!isSearchActive) return null;
		let match: {
			workspaceId: string;
			workspaceName: string;
			containerId: string;
			containerTitle: string;
			taskId: string;
			columnIndex: number;
		} | null = null;
		let count = 0;
		inboxes.forEach((inbox, index) => {
			inbox.tasks.forEach((task) => {
				const haystack = `${task.title} ${task.id}`.toLowerCase();
				if (haystack.includes(searchQueryNormalized)) {
					count += 1;
					if (count === 1) {
						match = {
							workspaceId: inbox.workspaceId,
							workspaceName: inbox.workspaceName,
							containerId: inbox.containerId,
							containerTitle: inbox.containerTitle,
							taskId: task.id,
							columnIndex: index,
						};
					}
				}
			});
		});
		return count === 1 ? match : null;
	}, [inboxes, isSearchActive, searchQueryNormalized]);

	const _applyTaskUpdate = useCallback((workspaceId: string, updated: TaskDetail) => {
		setInboxes((prev) =>
			prev.map((inbox) =>
				inbox.workspaceId === workspaceId
					? {
							...inbox,
							tasks: inbox.tasks.map((task) =>
								task.id === updated.id
									? {
											...task,
											title: updated.title,
											state: updated.state,
											priority: updated.priority,
											labels: updated.labels,
											due_at: updated.due_at,
											run_status: updated.run_status,
											cp_session_id: updated.cp_session_id,
											cp_run_id: updated.cp_run_id,
											sdk_session_id: updated.sdk_session_id,
											updated_at: updated.updated_at,
											etag: updated.etag,
										}
									: task,
							),
						}
					: inbox,
			),
		);
		setSelectedTask((prev) =>
			prev && prev.workspaceId === workspaceId && prev.task?.id === updated.id
				? { ...prev, task: updated }
				: prev,
		);
	}, []);

	const applyTaskRunUpdate = useCallback(
		(
			workspaceId: string,
			taskId: string,
			updates: {
				run_status?: TaskListItem["run_status"];
				cp_run_id?: TaskListItem["cp_run_id"];
				cp_session_id?: TaskListItem["cp_session_id"];
			},
		) => {
			setInboxes((prev) =>
				prev.map((inbox) =>
					inbox.workspaceId === workspaceId
						? {
								...inbox,
								tasks: inbox.tasks.map((task) =>
									task.id === taskId
										? {
												...task,
												...updates,
											}
										: task,
								),
							}
						: inbox,
				),
			);
			setSelectedTask((prev) =>
				prev && prev.workspaceId === workspaceId && prev.task?.id === taskId
					? { ...prev, task: { ...prev.task, ...updates } }
					: prev,
			);
		},
		[],
	);

	// Find inbox container for each workspace and load their tasks
	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshId is intentionally used to force re-fetch
	useEffect(() => {
		// Wait until both workspace tree and filter are ready to avoid race condition
		// where the effect fires twice in quick succession, aborting in-flight requests
		if (workspacesLoading || !filterReady) return;
		const controller = new AbortController();

		// Find one inbox per workspace (prefer container named "inbox", fallback to first container)
		const inboxContainers: {
			workspaceId: string;
			workspaceName: string;
			container: ContainerNode;
		}[] = [];

		visibleWorkspaceTrees.forEach((ws) => {
			if (ws.containers.length === 0) return;

			// Look for a container named "inbox" at root level
			const inboxContainer = ws.containers.find(
				(c) => c.slug.toLowerCase() === "inbox" || c.title.toLowerCase() === "inbox",
			);

			// Use inbox if found, otherwise use first container
			const container = inboxContainer || ws.containers[0];

			inboxContainers.push({
				workspaceId: ws.projectId,
				workspaceName: ws.projectName,
				container,
			});
		});

		// Initialize inbox data
		const getContainerTitle = (containerTitle: string) => {
			if (viewMode === "awaiting_ack") return "Awaiting Ack";
			if (viewMode === "completed") return "Completed";
			return containerTitle;
		};

		setInboxes(
			inboxContainers.map((ic) => ({
				workspaceId: ic.workspaceId,
				workspaceName: ic.workspaceName,
				containerId: ic.container.id,
				containerTitle: getContainerTitle(ic.container.title),
				containerPath: ic.container.path,
				childContainers: ic.container.children || [],
				tasks: [],
				loading: true,
				error: null,
			})),
		);

		if (viewMode === "awaiting_ack") {
			fetchAllWorkspacesTasks(
				{
					filter: "completed,cancelled",
					sort: "updated_at",
					limit: 500,
					includeDescriptionLines: cardSize === "expanded" ? 10 : undefined,
				},
				controller.signal,
			)
				.then((resp) => {
					const ackTasks = resp.tasks.filter(
						(task) =>
							(task.state === "completed" || task.state === "cancelled") &&
							task.acknowledged_at == null,
					);
					setInboxes((prev) =>
						prev.map((inbox) => ({
							...inbox,
							tasks: ackTasks.filter((task) => task.requested_by_project_id === inbox.workspaceId),
							loading: false,
							error: null,
						})),
					);
				})
				.catch((err) => {
					if ((err as Error).name === "AbortError") return;
					setInboxes((prev) =>
						prev.map((inbox) => ({ ...inbox, loading: false, error: err as ApiClientError })),
					);
				});

			return () => controller.abort();
		}

		if (viewMode === "completed") {
			fetchAllWorkspacesTasks(
				{
					filter: "completed,cancelled",
					sort: "updated_at",
					limit: 500,
					includeDescriptionLines: cardSize === "expanded" ? 10 : undefined,
				},
				controller.signal,
			)
				.then((resp) => {
					setInboxes((prev) =>
						prev.map((inbox) => ({
							...inbox,
							tasks: resp.tasks.filter((task) => task.projectId === inbox.workspaceId),
							loading: false,
							error: null,
						})),
					);
				})
				.catch((err) => {
					if ((err as Error).name === "AbortError") return;
					setInboxes((prev) =>
						prev.map((inbox) => ({ ...inbox, loading: false, error: err as ApiClientError })),
					);
				});

			return () => controller.abort();
		}

		// Build a map of workspaceId -> containerPath for client-side filtering
		const containerPathMap = new Map<string, string | undefined>();
		inboxContainers.forEach((ic) => {
			containerPathMap.set(ic.workspaceId, ic.container.path);
		});

		// Single API call for all actionable tasks across all workspaces
		fetchAllWorkspacesTasks(
			{
				filter: "idea,draft,open,in_progress,blocked",
				sort: "priority",
				limit: 500,
				includeDescriptionLines: cardSize === "expanded" ? 10 : undefined,
			},
			controller.signal,
		)
			.then((resp) => {
				setInboxes((prev) =>
					prev.map((inbox) => {
						const containerPath = containerPathMap.get(inbox.workspaceId);
						// Filter tasks for this workspace and container
						const workspaceTasks = resp.tasks.filter((task) => {
							if (task.projectId !== inbox.workspaceId) return false;
							// Filter by container path
							const taskPath = task.project?.path || "";
							if (!containerPath) return true;
							return taskPath === containerPath || taskPath.startsWith(`${containerPath}/`);
						});
						// Apply client-side sorting if sort is 'state'
						const sortedTasks =
							sort === "state" ? sortTasksByState(workspaceTasks) : workspaceTasks;
						return { ...inbox, tasks: sortedTasks, loading: false, error: null };
					}),
				);
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setInboxes((prev) =>
					prev.map((inbox) => ({ ...inbox, loading: false, error: err as ApiClientError })),
				);
			});

		return () => controller.abort();
	}, [visibleWorkspaceTrees, workspacesLoading, filterReady, refreshId, viewMode, sort, cardSize]);

	const handleTaskComplete = useCallback(
		async (workspaceId: string, task: ProjectTaskListItem | TaskListItem) => {
			const taskKey = `${workspaceId}:${task.id}`;
			const prevState = task.state;
			const prevPriority = task.priority;
			const prevEtag = task.etag;

			// Find previous task to select before we remove this one (use visual order for consistency)
			const inbox = inboxes.find((i) => i.workspaceId === workspaceId);
			let nextTaskId: string | null = null;
			if (inbox) {
				// Use visual task order (grouped by container) for consistent navigation
				const groupedTasks = groupTasksByContainer(
					inbox.tasks,
					inbox.containerPath,
					inbox.childContainers,
				);
				const visualTaskOrder = groupedTasks.flatMap((group) => group.tasks);
				const taskIndex = visualTaskOrder.findIndex((t) => t.id === task.id);
				if (taskIndex !== -1) {
					// Prefer previous task (move up), fall back to next
					if (taskIndex > 0) {
						nextTaskId = visualTaskOrder[taskIndex - 1].id;
					} else if (taskIndex < visualTaskOrder.length - 1) {
						nextTaskId = visualTaskOrder[taskIndex + 1].id;
					}
				}
			}

			// Start animation
			setCompletingTasks((prev) => new Set(prev).add(taskKey));

			// Wait for animation to complete (280ms animation + small buffer)
			await new Promise((resolve) => setTimeout(resolve, 300));

			try {
				const updated = await updateTask(workspaceId, task.id, { state: "completed" }, task.etag);
				// Remove from list after animation
				setInboxes((prev) =>
					prev.map((inb) =>
						inb.workspaceId === workspaceId
							? { ...inb, tasks: inb.tasks.filter((t) => t.id !== task.id) }
							: inb,
					),
				);

				// Record undo entry
				recordUndo({
					workspaceId,
					taskId: task.id,
					taskTitle: task.title,
					prev: { state: prevState, priority: prevPriority, etag: prevEtag },
					next: { state: "completed", priority: updated.priority, etag: updated.etag },
					wasArchived: false,
					timestamp: Date.now(),
				});

				// Select next task in column (if keyboard mode active)
				if (keyboardModeActive && nextTaskId) {
					setSelectedTaskByColumn((prev) => ({
						...prev,
						[workspaceId]: nextTaskId,
					}));
				}
			} catch (err) {
				console.error("Failed to complete task:", err);
			} finally {
				// Clean up completing state
				setCompletingTasks((prev) => {
					const next = new Set(prev);
					next.delete(taskKey);
					return next;
				});
			}
		},
		[inboxes, keyboardModeActive, recordUndo],
	);

	const handleTaskArchive = useCallback(
		async (workspaceId: string, task: ProjectTaskListItem | TaskListItem) => {
			const prevState = task.state;
			const prevPriority = task.priority;
			const prevEtag = task.etag;

			const inbox = inboxes.find((i) => i.workspaceId === workspaceId);
			let nextTaskId: string | null = null;
			if (inbox) {
				const groupedTasks = groupTasksByContainer(
					inbox.tasks,
					inbox.containerPath,
					inbox.childContainers,
				);
				const visualTaskOrder = groupedTasks.flatMap((group) => group.tasks);
				const taskIndex = visualTaskOrder.findIndex((t) => t.id === task.id);
				if (taskIndex !== -1) {
					if (taskIndex > 0) {
						nextTaskId = visualTaskOrder[taskIndex - 1].id;
					} else if (taskIndex < visualTaskOrder.length - 1) {
						nextTaskId = visualTaskOrder[taskIndex + 1].id;
					}
				}
			}

			try {
				const archived = await archiveTask(workspaceId, task.id, task.etag);
				setInboxes((prev) =>
					prev.map((inb) =>
						inb.workspaceId === workspaceId
							? { ...inb, tasks: inb.tasks.filter((t) => t.id !== task.id) }
							: inb,
					),
				);

				// Record undo entry for archive
				recordUndo({
					workspaceId,
					taskId: task.id,
					taskTitle: task.title,
					prev: { state: prevState, priority: prevPriority, etag: prevEtag },
					next: { state: "archived", priority: archived.priority, etag: archived.etag },
					wasArchived: true,
					timestamp: Date.now(),
				});

				if (keyboardModeActive && nextTaskId) {
					setSelectedTaskByColumn((prev) => ({
						...prev,
						[workspaceId]: nextTaskId,
					}));
				}
			} catch (err) {
				console.error("Failed to archive task:", err);
			}
		},
		[inboxes, keyboardModeActive, recordUndo],
	);

	const handleTaskAcknowledge = useCallback(
		async (workspaceId: string, task: ProjectTaskListItem | TaskListItem) => {
			try {
				const globalTaskId = (task as { global_task_id?: string }).global_task_id;
				const projectId = (task as { project?: { id?: string } }).project?.id;
				const taskId = globalTaskId || (projectId ? `${projectId}:${task.id}` : task.id);
				await ackTasks({ task_ids: [taskId] });
				// Optimistically remove from list
				setInboxes((prev) =>
					prev.map((inbox) =>
						inbox.workspaceId === workspaceId
							? { ...inbox, tasks: inbox.tasks.filter((t) => t.id !== task.id) }
							: inbox,
					),
				);
			} catch (err) {
				console.error("Failed to acknowledge task:", err);
			}
		},
		[],
	);

	// Helper to find a container by path in the children tree
	const findContainerByPath = useCallback(
		(containers: ContainerNode[], targetPath: string): ContainerNode | null => {
			for (const container of containers) {
				if (container.path === targetPath) {
					return container;
				}
				if (container.children && container.children.length > 0) {
					const found = findContainerByPath(container.children, targetPath);
					if (found) return found;
				}
			}
			return null;
		},
		[],
	);

	const handleTaskCreate = useCallback(
		async (
			workspaceId: string,
			containerId: string,
			title: string,
			description?: string,
			targetContainerPath?: string,
		): Promise<TaskCreateResult> => {
			try {
				// Resolve targetContainerPath to actual container ID if provided
				let effectiveContainerId = containerId;
				if (targetContainerPath) {
					// Look up the container in the inbox's child containers
					const inbox = inboxes.find((i) => i.workspaceId === workspaceId);
					if (inbox) {
						const targetContainer = findContainerByPath(inbox.childContainers, targetContainerPath);
						if (targetContainer) {
							effectiveContainerId = targetContainer.id;
						} else {
							// Fallback to using path directly (API might accept it)
							effectiveContainerId = targetContainerPath;
						}
					}
				}
				const created = await createTask(workspaceId, effectiveContainerId, {
					title,
					description,
					priority: 4,
					state: "draft",
				});
				// Optimistically add to local state instead of full refresh
				const newTask: ProjectTaskListItem = {
					uuid: created.uuid,
					id: created.id,
					slug: created.slug,
					title: created.title,
					state: created.state,
					priority: created.priority,
					kind: created.kind,
					requested_by_project_id: created.requested_by_project_id,
					assigned_project_id: created.assigned_project_id,
					acknowledged_at: created.acknowledged_at,
					resolution: created.resolution,
					parent_task_uuid: created.parent_task?.uuid ?? null,
					assignee: created.assignee,
					due_at: created.due_at,
					labels: created.labels,
					meta: created.meta,
					updated_at: created.updated_at,
					etag: created.etag,
					project: created.project,
				};
				setInboxes((prev) =>
					prev.map((inbox) =>
						inbox.workspaceId === workspaceId && inbox.containerId === containerId
							? { ...inbox, tasks: [...inbox.tasks, newTask] }
							: inbox,
					),
				);
				return {
					success: true,
					taskId: created.id,
					taskSlug: created.slug,
					taskTitle: created.title,
				};
			} catch (err) {
				console.error("Failed to create task:", err);
				const apiError = err as ApiClientError;
				if (apiError.status === 409) {
					return {
						success: false,
						error: "A task with this name already exists in this container",
					};
				}
				return { success: false, error: apiError.message || "Failed to create task" };
			}
		},
		[inboxes, findContainerByPath],
	);

	const handleTaskClick = useCallback(
		(
			workspaceId: string,
			_workspaceName: string,
			_containerId: string,
			_containerTitle: string,
			taskId: string,
		) => {
			// Navigate to the task URL - the effect will load the task
			goToInboxHubTask(workspaceId, taskId);
		},
		[goToInboxHubTask],
	);

	const handleModalClose = useCallback(() => {
		setSelectedTask(null);
		goToInboxHub();
	}, [goToInboxHub]);

	const handleTaskSelect = useCallback(
		(workspaceId: string, taskId: string) => {
			// Set selection for this workspace, clear others (single selection mode)
			setSelectedTaskByColumn({ [workspaceId]: taskId });
			// Find the column index for this workspace to update focusedColumnIndex
			const columnIndex = inboxes.findIndex((i) => i.workspaceId === workspaceId);
			if (columnIndex !== -1) {
				setFocusedColumnIndex(columnIndex);
			}
			setKeyboardModeActive(true);
		},
		[inboxes],
	);

	const handleTaskUpdate = useCallback(
		async (
			workspaceId: string,
			taskId: string,
			updates: Parameters<typeof updateTask>[2],
			etag: number,
		) => {
			// Find current task for undo recording (only if state is changing)
			let prevTask: ProjectTaskListItem | undefined;
			if (updates.state) {
				const inbox = inboxes.find((i) => i.workspaceId === workspaceId);
				prevTask = inbox?.tasks.find((t) => t.id === taskId);
			}

			try {
				const updated = await updateTask(workspaceId, taskId, updates, etag);
				// Update in list - sync title, state, and other fields
				setInboxes((prev) =>
					prev.map((inbox) =>
						inbox.workspaceId === workspaceId
							? {
									...inbox,
									tasks: inbox.tasks.map((t) =>
										t.id === taskId
											? {
													...t,
													title: updated.title,
													state: updated.state,
													priority: updated.priority,
													labels: updated.labels,
													due_at: updated.due_at,
													etag: updated.etag,
												}
											: t,
									),
								}
							: inbox,
					),
				);
				// Update modal
				setSelectedTask((prev) =>
					prev && prev.task?.id === taskId ? { ...prev, task: updated } : prev,
				);

				// Record undo entry if state changed
				if (updates.state && prevTask && prevTask.state !== updated.state) {
					recordUndo({
						workspaceId,
						taskId,
						taskTitle: updated.title,
						prev: { state: prevTask.state, priority: prevTask.priority, etag },
						next: { state: updated.state, priority: updated.priority, etag: updated.etag },
						wasArchived: false,
						timestamp: Date.now(),
					});
				}

				return updated;
			} catch (err) {
				console.error("Failed to update task:", err);
				throw err;
			}
		},
		[inboxes, recordUndo],
	);

	const handleTaskDelete = useCallback(
		async (workspaceId: string, task: ProjectTaskListItem | TaskListItem) => {
			await deleteTask(workspaceId, task.id);
			// Remove from list
			setInboxes((prev) =>
				prev.map((inbox) =>
					inbox.workspaceId === workspaceId
						? { ...inbox, tasks: inbox.tasks.filter((t) => t.id !== task.id) }
						: inbox,
				),
			);
		},
		[],
	);

	const handleRefresh = useCallback(() => {
		setRefreshId((n) => n + 1);
	}, []);

	const handleContainerDelete = useCallback(
		async (workspaceId: string, containerPath: string) => {
			const inbox = inboxes.find((i) => i.workspaceId === workspaceId);
			if (!inbox) {
				throw { message: "Workspace inbox not available", status: 404 } as ApiClientError;
			}
			const targetContainer = findContainerByPath(inbox.childContainers, containerPath);
			const containerId = targetContainer?.id ?? containerPath;
			await deleteContainer(workspaceId, containerId);
			handleRefresh();
		},
		[inboxes, findContainerByPath, handleRefresh],
	);

	const handleTaskDrop = useCallback(
		async (
			dragData: {
				taskId: string;
				taskTitle: string;
				sourceWorkspaceId: string;
				globalTaskId: string;
			},
			targetWorkspaceId: string,
		) => {
			try {
				// Move the task to the target workspace's inbox
				const response = await moveTask(dragData.globalTaskId, {
					toProjectId: targetWorkspaceId,
					toContainerPath: "inbox", // Always default to inbox
					preserveAssignee: true,
					linkRelation: true,
				});
				const destination = response.destination;
				const destinationGlobalTaskId =
					destination.global_task_id ?? `${destination.project.id}:${destination.id}`;
				const destinationItem = {
					uuid: destination.uuid,
					id: destination.id,
					slug: destination.slug,
					title: destination.title,
					state: destination.state,
					priority: destination.priority,
					kind: destination.kind,
					requested_by_project_id: destination.requested_by_project_id,
					assigned_project_id: destination.assigned_project_id,
					acknowledged_at: destination.acknowledged_at,
					resolution: destination.resolution,
					cp_project_id: destination.cp_project_id,
					cp_run_id: destination.cp_run_id,
					cp_session_id: destination.cp_session_id,
					sdk_session_id: destination.sdk_session_id,
					run_status: destination.run_status,
					parent_task_uuid: destination.parent_task?.uuid ?? null,
					assignee: destination.assignee,
					due_at: destination.due_at,
					labels: destination.labels,
					meta: destination.meta,
					updated_at: destination.updated_at,
					etag: destination.etag,
					project: destination.project,
					projectId: destination.project.id,
					projectName: destination.project.title,
					global_task_id: destinationGlobalTaskId,
				} as ProjectTaskListItem;
				// Optimistically remove from source inbox (same pattern as handleTaskComplete)
				// and add to destination when visible in the current filter.
				setInboxes((prev) =>
					prev.map((inbox) => {
						if (inbox.workspaceId === dragData.sourceWorkspaceId) {
							return { ...inbox, tasks: inbox.tasks.filter((t) => t.id !== dragData.taskId) };
						}
						if (inbox.workspaceId !== targetWorkspaceId) {
							return inbox;
						}
						if (viewMode !== "action" || !ACTION_STATES.has(destination.state)) {
							return inbox;
						}
						const alreadyPresent = inbox.tasks.some((task) => {
							const globalTaskId = (task as { global_task_id?: string }).global_task_id;
							return (
								task.id === destination.id ||
								task.uuid === destination.uuid ||
								(globalTaskId && globalTaskId === destinationGlobalTaskId)
							);
						});
						if (alreadyPresent) return inbox;
						return { ...inbox, tasks: [destinationItem, ...inbox.tasks] };
					}),
				);
			} catch (err) {
				console.error("Failed to move task:", err);
				throw err;
			}
		},
		[viewMode],
	);

	const handleFilterSave = useCallback(
		(state: FilterState) => {
			setSelectedProjects(state.selected);
			setProjectOrder(state.order);

			// Save current filter state to filterset storage
			const newStorage = setCurrentFilter(
				filtersetStorage,
				Array.from(state.selected),
				state.order,
			);
			setFiltersetStorage(newStorage);
			saveFiltersets(newStorage);

			setFilterModalOpen(false);
		},
		[filtersetStorage],
	);

	// Filterset handlers
	const handleFiltersetSelect = useCallback(
		(filterset: FilterSet) => {
			const allProjectIds = workspaceTrees.map((w) => w.projectId);
			const allProjectIdSet = new Set(allProjectIds);
			// Apply filterset, filtering to valid project IDs
			const validSelected = new Set(filterset.selected.filter((id) => allProjectIdSet.has(id)));
			const validOrder = filterset.order.filter((id) => allProjectIdSet.has(id));
			const missingFromOrder = allProjectIds.filter((id) => !validOrder.includes(id));
			setSelectedProjects(validSelected);
			setProjectOrder([...validOrder, ...missingFromOrder]);
			// Update active filterset
			const newStorage = setActiveFilterset(filtersetStorage, filterset.id);
			setFiltersetStorage(newStorage);
			saveFiltersets(newStorage);
		},
		[workspaceTrees, filtersetStorage],
	);

	const handleFiltersetSaveNew = useCallback(
		(name: string) => {
			const { storage: newStorage } = createFilterset(
				filtersetStorage,
				name,
				Array.from(selectedProjects),
				projectOrder,
			);
			setFiltersetStorage(newStorage);
			saveFiltersets(newStorage);
			setSaveFiltersetModalOpen(false);
		},
		[filtersetStorage, selectedProjects, projectOrder],
	);

	const handleFiltersetRename = useCallback(
		(id: string, newName: string) => {
			const newStorage = updateFilterset(filtersetStorage, id, { name: newName });
			setFiltersetStorage(newStorage);
			saveFiltersets(newStorage);
		},
		[filtersetStorage],
	);

	const handleFiltersetDelete = useCallback(
		(id: string) => {
			const newStorage = deleteFilterset(filtersetStorage, id);
			setFiltersetStorage(newStorage);
			saveFiltersets(newStorage);
		},
		[filtersetStorage],
	);

	const handleFiltersetSetDefault = useCallback(
		(id: string | null) => {
			const newStorage = setDefaultFilterset(filtersetStorage, id);
			setFiltersetStorage(newStorage);
			saveFiltersets(newStorage);
		},
		[filtersetStorage],
	);

	const handleSortChange = useCallback((newSort: InboxSort) => {
		setSort(newSort);
		saveSort(newSort);
	}, []);

	// Handle launching implementation terminal for selected task
	const handleImplementTask = useCallback(
		async (tool: "clod" | "codex", workspaceId: string, task: ProjectTaskListItem) => {
			try {
				const launchId = tool === "codex" ? "implement-codex" : "implement-clod";
				const launch = getSessionLaunch(launchId);
				await launchTerminal(
					buildTerminalLaunchRequest(
						launch,
						{
							projectId: workspaceId,
							statusbar: { right: `${launch.harness}@${workspaceId}` },
							task: { id: task.id, slug: `inbox/${task.slug}`, title: task.title },
						},
						"inbox",
					),
				);
			} catch (err) {
				console.error("Failed to launch implementation terminal:", err);
			}
		},
		[],
	);

	// Handle launching triage terminal for selected task
	const handleTriageTask = useCallback(
		async (tool: "clod" | "codex", workspaceId: string, task: ProjectTaskListItem) => {
			try {
				const launchId = tool === "codex" ? "triage-codex" : "triage-clod";
				const launch = getSessionLaunch(launchId);
				await launchTerminal(
					buildTerminalLaunchRequest(
						launch,
						{
							projectId: workspaceId,
							statusbar: { right: `${launch.harness}@${workspaceId}` },
							task: { id: task.id, slug: `inbox/${task.slug}`, title: task.title },
						},
						"inbox",
					),
				);
			} catch (err) {
				console.error("Failed to launch triage terminal:", err);
			}
		},
		[],
	);

	// Sync suppressSelectionScrollTaskByWorkspace when selection changes
	useEffect(() => {
		setSuppressSelectionScrollTaskByWorkspace((prev) => {
			let changed = false;
			const next = { ...prev };
			for (const [workspaceId, suppressedTaskId] of Object.entries(prev)) {
				if (!suppressedTaskId) continue;
				const selectedTaskId = selectedTaskByColumn[workspaceId] || null;
				if (selectedTaskId !== suppressedTaskId) {
					next[workspaceId] = null;
					changed = true;
				}
			}
			return changed ? next : prev;
		});
	}, [selectedTaskByColumn]);

	// Use the extracted keyboard navigation hook
	const isModalOpen =
		!!selectedTask || filterModalOpen || saveFiltersetModalOpen || manageFiltersetsModalOpen;
	useKeyboardNavigation({
		inboxes,
		keyboardModeActive,
		setKeyboardModeActive,
		focusedColumnIndex,
		setFocusedColumnIndex,
		selectedTaskByColumn,
		setSelectedTaskByColumn,
		setSuppressSelectionScrollTaskByWorkspace,
		quickAddColumnIndex,
		setQuickAddColumnIndex,
		searchQuery,
		setSearchQuery,
		searchInputRef,
		cardSize,
		setCardSize,
		setCardSizeChanged,
		sort,
		setSort,
		setSortChanged,
		scrollContainerRef,
		isModalOpen,
		undoEntry,
		performUndo,
		handleTaskClick,
		handleTaskComplete,
		handleTaskArchive,
		handleTaskDelete,
		handleImplementTask,
		handleTriageTask,
		applyTaskRunUpdate,
		handleRefresh,
		goToContainerView,
	});

	return (
		<div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
			{/* Header */}
			<InboxHubHeader
				goToGlobalDashboard={goToGlobalDashboard}
				filterReady={filterReady}
				totalWorkspaceCount={totalWorkspaceCount}
				visibleWorkspaceCount={visibleWorkspaceCount}
				inboxCount={inboxes.length}
				isFilterActive={isFilterActive}
				selectedProjectsCount={selectedProjects.size}
				keyboardModeActive={keyboardModeActive}
				cardSize={cardSize}
				cardSizeChanged={cardSizeChanged}
				sort={sort}
				sortChanged={sortChanged}
				onSortChange={handleSortChange}
				viewMode={viewMode}
				onViewModeChange={setViewMode}
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				searchFocused={searchFocused}
				onSearchFocus={() => setSearchFocused(true)}
				onSearchBlur={() => setSearchFocused(false)}
				searchInputRef={searchInputRef}
				singleSearchMatch={singleSearchMatch}
				onSearchEnter={(match) => {
					setSearchQuery("");
					setKeyboardModeActive(true);
					setFocusedColumnIndex(match.columnIndex);
					setSelectedTaskByColumn({ [match.workspaceId]: match.taskId });
					searchInputRef.current?.blur();
					handleTaskClick(
						match.workspaceId,
						match.workspaceName,
						match.containerId,
						match.containerTitle,
						match.taskId,
					);
				}}
				filtersets={filtersetStorage.filtersets}
				activeFilterset={activeFilterset}
				isFilterCustom={isFilterCustom}
				onFiltersetSelect={handleFiltersetSelect}
				onFiltersetSaveNew={() => setSaveFiltersetModalOpen(true)}
				onFiltersetManage={() => setManageFiltersetsModalOpen(true)}
				workspacesLoading={workspacesLoading}
				onFilterModalOpen={() => setFilterModalOpen(true)}
				onSettingsPanelOpen={() => setSettingsPanelOpen(true)}
			/>

			{/* Kanban Columns */}
			<main className="flex-1 overflow-hidden">
				{workspacesLoading ? (
					<LoadingState />
				) : inboxes.length === 0 ? (
					filterReady && totalWorkspaceCount > 0 && selectedProjects.size === 0 ? (
						<NoProjectsSelectedState onOpenFilter={() => setFilterModalOpen(true)} />
					) : (
						<NoInboxesFoundState />
					)
				) : (
					<div
						ref={scrollContainerRef}
						className="h-full overflow-x-auto overflow-y-auto md:overflow-y-hidden px-4 py-5"
					>
						<div className="flex flex-col md:flex-row gap-4 h-auto md:h-full md:min-w-max stagger-children">
							{inboxes.map((inbox, index) => (
								<InboxColumn
									key={`${inbox.workspaceId}:${inbox.containerId}`}
									workspaceId={inbox.workspaceId}
									workspaceName={inbox.workspaceName}
									containerId={inbox.containerId}
									containerTitle={inbox.containerTitle}
									containerPath={inbox.containerPath}
									childContainers={inbox.childContainers}
									tasks={inbox.tasks}
									loading={inbox.loading}
									error={inbox.error}
									onTaskComplete={
										(task) =>
											viewMode === "awaiting_ack"
												? handleTaskAcknowledge(inbox.workspaceId, task)
												: viewMode === "action"
													? handleTaskComplete(inbox.workspaceId, task)
													: undefined // completed view - no action
									}
									onTaskCreate={(title, description, targetContainerPath) =>
										handleTaskCreate(
											inbox.workspaceId,
											inbox.containerId,
											title,
											description,
											targetContainerPath,
										)
									}
									onTaskClick={(taskId) =>
										handleTaskClick(
											inbox.workspaceId,
											inbox.workspaceName,
											inbox.containerId,
											inbox.containerTitle,
											taskId,
										)
									}
									onTaskSelect={(taskId) => handleTaskSelect(inbox.workspaceId, taskId)}
									onTaskDelete={(task) => handleTaskDelete(inbox.workspaceId, task)}
									onContainerDelete={(containerPath) =>
										handleContainerDelete(inbox.workspaceId, containerPath)
									}
									onTaskDrop={viewMode === "action" ? handleTaskDrop : undefined}
									onRefresh={handleRefresh}
									mode={viewMode}
									style={{ animationDelay: `${index * 60}ms` }}
									// Keyboard navigation props
									isFocused={keyboardModeActive && focusedColumnIndex === index}
									selectedTaskId={selectedTaskByColumn[inbox.workspaceId] || null}
									suppressSelectionScrollTaskId={
										suppressSelectionScrollTaskByWorkspace[inbox.workspaceId] || null
									}
									forceQuickAdd={quickAddColumnIndex === index}
									onQuickAddClose={() => setQuickAddColumnIndex(null)}
									// Animation state
									completingTasks={completingTasks}
									// Card size/density
									cardSize={cardSize}
									selectionScrollBehavior={selectionScrollBehaviorRef.current}
									// Search state
									searchActive={isSearchActive}
									searchMatches={searchMatchesByWorkspace.get(inbox.workspaceId)}
								/>
							))}
						</div>
					</div>
				)}
			</main>

			{/* Task Detail Modal */}
			{selectedTaskDisplay && (
				<TaskDetailModal
					workspaceId={selectedTaskDisplay.workspaceId}
					workspaceName={selectedTaskDisplay.workspaceName}
					containerId={selectedTaskDisplay.containerId}
					containerTitle={selectedTaskDisplay.containerTitle}
					task={selectedTaskDisplay.task}
					loading={selectedTaskDisplay.loading}
					onClose={handleModalClose}
					onTaskUpdate={handleTaskUpdate}
					onTaskComplete={() => {
						if (selectedTaskDisplay.task) {
							handleTaskComplete(
								selectedTaskDisplay.workspaceId,
								selectedTaskDisplay.task as unknown as TaskListItem,
							);
							handleModalClose();
						}
					}}
				/>
			)}

			<InboxProjectFilterModal
				isOpen={filterModalOpen}
				workspaces={workspaceTrees}
				selectedProjects={selectedProjects}
				projectOrder={projectOrder}
				onClose={() => setFilterModalOpen(false)}
				onSave={handleFilterSave}
			/>

			<SaveFiltersetModal
				isOpen={saveFiltersetModalOpen}
				selectedCount={selectedProjects.size}
				onClose={() => setSaveFiltersetModalOpen(false)}
				onSave={handleFiltersetSaveNew}
			/>

			<FiltersetManagementModal
				isOpen={manageFiltersetsModalOpen}
				filtersets={filtersetStorage.filtersets}
				defaultId={filtersetStorage.defaultId}
				onClose={() => setManageFiltersetsModalOpen(false)}
				onRename={handleFiltersetRename}
				onDelete={handleFiltersetDelete}
				onSetDefault={handleFiltersetSetDefault}
			/>

			<SettingsPanel open={settingsPanelOpen} onClose={() => setSettingsPanelOpen(false)} />

			{/* Undo Toast */}
			{undoEntry && (
				<UndoToast
					undoEntry={undoEntry}
					undoInProgress={undoInProgress}
					onUndo={performUndo}
					onDismiss={clearUndo}
				/>
			)}
		</div>
	);
}
