import type { TaskListItem } from "@workboard/shared";
/**
 * useTaskWebhook - Shared hook for real-time task updates via SSE
 *
 * Provides EventSource subscription to /api/webhooks/stream for task updates.
 * Used by InboxHub, ContainerNavigator, and ContainerDetailView for live updates.
 */
import { useCallback, useEffect, useRef } from "react";

/**
 * Webhook payload structure from the SSE stream
 */
export type WebhookTaskPayload = {
	ticket_id: string;
	ticket_uuid: string;
	project_id: string;
	project_uuid: string;
	state: TaskListItem["state"];
	priority: TaskListItem["priority"];
	kind: TaskListItem["kind"];
	run_status?: TaskListItem["run_status"];
	resolution?: TaskListItem["resolution"];
	meta?: TaskListItem["meta"];
	etag: TaskListItem["etag"];
	cp_project_id?: TaskListItem["cp_project_id"];
	cp_run_id?: TaskListItem["cp_run_id"];
	cp_session_id?: TaskListItem["cp_session_id"];
	sdk_session_id?: TaskListItem["sdk_session_id"];
	blocked_by?: TaskListItem["blocked_by"];
};

/**
 * Options for the webhook hook
 */
export type UseTaskWebhookOptions = {
	/** Called when a task update is received */
	onTaskUpdate?: (payload: WebhookTaskPayload) => void;
	/** Called when a refresh should be triggered (debounced) */
	onRefresh?: () => void;
	/** Whether to disable the webhook subscription */
	disabled?: boolean;
	/** Debounce interval in ms (default: 1000) */
	debounceMs?: number;
};

/**
 * Default debounce interval for refresh calls
 */
const DEFAULT_DEBOUNCE_MS = 1000;

/**
 * Hook for subscribing to real-time task updates via SSE
 *
 * @example
 * ```tsx
 * useTaskWebhook({
 *   onTaskUpdate: (payload) => {
 *     // Handle in-place update
 *     if (payload.ticket_id === currentTask.id) {
 *       setTask(prev => ({ ...prev, state: payload.state }));
 *     }
 *   },
 *   onRefresh: () => {
 *     // Full refresh when needed
 *     refetchTasks();
 *   },
 * });
 * ```
 */
export function useTaskWebhook(options: UseTaskWebhookOptions = {}) {
	const { onTaskUpdate, onRefresh, disabled = false, debounceMs = DEFAULT_DEBOUNCE_MS } = options;

	const lastRefreshRef = useRef(0);
	const onTaskUpdateRef = useRef(onTaskUpdate);
	const onRefreshRef = useRef(onRefresh);

	// Keep refs updated to avoid stale closures
	useEffect(() => {
		onTaskUpdateRef.current = onTaskUpdate;
		onRefreshRef.current = onRefresh;
	}, [onTaskUpdate, onRefresh]);

	const scheduleRefresh = useCallback(() => {
		const now = Date.now();
		if (now - lastRefreshRef.current < debounceMs) {
			return;
		}
		lastRefreshRef.current = now;
		onRefreshRef.current?.();
	}, [debounceMs]);

	useEffect(() => {
		// Check for VITE_DISABLE_WEBHOOKS environment variable
		if (import.meta.env.VITE_DISABLE_WEBHOOKS === "1") {
			return;
		}

		if (disabled) {
			return;
		}

		const source = new EventSource("/api/webhooks/stream");

		source.onmessage = (event) => {
			if (!event.data) return;

			let payload: WebhookTaskPayload;
			try {
				payload = JSON.parse(event.data) as WebhookTaskPayload;
			} catch {
				console.warn("[useTaskWebhook] Failed to parse webhook payload:", event.data);
				return;
			}

			console.info("[useTaskWebhook] received:", {
				ticketId: payload.ticket_id,
				projectId: payload.project_id,
				state: payload.state,
			});

			// Call the task update handler
			if (onTaskUpdateRef.current) {
				onTaskUpdateRef.current(payload);
			}

			// If no task update handler or it doesn't handle the update, schedule refresh
			if (!onTaskUpdateRef.current && onRefreshRef.current) {
				scheduleRefresh();
			}
		};

		source.onerror = (err) => {
			console.warn("[useTaskWebhook] Stream error:", err);
		};

		return () => {
			source.close();
		};
	}, [disabled, scheduleRefresh]);
}

/**
 * Helper to check if a webhook payload matches a specific task
 */
export function matchesTask(
	payload: WebhookTaskPayload,
	taskId: string,
	taskUuid?: string,
): boolean {
	return (
		payload.ticket_id === taskId || (taskUuid !== undefined && payload.ticket_uuid === taskUuid)
	);
}

/**
 * Helper to check if a webhook payload matches a specific project
 */
export function matchesProject(
	payload: WebhookTaskPayload,
	projectId: string,
	projectUuid?: string,
): boolean {
	return (
		payload.project_id === projectId ||
		(projectUuid !== undefined && payload.project_uuid === projectUuid)
	);
}

/**
 * Set of action states (tasks that should appear in action/inbox views)
 */
export const ACTION_STATES = new Set(["idea", "draft", "open", "in_progress", "blocked"]);

/**
 * Check if a state is an "action" state (not completed/archived/cancelled)
 */
export function isActionState(state: TaskListItem["state"]): boolean {
	return ACTION_STATES.has(state);
}
