/**
 * Shared chat utilities for session/run-based conversations.
 *
 * These functions are extracted from SessionCard and ProjectRosterConversation
 * to provide a consistent foundation for chat UIs.
 */

import type { SessionStreamEntry } from "@/hooks/useCpSessionStream";

/**
 * Minimal run type for grouping and live detection.
 * Subset of WorkItemRun / RunSummary that these utilities need.
 */
export type RunLike = {
	runId: string;
	status: string;
	createdAt: number;
	completedAt?: number;
};

/**
 * A group of events belonging to a single run.
 */
export type RunGroup = {
	runId: string;
	run?: RunLike;
	events: SessionStreamEntry[];
};

/**
 * Group session events by their runId, preserving order within each group.
 *
 * Events are grouped as they appear in the stream. Runs without events
 * (historical runs that have no cached events) are added at the end.
 * Final array is sorted by run createdAt (oldest first).
 *
 * @param entries - Session stream entries to group
 * @param runs - Run metadata for looking up run details
 * @returns Array of run groups, sorted by createdAt
 */
export function groupEventsByRun(entries: SessionStreamEntry[], runs: RunLike[]): RunGroup[] {
	const runMap = new Map<string, RunLike>();
	for (const run of runs) {
		runMap.set(run.runId, run);
	}

	// Build groups from events
	const groups: RunGroup[] = [];
	const seenRunIds = new Set<string>();
	let currentGroup: RunGroup | null = null;

	for (const entry of entries) {
		const runId = entry.runId ?? "unknown";
		seenRunIds.add(runId);

		if (!currentGroup || currentGroup.runId !== runId) {
			currentGroup = {
				runId,
				run: runMap.get(runId),
				events: [],
			};
			groups.push(currentGroup);
		}

		currentGroup.events.push(entry);
	}

	// Add runs that have no events (historical runs without cached events)
	for (const run of runs) {
		if (!seenRunIds.has(run.runId)) {
			groups.push({
				runId: run.runId,
				run,
				events: [],
			});
		}
	}

	// Sort by run createdAt (oldest first)
	groups.sort((a, b) => {
		const aTime = a.run?.createdAt ?? 0;
		const bTime = b.run?.createdAt ?? 0;
		return aTime - bTime;
	});

	return groups;
}

/**
 * Terminal event types that indicate a run has finished.
 */
const TERMINAL_EVENT_TYPES = ["run_completed", "run_failed", "run_cancelled"];

/**
 * Extract the event type from a session event.
 * Handles both `type` and `kind` fields for API compatibility.
 */
function getEventType(event: Record<string, unknown>): string | undefined {
	return (event.type ?? event.kind) as string | undefined;
}

/**
 * Detect if any run is still "live" (actively streaming).
 *
 * A run is considered live if:
 * 1. It has status "running" in the run metadata
 * 2. AND it hasn't received a terminal event (completed/failed/cancelled) via SSE
 *
 * This handles the race condition where the DB still shows "running" but
 * we've already received the completion event via SSE.
 *
 * @param runs - Run metadata to check
 * @param entries - Session stream entries (should be sorted by seq)
 * @returns true if at least one run is still actively streaming
 */
export function detectLiveRun(runs: RunLike[], entries: SessionStreamEntry[]): boolean {
	const runningRuns = runs.filter((r) => r.status === "running");
	if (runningRuns.length === 0) return false;

	// Check if any running run has received a terminal event via SSE
	for (const run of runningRuns) {
		const hasTerminalEvent = entries.some((entry) => {
			if (entry.runId !== run.runId) return false;
			const eventType = getEventType(entry.event as Record<string, unknown>);
			return eventType !== undefined && TERMINAL_EVENT_TYPES.includes(eventType);
		});

		// If this running run hasn't received a terminal event, we still have a live run
		if (!hasTerminalEvent) return true;
	}

	return false;
}

/**
 * Check if a specific run has a completion event in the entries.
 */
export function hasCompletionEvent(runId: string, entries: SessionStreamEntry[]): boolean {
	return entries.some((entry) => {
		if (entry.runId !== runId) return false;
		const eventType = getEventType(entry.event as Record<string, unknown>);
		return eventType === "run_completed";
	});
}
